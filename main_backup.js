// Entry point for Three.js fighting game
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'; // Use 'addons' for Vite/Three.js >=0.150.0
import { loadCollisionMap, adjustMovementForCollisions, createCollisionDebugger, findGroundHeight } from './collision.js';
import { ZombieTarget, createZombieTargets } from './zombie-target.js';

// Initialize scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5); // Original sky color

const camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('bg'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
// renderer.shadowMap.type = THREE.PCFShadowMap; // Better shadow quality (disabled for performance)
// Simplified rendering settings for better performance
// Use compatible color encoding for newer Three.js versions
renderer.outputColorSpace = THREE.SRGBColorSpace; // Updated from outputEncoding = sRGBEncoding
// renderer.toneMapping = THREE.ACESFilmicToneMapping; // Disabled for performance
// renderer.toneMappingExposure = 1.2; // Disabled for performance
document.body.appendChild(renderer.domElement);

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lock pointer for mouse controls
const canvas = renderer.domElement;
canvas.addEventListener('click', () => {
  // Only request pointer lock on desktop
  if (!isMobile()) {
    canvas.requestPointerLock();
  }
});

// Mobile detection function
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         ('ontouchstart' in window) || 
         (window.innerWidth < 800);
}

// Load the main menu map model
let mainMap;
const mapLoader = new FBXLoader();

// Load collision map (using same model as visual map)
loadCollisionMap('./models/mainmenu.fbx', (collisionMap) => {
  console.log('Collision map loaded');
  // Add collision map to scene but make it invisible
  scene.add(collisionMap);
});
mapLoader.load('./models/mainmenu.fbx', (fbx) => {
  mainMap = fbx;
  mainMap.scale.set(0.0425, 0.0425, 0.0425); // Scaled down to 85% of previous size (0.05 * 0.85 = 0.0425)
  mainMap.position.set(5, -9.25, 0); // Fine-tuned position to place character properly on ground
  
  // Load the worldbanners model with the same scale and position as the main map
  mapLoader.load('./models/worldbanners.fbx', (bannersFbx) => {
    console.log('Worldbanners model loaded');
    
    // Apply the same scale and position as the main map
    bannersFbx.scale.set(0.0425, 0.0425, 0.0425);
    bannersFbx.position.set(5, -9.25, 0);
    
    // Process materials for better appearance
    bannersFbx.traverse(child => {
      if (child.isMesh) {
        console.log(`Processing banner mesh: ${child.name}`);
        child.castShadow = false;  // Don't cast shadows
        child.receiveShadow = true; // Still receive shadows
        
        // Configure materials for proper rendering
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach(mat => {
          // Create a new MeshBasicMaterial with proper alpha settings
          const newMaterial = new THREE.MeshStandardMaterial({
            map: mat.map,
            color: mat.color ? mat.color : 0xffffff,
            transparent: true,
            alphaTest: 0.1,
            side: THREE.DoubleSide,
            roughness: 0.7,
            metalness: 0.2
          });
          
          // Replace the original material with our new one
          if (Array.isArray(child.material)) {
            const index = child.material.indexOf(mat);
            if (index !== -1) {
              child.material[index] = newMaterial;
            }
          } else {
            child.material = newMaterial;
          }
        });
      }
    });
    
    // Add to scene
    scene.add(bannersFbx);
  });
  
  // Make the map receive shadows and enhance materials
  mainMap.traverse(child => {
    if (child.isMesh) {
      child.receiveShadow = true;
      child.castShadow = true; // Allow objects to cast shadows too
      
      // Enhance material appearance for more realism
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => {
            // Preserve original color but enhance it
            if (mat.color) {
              const color = mat.color.getHex();
              // Enhance saturation slightly
              mat.color.setHSL(
                mat.color.getHSL({}).h,
                Math.min(mat.color.getHSL({}).s * 1.04, 1.0), // Increase saturation by just 2%
                Math.min(mat.color.getHSL({}).l * 1.1, 1.0)  // Increase lightness slightly
              );
            }
            mat.roughness = 0.7;     // Slightly smoother
            mat.metalness = 0.25;    // Slightly more metallic
            mat.envMapIntensity = 1.2; // Enhance reflections
          });
        } else {
          // Preserve original color but enhance it
          if (child.material.color) {
            const color = child.material.color.getHex();
            // Enhance saturation slightly
            child.material.color.setHSL(
              child.material.color.getHSL({}).h,
              Math.min(child.material.color.getHSL({}).s * 1.02, 1.0), // Increase saturation by just 2%
              Math.min(child.material.color.getHSL({}).l * 1.1, 1.0)  // Increase lightness slightly
            );
          }
          child.material.roughness = 0.7;     // Slightly smoother
          child.material.metalness = 0.25;    // Slightly more metallic
          child.material.envMapIntensity = 1.2; // Enhance reflections
        }
      }
    }
  });
  
  scene.add(mainMap);
}, undefined, (err) => {
  console.error('Error loading main map model:', err);
});

