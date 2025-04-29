// Collision detection system using Three.js raycasting
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Collision map and raycaster
let collisionMap;
let collisionMeshes = [];
const raycaster = new THREE.Raycaster();
const collisionDistance = 0.65; // Distance to maintain from obstacles (increased to reduce penetration)
const playerRadius = 0.5; // Approximate player radius (increased to better match character size)

// Temporary vectors for calculations (reused to avoid garbage collection)
const rayDirection = new THREE.Vector3();
const playerPosition = new THREE.Vector3();
const collisionResults = [];
const moveVector = new THREE.Vector3();
const downDirection = new THREE.Vector3(0, -1, 0); // For ground detection

/**
 * Load collision map based on the main menu model
 * @param {string} modelPath - Path to the collision model
 * @param {function} onLoad - Callback when loaded
 */
export function loadCollisionMap(modelPath, onLoad) {
  const loader = new FBXLoader();
  
  loader.load(modelPath, (fbx) => {
    collisionMap = fbx;
    collisionMap.scale.set(0.0425, 0.0425, 0.0425); // Match the visual map scale
    collisionMap.position.set(5, -9.25, 0); // Match the visual map position
    
    // Extract all meshes for collision detection
    collisionMeshes = []; // Clear any existing meshes
    collisionMap.traverse(child => {
      if (child.isMesh) {
        // Make the collision meshes invisible but keep their geometry
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.visible = false;
              mat.opacity = 0;
              mat.transparent = true;
            });
          } else {
            child.material.visible = false;
            child.material.opacity = 0;
            child.material.transparent = true;
          }
        }
        
        // Add to collision meshes array
        collisionMeshes.push(child);
      }
    });
    
    console.log(`Added ${collisionMeshes.length} meshes for collision detection`);
    
    // Callback when done
    if (onLoad) onLoad(collisionMap);
  });
}

/**
 * Check for collisions in the specified direction
 * @param {THREE.Vector3} position - Current player position
 * @param {THREE.Vector3} direction - Movement direction (normalized)
 * @param {number} distance - Distance to check for collisions
 * @returns {boolean} True if collision detected
 */
export function checkCollision(position, direction, distance) {
  if (collisionMeshes.length === 0) return false;
  
  // Set up raycaster
  raycaster.set(position, direction);
  raycaster.far = distance + playerRadius;
  
  // Check for intersections
  collisionResults.length = 0; // Clear previous results
  raycaster.intersectObjects(collisionMeshes, true, collisionResults); // Use recursive=true to check all child meshes
  
  // Return true if collision detected within threshold
  return collisionResults.length > 0 && collisionResults[0].distance < distance + playerRadius;
}

/**
 * Adjust movement vector to prevent collisions
 * @param {THREE.Vector3} position - Current player position
 * @param {THREE.Vector3} moveVec - Desired movement vector
 * @returns {THREE.Vector3} Adjusted movement vector
 */