// Enhanced lighting setup
// Balanced warm daylight ambient light
const ambientLight = new THREE.AmbientLight(0xfff6e0, 0.5); // Moderate warm tint to ambient light
scene.add(ambientLight);

// Main directional light (warm daylight)
const dirLight = new THREE.DirectionalLight(0xffd28a, 1.15); // Balanced gold tint to daylight
dirLight.position.set(15, 25, 15); // Initial position, will be updated to follow player
dirLight.castShadow = true;

// Create a target for the directional light
dirLight.target = new THREE.Object3D();
scene.add(dirLight.target);

// Shadow settings optimized for performance
dirLight.shadow.mapSize.width = 256; // Reduced for better performance
dirLight.shadow.mapSize.height = 256;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50; // Reduced since we're following the player

// Set a smaller shadow camera frustum for better quality since it will follow the player
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;

// Adjust bias to prevent shadow acne
dirLight.shadow.bias = -0.0005;

// Higher quality shadow settings (commented out for performance)
// dirLight.shadow.mapSize.width = 2048;
// dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// Add a secondary fill light for better definition
const fillLight = new THREE.DirectionalLight(0xc4d7f2, 0.4); // Slight blue tint
fillLight.position.set(-5, 10, -10); // Opposite side from main light
scene.add(fillLight);

// Position camera closer to player for a more immersive view (similar to Chivalry 2)
camera.position.set(0, 2.9, 5.5); // Adjusted distance (z=5.5) with height (y=2.9)
camera.lookAt(0, 1.75, 0); // Updated lookAt target to 1.75

// Variables for throttled shadow updates
let lastShadowUpdateTime = 0;
let lastPlayerPosition = new THREE.Vector3();
const SHADOW_UPDATE_INTERVAL = 500; // milliseconds between updates
const POSITION_CHANGE_THRESHOLD = 1.0; // units of movement needed to trigger update

// Function to update shadow camera to follow player (optimized)
function updateShadows() {
  if (model) {
    // Calculate light position relative to player
    const offsetX = 15;
    const offsetY = 25;
    const offsetZ = 15;
    
    // Update light position to follow player
    dirLight.position.x = model.position.x + offsetX;
    dirLight.position.z = model.position.z + offsetZ;
    
    // Update light target to point at player
    dirLight.target.position.copy(model.position);
    dirLight.target.updateMatrixWorld();
    
    // Only force shadow map update when really needed
    dirLight.shadow.needsUpdate = true;
    
    // Store current position for next comparison
    lastPlayerPosition.copy(model.position);
  }
}

// Throttled shadow update function
function throttledShadowUpdate() {
  if (!model) return;
  
  const now = Date.now();
  const timeSinceLastUpdate = now - lastShadowUpdateTime;
  const playerMoved = model.position.distanceTo(lastPlayerPosition) > POSITION_CHANGE_THRESHOLD;
  
  // Only update shadows if enough time has passed OR player moved significantly
  if (timeSinceLastUpdate > SHADOW_UPDATE_INTERVAL || playerMoved) {
    updateShadows();
    lastShadowUpdateTime = now;
  }
}

// FBXLoader and animation setup
let mixer;
let actions = {};
let activeAction;
let model;
const loader = new FBXLoader();

// Collision detection
let collisionDebugger;
let collisionDebugEnabled = false;
const moveVector = new THREE.Vector3();

// Movement and camera state
const move = { forward: false, backward: false, left: false, right: false };
let velocity = new THREE.Vector3();
const moveSpeed = 0.08;
const rotateSpeed = 0.003; // Restored rotation speed for smoother movement
let isJumping = false;
let jumpHeight = 0.0;
let jumpVelocity = 0.0;
const JUMP_FORCE = 0.15; // Further reduced jump force for an even lower, more controlled jump
const GRAVITY = 0.008; // Maintain gravity for a shorter jump arc
const MAX_JUMP_TIME = 1000; // Maximum jump duration in milliseconds
let lastGroundY = 0; // Store the last ground position
let originalCameraTargetY = 0; // Store the original camera target Y position
const MAX_CAMERA_TARGET_OFFSET = 0.5; // Increased camera target offset to allow camera to go higher
let smoothCameraTargetY = 0; // For smooth camera transitions during jumps
const pitchLimit = Math.PI / 3; // Limit up/down look angle
let mouseSensitivity = 0.7; // Reduced sensitivity for less abrupt changes

// ...

// Position camera closer to player for a more immersive view (similar to Chivalry 2)
camera.position.set(0, 2.5, 5.5); // Adjusted distance (z=5.5) with height (y=2.5)

// ...

// Properly transition to jump animation
if (activeAction) {
  activeAction.fadeOut(0.1);
}

// Reset all track weights to ensure full body animation
const jumpAction = actions['jump'];
const tracks = jumpAction.getClip().tracks;
for (let i = 0; i < tracks.length; i++) {
  tracks[i].weight = 1.0; // Ensure all tracks have full influence
}

jumpAction.reset()
  .setLoop(THREE.LoopOnce, 1)
  .fadeIn(0.1)
  .setEffectiveTimeScale(0.7) // Slowed animation speed as requested
  .play();

jumpAction.clampWhenFinished = true;
activeAction = jumpAction;

// Ensure we're not using upper/lower body separation for jump
upperBodyAction = null;
// Don't set lowerBodyAction to null as we need it for landing
  }
  if (e.code === 'KeyF') setAction('hit', true); // true = temporary one-shot animation
  if (e.code === 'KeyC') toggleCollisionDebug(); // Toggle collision debug visualization
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') move.forward = false;
  if (e.code === 'KeyS') move.backward = false;
  if (e.code === 'KeyA') move.left = false;
  if (e.code === 'KeyD') move.right = false;
});
window.addEventListener('mousedown', (e) => {
  if (e.button === 0) setAction('punch', true); // Can punch while moving
});