export function adjustMovementForCollisions(position, moveVec) {
  if (collisionMeshes.length === 0 || moveVec.length() === 0) return moveVec;
  
  // Store original movement
  const originalLength = moveVec.length();
  const adjustedMove = moveVec.clone();
  
  // Use the exact position passed in - which includes jump height
  // This ensures collision rays are cast from the character's actual position in 3D space
  const rayOrigin = position.clone();
  
  // Log the ray origin height for debugging
  // console.log(`Ray origin Y: ${rayOrigin.y.toFixed(2)}`);
  
  // We don't need to add extra height since the position already includes jump height
  
  // Only cast rays in the direction of movement and at strategic angles
  // This is more efficient than casting in all directions
  
  // Check forward collision (in the direction of movement)
  rayDirection.copy(moveVec).normalize();
  if (checkCollision(rayOrigin, rayDirection, collisionDistance)) {
    // Collision detected, prevent movement in this direction
    adjustedMove.set(0, 0, 0);
    return adjustedMove;
  }
  
  // Use 5 rays at strategic angles for better coverage
  // This gives better coverage with minimal performance impact
  const sideAngle30 = Math.PI / 6; // 30 degrees
  const sideAngle60 = Math.PI / 3; // 60 degrees
  const sideAngle90 = Math.PI / 2; // 90 degrees (perpendicular)
  
  // Check 30-degree right
  rayDirection.copy(moveVec).normalize();
  const rightDir30 = new THREE.Vector3().copy(rayDirection);
  rightDir30.applyAxisAngle(new THREE.Vector3(0, 1, 0), -sideAngle30);
  if (checkCollision(rayOrigin, rightDir30, collisionDistance * 0.85)) {
    // Adjust movement to slide along the wall
    adjustedMove.x -= adjustedMove.x * 0.9;
    adjustedMove.z -= adjustedMove.z * 0.9;
  }
  
  // Check 30-degree left
  rayDirection.copy(moveVec).normalize();
  const leftDir30 = new THREE.Vector3().copy(rayDirection);
  leftDir30.applyAxisAngle(new THREE.Vector3(0, 1, 0), sideAngle30);
  if (checkCollision(rayOrigin, leftDir30, collisionDistance * 0.85)) {
    // Adjust movement to slide along the wall
    adjustedMove.x -= adjustedMove.x * 0.9;
    adjustedMove.z -= adjustedMove.z * 0.9;
  }
  
  // Check 60-degree right
  rayDirection.copy(moveVec).normalize();
  const rightDir60 = new THREE.Vector3().copy(rayDirection);
  rightDir60.applyAxisAngle(new THREE.Vector3(0, 1, 0), -sideAngle60);
  if (checkCollision(rayOrigin, rightDir60, collisionDistance * 0.75)) {
    // Adjust movement to slide along the wall
    adjustedMove.x -= adjustedMove.x * 0.8;
    adjustedMove.z -= adjustedMove.z * 0.8;
  }
  
  // Check 60-degree left
  rayDirection.copy(moveVec).normalize();
  const leftDir60 = new THREE.Vector3().copy(rayDirection);
  leftDir60.applyAxisAngle(new THREE.Vector3(0, 1, 0), sideAngle60);
  if (checkCollision(rayOrigin, leftDir60, collisionDistance * 0.75)) {
    // Adjust movement to slide along the wall
    adjustedMove.x -= adjustedMove.x * 0.8;
    adjustedMove.z -= adjustedMove.z * 0.8;
  }
  
  // Check 90-degree right (perpendicular to movement)
  rayDirection.copy(moveVec).normalize();
  const rightDir90 = new THREE.Vector3().copy(rayDirection);
  rightDir90.applyAxisAngle(new THREE.Vector3(0, 1, 0), -sideAngle90);
  if (checkCollision(rayOrigin, rightDir90, collisionDistance * 0.7)) {
    // Adjust movement for side collision
    adjustedMove.x -= adjustedMove.x * 0.7;
    adjustedMove.z -= adjustedMove.z * 0.7;
  }
  
  // Check 90-degree left (perpendicular to movement)
  rayDirection.copy(moveVec).normalize();
  const leftDir90 = new THREE.Vector3().copy(rayDirection);
  leftDir90.applyAxisAngle(new THREE.Vector3(0, 1, 0), sideAngle90);
  if (checkCollision(rayOrigin, leftDir90, collisionDistance * 0.7)) {
    // Adjust movement for side collision
    adjustedMove.x -= adjustedMove.x * 0.7;
    adjustedMove.z -= adjustedMove.z * 0.7;
  }
  
  return adjustedMove;
}

/**
 * Check for collisions in all directions around the player
 * Used for debugging and visualization
 * @param {THREE.Vector3} position - Player position
 * @param {number} numRays - Number of rays to cast around the player
 * @returns {Array} Array of collision points
 */