// Setup mobile controls if on a mobile device
if (isMobile()) {
  console.log('Mobile device detected, initializing touch controls');
  document.getElementById('mobile-controls').style.display = 'block';
  
  // Get joystick elements
  const joystickZone = document.getElementById('joystick-zone');
  const joystickThumb = document.getElementById('joystick-thumb');
  const attackButton = document.getElementById('attack-button');

  // Mobile controls state
  let isMobileDevice = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchMoveX = 0;
  let touchMoveY = 0;
  let touchActive = false;
  let lastMoveDirection = null; // Track last movement direction for camera rotation

  // Get joystick dimensions and center position - calculate once to avoid layout thrashing
  const joystickRect = joystickZone.getBoundingClientRect();
  const joystickCenterX = joystickRect.width / 2;
  const joystickCenterY = joystickRect.height / 2;

  // Joystick state
  let joystickActive = false;
  let joystickStartX = 0;
  let joystickStartY = 0;
  let joystickCurrentX = 0;
  let joystickCurrentY = 0;

  const maxDistance = joystickRect.width / 3; // Simplified calculation for better performance
  
  // Joystick touch start event
  joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    
    // Use cached rect to avoid layout thrashing
    // Calculate touch position relative to joystick center
    joystickStartX = touch.clientX - joystickRect.left;
    joystickStartY = touch.clientY - joystickRect.top;
    joystickCurrentX = joystickStartX;
    joystickCurrentY = joystickStartY;
    
    // Activate joystick
    joystickActive = true;
    
    // Update thumb position
    updateJoystickThumb();
  }, { passive: false });
  
  // Throttled touch move handler to improve performance
  let lastMoveUpdate = 0;
  const MOVE_THROTTLE = 333; // Only update every 333ms (3 updates per second)
  
  // Joystick touch move event
  joystickZone.addEventListener('touchmove', (e) => {
    if (!joystickActive) return;
    e.preventDefault();
    
    const now = performance.now();
    if (now - lastMoveUpdate < MOVE_THROTTLE) {
      return; // Skip this update if too soon
    }
    lastMoveUpdate = now;
    
    const touch = e.touches[0];
    const rect = joystickZone.getBoundingClientRect();
    
    // Calculate touch position relative to joystick center
    joystickCurrentX = touch.clientX - rect.left;
    joystickCurrentY = touch.clientY - rect.top;
    
    // Update thumb position and movement direction
    updateJoystickThumb();
    updateMovementDirection();
  }, { passive: false });
  
  // Joystick touch end event
  joystickZone.addEventListener('touchend', (e) => {
    e.preventDefault();
    joystickActive = false;
    
    // Reset thumb position
    joystickThumb.style.transform = `translate(-50%, -50%)`;
    
    // Reset movement
    move.forward = false;
    move.backward = false;
    move.left = false;
    move.right = false;
  }, { passive: false });
  
  // Joystick touch cancel event
  joystickZone.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    joystickActive = false;
    
    // Reset thumb position
    joystickThumb.style.transform = `translate(-50%, -50%)`;
    
    // Reset movement
    move.forward = false;
    move.backward = false;
    move.left = false;
    move.right = false;
  }, { passive: false });
  
  // Update joystick thumb position - optimized
  function updateJoystickThumb() {
    // Calculate distance from center
    const deltaX = joystickCurrentX - joystickCenterX;
    const deltaY = joystickCurrentY - joystickCenterY;
    
    // Use approximate distance calculation (avoid square root for performance)
    // This is the "octagon approximation" which is much faster than Math.sqrt
    const absDx = Math.abs(deltaX);
    const absDy = Math.abs(deltaY);
    const distance = absDx + absDy - (Math.min(absDx, absDy) / 2);
    
    // Limit distance to max radius
    let limitedX, limitedY;
    
    if (distance > maxDistance) {
      const ratio = maxDistance / distance;
      limitedX = deltaX * ratio;
      limitedY = deltaY * ratio;
    } else {
      limitedX = deltaX;
      limitedY = deltaY;
    }
    
    // Update thumb position - use hardware acceleration
    joystickThumb.style.transform = `translate3d(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px), 0)`;
  }
  
  // Update movement direction based on joystick position - optimized
  function updateMovementDirection() {
    // Calculate direction vector
    const deltaX = joystickCurrentX - joystickCenterX;
    const deltaY = joystickCurrentY - joystickCenterY;
    
    // Use approximate distance calculation (avoid square root for performance)
    const absDx = Math.abs(deltaX);
    const absDy = Math.abs(deltaY);
    const distance = absDx + absDy - (Math.min(absDx, absDy) / 2);
    
    // Only update if joystick is moved significantly
    if (distance > 10) {
      // Simplified direction detection - just check which axis has more movement
      // This is much faster than calculating angles
      const isHorizontal = absDx > absDy;
      
      // Reset movement flags
      move.forward = false;
      move.backward = false;
      move.left = false;
      move.right = false;
      
      if (isHorizontal) {
        // Horizontal movement dominates
        if (deltaX > 0) {
          move.right = true;
          // Store the last direction for camera auto-rotation
          lastMoveDirection = 'right';
        } else {
          move.left = true;
          // Store the last direction for camera auto-rotation
          lastMoveDirection = 'left';
        }
      } else {
        // Vertical movement dominates
        if (deltaY > 0) {
          move.backward = true;
        } else {
          move.forward = true;
        }
      }
    }
  }
  
  // Setup attack button
  attackButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    setAction('punch', true);
  }, { passive: false });
}

// Initialize camera position once model is loaded
function initializeCamera() {
  if (model) {
    // Position camera closer to player for a more immersive view (similar to Chivalry 2)
    camera.position.set(0, 2.9, 5.5); // Adjusted distance (z=5.5) with height (y=2.9)
    camera.lookAt(model.position.x, model.position.y + 1.75, model.position.z); // Updated lookAt target to 1.75
  }
}

// Performance monitoring variables
let frameCount = 0;
let lastFpsUpdate = 0;
let fps = 0;
const FPS_UPDATE_INTERVAL = 1000; // Update FPS every second
let lastTime = 0;