export function checkSurroundingCollisions(position, numRays = 5) {
  const collisionPoints = [];
  
  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2;
    rayDirection.set(Math.sin(angle), 0, Math.cos(angle)).normalize();
    
    if (checkCollision(position, rayDirection, collisionDistance)) {
      collisionPoints.push({
        direction: rayDirection.clone(),
        distance: collisionResults[0].distance,
        point: collisionResults[0].point.clone()
      });
    }
  }
  
  // Add ground detection ray
  if (checkCollision(position, downDirection, 10)) { // Check up to 10 units down
    collisionPoints.push({
      direction: downDirection.clone(),
      distance: collisionResults[0].distance,
      point: collisionResults[0].point.clone(),
      isGround: true
    });
  }
  
  return collisionPoints;
}

/**
 * Create a visual debug helper for collision detection
 * @param {THREE.Scene} scene - The scene to add helpers to
 * @param {THREE.Object3D} player - The player object
 * @returns {Object} Helper functions
 */
export function createCollisionDebugger(scene, player) {
  const helpers = [];
  const numRays = 5;
  
  // Create ray helpers for horizontal rays
  for (let i = 0; i < numRays; i++) {
    const helper = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      collisionDistance + playerRadius,
      0xff0000
    );
    scene.add(helper);
    helpers.push(helper);
  }
  
  // Add ground detection ray helper
  const groundHelper = new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 0),
    10, // Longer ray for ground detection
    0x00ffff // Cyan color to distinguish from collision rays
  );
  scene.add(groundHelper);
  helpers.push(groundHelper);
  
  // Function to update helpers
  function updateHelpers() {
    if (!player) return;
    
    const position = new THREE.Vector3();
    player.getWorldPosition(position);
    position.y += 0.5; // Adjust to player center
    
    // Update horizontal ray helpers
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)).normalize();
      
      helpers[i].position.copy(position);
      helpers[i].setDirection(direction);
      
      // Check collision and update color
      raycaster.set(position, direction);
      const intersects = raycaster.intersectObjects(collisionMeshes, true);
      
      if (intersects.length > 0 && intersects[0].distance < collisionDistance + playerRadius) {
        helpers[i].setColor(0xff0000); // Red if collision
        helpers[i].setLength(intersects[0].distance);
      } else {
        helpers[i].setColor(0x00ff00); // Green if no collision
        helpers[i].setLength(collisionDistance + playerRadius);
      }
    }
    
    // Update ground ray helper
    const groundHelper = helpers[numRays];
    groundHelper.position.copy(position);
    
    // Check ground collision
    raycaster.set(position, downDirection);
    const groundIntersects = raycaster.intersectObjects(collisionMeshes, true);
    
    if (groundIntersects.length > 0 && groundIntersects[0].distance < 10) {
      groundHelper.setColor(0x00ffff); // Cyan if ground detected
      groundHelper.setLength(groundIntersects[0].distance);
    } else {
      groundHelper.setColor(0xff00ff); // Magenta if no ground
      groundHelper.setLength(10);
    }
  }
  
  // Toggle visibility of helpers
  function setHelpersVisible(visible) {
    helpers.forEach(helper => {
      helper.visible = visible;
    });
  }
  
  return {
    update: updateHelpers,
    setVisible: setHelpersVisible
  };
}

/**
 * Check for ground beneath the player and return the ground height
 * @param {THREE.Vector3} position - Player position
 * @param {number} maxDistance - Maximum distance to check for ground
 * @param {number} playerHeight - Height of the player model
 * @returns {number|null} Ground height or null if no ground found
 */
export function findGroundHeight(position, maxDistance = 10, playerHeight = 1.7) {
  if (collisionMeshes.length === 0) return null;
  
  // Set up raycaster pointing down
  const rayOrigin = position.clone();
  rayOrigin.y += 0.5; // Start from player center
  
  raycaster.set(rayOrigin, downDirection);
  raycaster.far = maxDistance;
  
  // Check for intersections with ground
  collisionResults.length = 0;
  raycaster.intersectObjects(collisionMeshes, true, collisionResults);
  
  // If ground found, return the height
  if (collisionResults.length > 0) {
    // Calculate the height where the player's feet should be
    const groundPoint = collisionResults[0].point;
    return groundPoint.y;
  }
  
  return null; // No ground found
}