// Create zombie targets at predefined positions around the map
function createZombieTargetsInMap() {
  // Define positions for zombie targets - y value is set to match the map's ground level
  const targetPositions = [
    { x: 8, y: -9.0, z: -5, rotation: Math.PI * 0.75 },  // Front right
    { x: 2, y: -9.0, z: -8, rotation: Math.PI * 0.5 },   // Front left
    { x: -5, y: -9.0, z: -2, rotation: Math.PI * 0.25 }, // Back left
    { x: -3, y: -9.0, z: 5, rotation: 0 },              // Back right
    { x: 10, y: -9.0, z: 3, rotation: Math.PI }          // Far right
  ];
  
  // Create the targets
  zombieTargets = createZombieTargets(scene, targetPositions);
  console.log(`Created ${zombieTargets.length} zombie targets`);
}

// Check if the player's punch hits any zombie targets
function checkPunchHits() {
  if (!model || !isPunching) return;
  
  // Get the player's position and forward direction
  const playerPosition = model.position.clone();
  
  // Calculate punch position (slightly in front of player)
  const punchDirection = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), model.rotation.y);
  const punchPosition = playerPosition.clone().add(punchDirection.multiplyScalar(1.5));
  
  // Check each target to see if it's in range
  zombieTargets.forEach(target => {
    if (target.isInHitRange(punchPosition, PUNCH_RANGE)) {
      // Hit the target
      const wasHit = target.hit();
      if (wasHit) {
        console.log('Hit zombie target!');
      }
    }
  });
  
  // Reset punching state after a short delay
  setTimeout(() => {
    isPunching = false;
  }, 200);
}

function animate() {
  requestAnimationFrame(animate);
  
  // Get delta time for smooth animation
  const currentTime = performance.now();
  const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
  lastTime = currentTime;
  
  // Update collision debug visualization if enabled
  if (collisionDebugEnabled && collisionDebugger) {
    collisionDebugger.update();
  }
  
  // Update FPS counter
  frameCount++;
  const now = performance.now();
  if (now - lastFpsUpdate > FPS_UPDATE_INTERVAL) {
    fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
    frameCount = 0;
    lastFpsUpdate = now;
    console.log(`FPS: ${fps}`);
  }
  
  // Update zombie targets
  if (zombieTargets && zombieTargets.length > 0) {
    zombieTargets.forEach(target => {
      if (target) target.update(deltaTime);
    });
  }
  
  if (mixer && mixer.clock) {
    const delta = mixer.clock.getDelta();
    mixer.update(delta);
    updateMovement(delta);
    
    // Only update shadows every 10 frames on mobile for better performance
    if (!isMobile() || frameCount % 10 === 0) {
      throttledShadowUpdate();
    }
    
    // Third-person camera positioning
    if (model) {
      // Different camera behavior for mobile and desktop
      if (isMobile()) {
        // Mobile: Camera follows character rotation with a more distant perspective for better visibility
        const cameraDistance = 3.5; // Increased from 2.2 to 3.5 for a more distant view on mobile
        const cameraHeight = 1.7; // Camera height set to 1.7
        
        // On mobile, we want the camera to stay centered behind the character
        // Get the character's current rotation
        const characterRotation = model.rotation.y;
        
        // Always try to stay behind character, even during turns
        const targetAngle = characterRotation + Math.PI; // PI = 180 degrees (behind character)
        
        // Auto-rotate camera based on movement direction on mobile - with time delay and smoother adjustment
        const currentTime = performance.now();
        
        // Track previous movement state (declare before using)
        const wasMoveLeft = move.left;
        const wasMoveRight = move.right;
        
        // Detect direction changes to reset the delay timer
        if ((move.left && !wasMoveLeft) || (move.right && !wasMoveRight)) {
          lastDirectionChangeTime = currentTime;
        }
        
        // Only adjust camera after delay has passed
        if (currentTime - lastDirectionChangeTime > cameraAdjustmentDelay) {
          if (move.left) {
            // Rotate camera left but with much gentler rotation speed
            targetCameraYaw += 0.008; // Further reduced for even smoother rotation
            // Blend with character rotation to maintain behind position - reduced lerp factor
            targetCameraYaw = lerpAngle(targetCameraYaw, targetAngle, 0.04); // Further reduced for smoother transitions
          } else if (move.right) {
            // Rotate camera right but with much gentler rotation speed
            targetCameraYaw -= 0.008; // Further reduced for even smoother rotation
            // Blend with character rotation to maintain behind position - reduced lerp factor
            targetCameraYaw = lerpAngle(targetCameraYaw, targetAngle, 0.04); // Further reduced for smoother transitions
          } else {
            // When not actively turning, very gradually align camera with character facing direction
            targetCameraYaw = lerpAngle(targetCameraYaw, targetAngle, 0.025); // Further reduced for even smoother return
          }
        }
        
        // Normalize camera yaw
        targetCameraYaw = normalizeAngle(targetCameraYaw);
        cameraYaw = lerpAngle(cameraYaw, targetCameraYaw, 0.08); // Increased from 0.06 to 0.08 for slightly more responsive rotation
        
        // Calculate camera position with the auto-rotated angle and mobile-specific pitch
        const cameraOffset = new THREE.Vector3(
          Math.sin(cameraYaw) * Math.cos(mobileCameraPitch) * cameraDistance,
          Math.sin(mobileCameraPitch) * cameraDistance + cameraHeight,
          Math.cos(cameraYaw) * Math.cos(mobileCameraPitch) * cameraDistance
        );
        
        // Target position (above character) with smooth, limited vertical movement during jumps
        let targetY = model.position.y + 1.75; // Default target height
        
        // If jumping, smoothly limit how much the camera target can move up
        if (isJumping) {
          // Calculate how much the target would move up from its original position
          const targetYOffset = targetY - originalCameraTargetY;
          
          // Limit the upward movement to MAX_CAMERA_TARGET_OFFSET
          if (targetYOffset > 0) {
            // Calculate desired target Y with limitation
            const limitedTargetY = originalCameraTargetY + Math.min(targetYOffset, MAX_CAMERA_TARGET_OFFSET);
            
            // Smoothly interpolate to the new target Y (prevents jerky camera)
            smoothCameraTargetY = smoothCameraTargetY * 0.85 + limitedTargetY * 0.15; // Faster camera response
            targetY = smoothCameraTargetY;
          }
        } else {
          // When not jumping, smoothly reset the camera target
          smoothCameraTargetY = targetY;
        }
        
        const targetPosition = new THREE.Vector3(model.position.x, targetY, model.position.z);
        
        // Set camera position and look at target
        const cameraTargetPosition = new THREE.Vector3().copy(targetPosition).add(cameraOffset);
        
        // Balanced camera movement on mobile for natural feel but still responsive
        camera.position.lerp(cameraTargetPosition, 0.15); // Increased from 0.1 to 0.15 for slightly more responsive movement
        camera.lookAt(targetPosition);
      } else {
        // Desktop: Mouse-controlled camera with Chivalry 2-like close perspective
        const cameraDistance = 2.2; // Adjusted camera distance to 2.2
        const cameraHeight = 1.7; // Camera height set to 1.7
        const cameraOffset = new THREE.Vector3(
          Math.sin(cameraYaw) * Math.cos(cameraPitch) * cameraDistance,
          Math.sin(cameraPitch) * cameraDistance + cameraHeight,
          Math.cos(cameraYaw) * Math.cos(cameraPitch) * cameraDistance
        );
        
        // Target position (above character) with smooth, limited vertical movement during jumps
        let targetY = model.position.y + 1.75; // Default target height
        
        // If jumping, smoothly limit how much the camera target can move up
        if (isJumping) {
          // Calculate how much the target would move up from its original position
          const targetYOffset = targetY - originalCameraTargetY;
          
          // Limit the upward movement to MAX_CAMERA_TARGET_OFFSET
          if (targetYOffset > 0) {
            // Calculate desired target Y with limitation
            const limitedTargetY = originalCameraTargetY + Math.min(targetYOffset, MAX_CAMERA_TARGET_OFFSET);
            
            // Smoothly interpolate to the new target Y (prevents jerky camera)
            smoothCameraTargetY = smoothCameraTargetY * 0.85 + limitedTargetY * 0.15; // Faster camera response
            targetY = smoothCameraTargetY;
          }
        } else {
          // When not jumping, smoothly reset the camera target
          smoothCameraTargetY = targetY;
        }
        
        const targetPosition = new THREE.Vector3(model.position.x, targetY, model.position.z);
        
        // Set camera position and look at target
        const cameraTargetPosition = new THREE.Vector3().copy(targetPosition).add(cameraOffset);
        
        // Smooth camera movement on desktop
        camera.position.lerp(cameraTargetPosition, 0.05);
        camera.lookAt(targetPosition);
      }
    }
  }
  renderer.render(scene, camera);
}

animate();
