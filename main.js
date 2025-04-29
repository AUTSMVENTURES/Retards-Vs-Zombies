// Entry point for Three.js fighting game
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'; // Use 'addons' for Vite/Three.js >=0.150.0
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // Import GLTFLoader for GLB files
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'; // Import DRACOLoader for compressed models
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'; // Import SkeletonUtils
import { loadCollisionMap, adjustMovementForCollisions, createCollisionDebugger, findGroundHeight } from './collision.js';
import { ZombieTarget, createZombieTargets } from './zombie-target.js';
import { MultiplayerManager } from './multiplayer.js'; // Corrected named import

// Declare multiplayerManager globally but initialize later
let multiplayerManager = null;

// Initialize scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5); // Original sky color

const camera = new THREE.PerspectiveCamera(88, window.innerWidth / window.innerHeight, 0.1, 1000);
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

// --- Editable Camera Settings ---
// Moved up here to ensure they are initialized before UI elements use them
let editableCameraDistance = isMobile() ? 5.0 : 1.77; // Initial distance (Desktop: 1.77)
let editableCameraHeightOffset = isMobile() ? 5.0 : 2.14; // Initial height offset (Desktop: 2.14)
let editableCameraLookAtYOffset = 2.04; // Initial look-at Y offset (2.04)
// --- End Editable Camera Settings ---

// Debug overlay for yaw/pitch and player coordinates
const debugDiv = document.createElement('div');
debugDiv.style.cssText = 'position:absolute;top:4px;left:4px;color:#fff;background:rgba(0,0,0,0.5);padding:4px;font-size:12px;z-index:1000';
document.body.appendChild(debugDiv);

// Separate div for player coordinates
const coordsDiv = document.createElement('div');
coordsDiv.style.cssText = 'position:absolute;top:24px;left:4px;color:#fff;background:rgba(0,0,0,0.5);padding:4px;font-size:12px;z-index:1000';
document.body.appendChild(coordsDiv);

// FPS counter div
const fpsDiv = document.createElement('div');
fpsDiv.style.cssText = 'position:absolute;top:44px;left:4px;color:#fff;background:rgba(0,0,0,0.5);padding:4px;font-size:12px;z-index:1000';
document.body.appendChild(fpsDiv);

// Container for camera control inputs
const cameraDebugDiv = document.createElement('div');
cameraDebugDiv.style.cssText = 'position:absolute; top:64px; left:4px; color:#fff; background:rgba(0,0,0,0.5); padding:4px; font-size:12px; z-index:1000; display: flex; flex-direction: column; gap: 2px;';
document.body.appendChild(cameraDebugDiv);

// Helper function to create labeled input fields
function createCameraInput(labelText, initialValue, onChangeCallback) {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.justifyContent = 'space-between';
  container.style.alignItems = 'center';

  const label = document.createElement('label');
  label.textContent = labelText + ':';
  label.style.marginRight = '5px';

  const input = document.createElement('input');
  input.type = 'number';
  input.step = '0.1'; // Allow decimal adjustments
  input.value = initialValue.toFixed(2); // Set initial value
  input.style.cssText = 'width: 50px; background: rgba(255,255,255,0.1); color: #fff; border: 1px solid #555; padding: 1px 3px; font-size: 11px;';
  input.addEventListener('change', (event) => {
    const newValue = parseFloat(event.target.value);
    if (!isNaN(newValue)) {
      onChangeCallback(newValue);
    }
  });
  input.addEventListener('input', (event) => { // Update on input as well for responsiveness
    const newValue = parseFloat(event.target.value);
    if (!isNaN(newValue)) {
      onChangeCallback(newValue);
    }
  });

  container.appendChild(label);
  container.appendChild(input);
  cameraDebugDiv.appendChild(container);
  return input; // Return the input element for potential updates
}

// Create the input fields
const inputCamDist = createCameraInput('Distance', editableCameraDistance, (val) => { editableCameraDistance = val; });
const inputCamHeight = createCameraInput('HeightOff', editableCameraHeightOffset, (val) => { editableCameraHeightOffset = val; });
const inputLookAtY = createCameraInput('LookAtYOff', editableCameraLookAtYOffset, (val) => { editableCameraLookAtYOffset = val; });

let lastDebugUpdate = 0;

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

// Mobile detection function (more reliable version)
function isMobile() {
  // Rely on user agent and touch event support
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         ('ontouchstart' in window);
}

// Explicitly show/hide mobile controls based on detection
document.addEventListener('DOMContentLoaded', () => {
  const mobileControlsDiv = document.getElementById('mobile-controls');
  if (mobileControlsDiv) {
    if (isMobile()) {
      console.log('[main.js] Mobile detected, showing controls.');
      mobileControlsDiv.style.display = 'block'; // Or 'flex' if needed, but block should work for the container
    } else {
      console.log('[main.js] Desktop detected, hiding controls.');
      mobileControlsDiv.style.display = 'none';
    }
  } else {
    console.warn('[main.js] Mobile controls container (#mobile-controls) not found.');
  }
});

// Load the main menu map model
let mainMap;
const mapLoader = new FBXLoader();

// Set up GLTF loader with Draco compression support
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('./draco/'); // Path to the Draco decoder files using relative path
gltfLoader.setDRACOLoader(dracoLoader);

// Load collision map (using same model as visual map)
loadCollisionMap('./models/mainmenu.fbx', (collisionMap) => {
  console.log('Collision map loaded');
  // Add collision map to scene but make it invisible
  scene.add(collisionMap);
});

// Global variable for zombie animation mixer
let zombieMixer;
let zombieModel;

// Multiplayer: Map to store other player models { sessionId: model }
let otherPlayerModels = new Map();

// Performance monitoring variables
let frameCount = 0;
let lastFpsUpdate = 0;
let fps = 0;
const FPS_UPDATE_INTERVAL = 1000; // Update FPS every second
let lastTime = performance.now();

// Multiplayer variables
let otherPlayers = new Map();
let isMultiplayerConnected = false;
let lastUpdateSent = 0;
const UPDATE_INTERVAL = 50; // Send updates every 50ms (20 times/second)
let lastTimedNetworkUpdate = 0; // New global variable for timed updates

// === Multiplayer Callback Functions ===
function handlePlayerAdd(sessionId, playerData) {
  // --- Add check to Ignore adding the local player model again ---
  if (multiplayerManager && sessionId === multiplayerManager.getSessionId()) {
     console.log('[main.js] handlePlayerAdd: Ignoring call for local player.');
     return;
  }
  // --- End Check ---

  console.log(`[main.js] handlePlayerAdd called for sessionId: ${sessionId} with playerData:`, JSON.stringify(playerData));
  try {
    // Check if model already exists (should ideally not happen if logic is correct)
    if (otherPlayerModels.has(sessionId)) {
      console.log(`[main.js] Model for sessionId ${sessionId} already exists, skipping`);
      return;
    }

    const otherPlayerModel = SkeletonUtils.clone(model);
    // Apply same material/shadow settings as base model to the clone
    otherPlayerModel.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // Make material whiter and rougher
        if (child.material) {
          // Handle array of materials
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.color = new THREE.Color(0xffffff); // Pure white
              mat.roughness = 0.8; // Rougher surface
              mat.metalness = 0.1; // Less metallic
            });
          } else {
            // Single material
            child.material.color = new THREE.Color(0xffffff); // Pure white
            child.material.roughness = 0.8; // Rougher surface
            child.material.metalness = 0.1; // Less metallic
          }
        }
      }
    });

    // --- Animation Setup for Cloned Model --- 
    const otherMixer = new THREE.AnimationMixer(otherPlayerModel);
    const otherActions = {};
    
    // Loop through original actions, create new actions for the clone using the same clips
    if (mixer && actions) { // Ensure base mixer/actions are loaded
      Object.keys(actions).forEach(animName => {
        const originalAction = actions[animName];
        if (originalAction) {
          const clip = originalAction.getClip();
          otherActions[animName] = otherMixer.clipAction(clip);

          // Apply same clamp settings
          if (animName === 'punch' || animName === 'hit' || animName === 'jump') {
            otherActions[animName].clampWhenFinished = false;
          }
        }
      });
    }

    // Store mixer and actions in userData
    otherPlayerModel.userData.mixer = otherMixer;
    otherPlayerModel.userData.actions = otherActions;
    
    // Start with idle animation if available
    if (otherActions['idle']) {
        otherActions['idle'].play();
    }
    // --- End Animation Setup ---

    // Store the initial animation state
    otherPlayerModel.userData.currentAnimation = 'idle';
    
    otherPlayerModel.uuid = `player-${sessionId}`; // Assign unique ID

    console.log(`[main.js] Cloned model for ${sessionId}. Initial props: pos=${otherPlayerModel.position.toArray().join(',')}, rot.y=${otherPlayerModel.rotation.y.toFixed(2)}, scale=${otherPlayerModel.scale.toArray().join(',')}, visible=${otherPlayerModel.visible}`);

    // Set initial position and rotation based on received data
    // Ensure playerData has valid coordinates, fallback to 0,0,0 if not
    const x = typeof playerData.x === 'number' ? playerData.x : 0;
    const y = typeof playerData.y === 'number' ? playerData.y : 0;
    const z = typeof playerData.z === 'number' ? playerData.z : 0;
    const rotY = typeof playerData.rotationY === 'number' ? playerData.rotationY : 0;

    otherPlayerModel.position.set(x, y, z); // Use received position
    otherPlayerModel.rotation.y = rotY;
    otherPlayerModel.visible = true; // Explicitly ensure visibility
    otherPlayerModel.scale.set(0.012, 0.012, 0.012); // Match base model scale

    console.log(`[main.js] Model props AFTER setting from data: pos=${otherPlayerModel.position.toArray().join(',')}, rot.y=${otherPlayerModel.rotation.y.toFixed(2)}, scale=${otherPlayerModel.scale.toArray().join(',')}, visible=${otherPlayerModel.visible}`);

    // Log model before adding and scene children count
    console.log('[main.js] Model object before adding:', otherPlayerModel); 
    console.log(`[main.js] Scene children count BEFORE add: ${scene.children.length}`);
    // Add the model to the scene
    scene.add(otherPlayerModel);
    console.log(`[main.js] Scene children count AFTER add: ${scene.children.length}`);

    // Log camera state
    console.log(`[main.js] Camera state: Pos=(${camera.position.toArray().map(p => p.toFixed(2)).join(',')}), Near=${camera.near}, Far=${camera.far}`);

    // Store target state for interpolation
    otherPlayerModel.userData.targetPosition = new THREE.Vector3().copy(otherPlayerModel.position);
    otherPlayerModel.userData.targetRotationY = otherPlayerModel.rotation.y;
    // We'll handle animation changes separately if needed

    // Store the model reference
    otherPlayerModels.set(sessionId, otherPlayerModel);
    console.log(`[main.js] Model added for sessionId ${sessionId}`);
  } catch (error) {
    console.error(`[main.js] Error adding player model for sessionId ${sessionId}:`, error);
  }
}
function handlePlayerChange(sessionId, playerState) {
  // --- Add check to Ignore updates for the local player ---
  // Ensure multiplayerManager exists before accessing getSessionId()
  if (multiplayerManager && sessionId === multiplayerManager.getSessionId()) {
     // console.log('[DEBUG] Ignoring state change for local player.');
     return;
  }
  console.log(`[DEBUG] Processing state change for REMOTE player: ${sessionId}`, JSON.stringify(playerState)); // Log received state

  const otherModel = otherPlayerModels.get(sessionId);

  if (!otherModel) {
    // Corrected log message for clarity
    console.warn(`[main.js] Received change for unknown player model: ${sessionId}`); 
    return; 
  }
  console.log(`[DEBUG] Found model for ${sessionId}`); // Log model found

  // --- Update Target State for Interpolation ---
  // Initialize targetPosition if it doesn't exist
  if (!otherModel.userData.targetPosition) {
    console.log(`[DEBUG] Initializing targetPosition for ${sessionId}`);
    otherModel.userData.targetPosition = new THREE.Vector3();
  }
  
  // Check if position data exists in the update before applying
  if (playerState.x !== undefined && playerState.y !== undefined && playerState.z !== undefined) {
    console.log(`[DEBUG] Updating targetPosition for ${sessionId} to: x=${playerState.x}, y=${playerState.y}, z=${playerState.z}`); // Log position update
    otherModel.userData.targetPosition.set(playerState.x, playerState.y, playerState.z);
  } else {
    // Log if position data is missing (helps debug server sending incomplete state)
    // console.log(`[DEBUG] Position data (x, y, z) missing in state update for ${sessionId}`); 
  }
  
  // Check if rotation data exists before applying
  if (playerState.rotationY !== undefined) {
    console.log(`[DEBUG] Updating targetRotationY for ${sessionId} to: ${playerState.rotationY}`); // Log rotation update
    otherModel.userData.targetRotationY = playerState.rotationY;
  } else {
     // Log if rotation data is missing
    // console.log(`[DEBUG] Rotation data (rotationY) missing in state update for ${sessionId}`);
  }

  // --- Handle Animation Changes ---
  // Ensure actions exist on the model and the new animation is different
  if (playerState.animation && otherModel.userData.actions && otherModel.userData.currentAnimation !== playerState.animation) {
    console.log(`[DEBUG] Received animation update for ${sessionId}: ${playerState.animation}`); // Log animation update
    const oldAnimationName = otherModel.userData.currentAnimation;
    const newAnimationName = playerState.animation;

    const oldAction = otherModel.userData.actions[oldAnimationName];
    const newAction = otherModel.userData.actions[newAnimationName];

    if (newAction) {
      // Fade out the old action if it exists
      if (oldAction) {
        oldAction.fadeOut(0.2); // Adjust fade duration as needed
      }

      // Prepare and fade in the new action
      // Basic loop handling - assume repeat unless specified (improve later if needed)
      const loopMode = (newAnimationName === 'punch' || newAnimationName === 'hit' || newAnimationName === 'jump') 
                       ? THREE.LoopOnce 
                       : THREE.LoopRepeat;

      newAction.reset()
        .setLoop(loopMode, Infinity) // Use Infinity for LoopRepeat, 1 for LoopOnce (will be handled by clampWhenFinished if needed)
        .setEffectiveWeight(1.0)
        .setEffectiveTimeScale(1.0) // Ensure normal playback speed
        .fadeIn(0.2) // Adjust fade duration
        .play();

      // If LoopOnce, ensure it stops at the end
      if (loopMode === THREE.LoopOnce) {
        newAction.clampWhenFinished = true;
      }

      // Update the current animation tracker
      otherModel.userData.currentAnimation = newAnimationName;
      
      // AUTO-TRANSITION: Set a timeout to return to idle after punch completes
      if (newAnimationName === 'punch' || newAnimationName === 'hit') {
        // Clear any existing animation timeout
        if (otherModel.userData.animationTimeout) {
          clearTimeout(otherModel.userData.animationTimeout);
          otherModel.userData.animationTimeout = null;
        }
        
        // Set timeout to auto-transition back to idle
        const REMOTE_PUNCH_DURATION = 600; // ms - slightly longer than local punch to account for network delay
        otherModel.userData.animationTimeout = setTimeout(() => {
          console.log(`[DEBUG] Auto-transitioning ${sessionId} from ${newAnimationName} back to idle`);
          
          // Get the actions
          const punchAction = otherModel.userData.actions[newAnimationName];
          const idleAction = otherModel.userData.actions['idle'];
          
          if (punchAction && idleAction && otherModel.userData.currentAnimation === newAnimationName) {
            // Fade out punch animation
            punchAction.fadeOut(0.2);
            
            // Fade in idle animation
            idleAction.reset()
              .setLoop(THREE.LoopRepeat, Infinity)
              .setEffectiveWeight(1.0)
              .fadeIn(0.2)
              .play();
              
            // Update the current animation tracker
            otherModel.userData.currentAnimation = 'idle';
          }
        }, REMOTE_PUNCH_DURATION);
      }
      
      // console.log(`[main.js] Player ${sessionId} changing animation: ${oldAnimationName} -> ${newAnimationName}`);
    } else {
      console.warn(`[main.js] Animation '${newAnimationName}' not found for player ${sessionId}`);
    }
  } else if (playerState.animation && !otherModel.userData.actions) {
      // Log if animation update received but actions aren't set up on the model yet
      console.warn(`[DEBUG] Received animation update for ${sessionId} but otherModel.userData.actions is not ready.`);
  }
}

function handlePlayerRemove(sessionId) {
  console.log(`[main.js] handlePlayerRemove called for sessionId: ${sessionId}`);
  console.log(`Removing player model for ${sessionId}`);
  const otherModel = otherPlayerModels.get(sessionId);
  if (otherModel) {
    scene.remove(otherModel);
    otherPlayerModels.delete(sessionId);
  }
}
// =====================================

// Load the bottom plaque with minimal code
gltfLoader.load('./models/lowpolybottomplaque.glb', (gltf) => {
  const plaque = gltf.scene;
  plaque.position.set(9.36, 1.11, -42.58);
  plaque.rotation.y = Math.PI * 1.60; // Rotated to directly face player
  scene.add(plaque);
});

// Load the info sign and place it at the specified coordinates
gltfLoader.load('./models/lowpolyinfosign1.glb', (gltf) => {
  const infoSign = gltf.scene;
  infoSign.position.set(-2.51, 0.08, -1.90); // Placing at the exact coordinates
  infoSign.rotation.y = Math.PI * 0.75; // Angled to be visible from common approach paths
  
  // Ensure proper shadows
  infoSign.traverse(child => {
    if (child.isMesh) {
      console.log(`Processing banner mesh: ${child.name}`);
      child.castShadow = true;  // Don't cast shadows
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
  scene.add(infoSign);
  console.log('Info sign placed at X: -2.51, Y: 0.08, Z: -1.90');
});

// Load the slobber zombie model
gltfLoader.load('./models/slobberzombienewrig.glb', (gltf) => {
  console.log('Slobber zombie model loaded');
  zombieModel = gltf.scene;
  
  // Set position based on the coordinates from the screenshot
  zombieModel.position.set(8.29, 1.08, -49.14);
  
  // Take the scale down by half as requested
  zombieModel.scale.set(0.5, 0.5, 0.5);
  
  // Make sure the zombie casts and receives shadows
  zombieModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  // Add to scene
  scene.add(zombieModel);
  console.log('Slobber zombie added to scene at position:', zombieModel.position);
  
  // Set up animation mixer for the zombie
  zombieMixer = new THREE.AnimationMixer(zombieModel);
  
  // Check if there are animations in the model
  if (gltf.animations && gltf.animations.length > 0) {
    console.log(`Found ${gltf.animations.length} animations in the zombie model`);
    
    // Play the first animation (usually the idle animation) at reduced speed (0.6)
    const zombieAction = zombieMixer.clipAction(gltf.animations[0]);
    zombieAction.timeScale = 0.6; // Reduce animation speed to 60% of normal
    zombieAction.play();
    
    // Log the names of all available animations
    gltf.animations.forEach((clip, index) => {
      console.log(`Animation ${index}: ${clip.name}`);
    });
  } else {
    console.warn('No animations found in the zombie model');
  }
}, undefined, (error) => {
  console.error('Error loading slobber zombie model:', error);
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
camera.position.set(0, 1, 7); // Adjusted distance (z=7) with height (y=1)
camera.lookAt(0, 2.75, 0); // Updated lookAt target to 2.75

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
let currentActionName = null; // Tracks the current movement action name sent to the server
const loader = new FBXLoader();

// Collision detection
let collisionDebugger;
let collisionDebugEnabled = false;
const moveVector = new THREE.Vector3();

// Movement flags for WASD controls
const move = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

// Flag to track if mobile controls are active
let isMobileControlActive = false;
let velocity = new THREE.Vector3();
const moveSpeed = 0.08;
const rotateSpeed = 0.003; // Restore original rotation speed for smoother movement

let isJumping = false;
let isPrepareJumping = false; // New state for jump preparation/crouch
let jumpHeight = 0.0;
let jumpVelocity = 0.0;
const GRAVITY = 2.68; // Increased gravity for snappier falls
const JUMP_DURATION = 600; // Jump arc duration in ms
const MAX_JUMP_HEIGHT = 1.0; // Peak height of jump (units)
function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
function easeInQuad(t)  { return t * t; }
const JUMP_FORCE = 0.40; // Stronger jump force for test
const JUMP_FORCE_STATIONARY = 0.40; // Stronger stationary jump force for test
const MAX_JUMP_HEIGHT_STATIONARY = 0.3; // Reduced max height for stationary jumps to 1.5
const MAX_JUMP_HEIGHT_MOVING = 0.3; // Reduced max height for moving jumps to 1.5
let currentMaxJumpHeight = MAX_JUMP_HEIGHT_STATIONARY; // Will be set at jump initiation
const MAX_JUMP_DURATION = 3000; // Jump completes in 3 seconds
let jumpStartTime = 0; // Track when the jump started
let jumpPrepStartTime = 0; // Track when jump preparation started
const JUMP_PREP_TIME = 64; // Reduced to 64ms of preparation/wind-up before jumping
let lastGroundY = 0; // Store the last ground position
let jumpBaseY = 0; // New state for jump base Y
const MAX_CAMERA_TARGET_Y_ABOVE_GROUND = 1.9; // Midpoint clamp for balanced look-up
const pitchLimit = Math.PI / 3; // Limit up/down look angle
let mouseSensitivity = 0.7; // Reduced sensitivity for less abrupt changes

// Jump cooldown settings
let lastJumpTime = 0; // timestamp of last jump
const jumpCooldown = 300; // ms between jumps

// Target rotation angles for smooth damping
let targetCameraYaw = 0;
let targetCameraPitch = 0; // Set initial pitch to 0 for testing

// Camera control variables
let cameraYaw = 0; // Start facing character's back
let cameraPitch = 0; // Set initial pitch to 0 for testing
let lastPitchInput = 0; // Track last pitch input from mouse for resting bias

// Mobile-specific camera pitch (will be used only on mobile devices)
let mobileCameraPitch = -0.48; // Steeper downward angle to balance the higher lookAt target

// --- Editable Camera Settings ---
//let editableCameraDistance = isMobile() ? 5.0 : 2.8; // Initial distance based on platform
//let editableCameraHeightOffset = isMobile() ? 5.0 : 0.9; // Initial height offset
//let editableCameraLookAtYOffset = 1.75; // Initial look-at Y offset
// --- End Editable Camera Settings ---

// Variables for delayed camera adjustment on mobile
let lastDirectionChangeTime = 0;
let cameraAdjustmentDelay = 200; // Reduced from 300ms to 200ms for slightly more responsive adjustment

// Normalize angle to -π to π range to prevent discontinuities
function normalizeAngle(angle) {
  // Ensure angle is in the range of -π to π
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

// Previous camera yaw for calculating delta
let prevCameraYaw = 0;
let cameraSmoothingFactor = 0.1;

// Mouse movement handler with improved rotation and damping
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    // Store previous camera yaw
    prevCameraYaw = cameraYaw;
    
    // Calculate new target rotation values
    const yawDelta = -e.movementX * rotateSpeed * mouseSensitivity;
    const pitchDelta = e.movementY * rotateSpeed * mouseSensitivity;
    
    // Limit rotation speed to prevent extreme jumps
    const maxDeltaPerFrame = 0.10; // Adjusted to create smoother turning like in main_original.js
    const clampedYawDelta = Math.max(-maxDeltaPerFrame, Math.min(maxDeltaPerFrame, yawDelta));
    const clampedPitchDelta = Math.max(-maxDeltaPerFrame, Math.min(maxDeltaPerFrame, pitchDelta));
    
    // Apply to target rotation
    targetCameraYaw += clampedYawDelta; // REVERTED: Use clamped yaw delta with higher limit
    targetCameraPitch += clampedPitchDelta; // RE-ENABLED pitch calculation using clamped delta
    // Remember last pitch input magnitude
    lastPitchInput = clampedPitchDelta; // RE-ENABLED tracking last pitch input
    
    // Normalize target yaw to prevent 360° spins
    targetCameraYaw = normalizeAngle(targetCameraYaw);
    
    // Clamp target pitch to prevent camera flipping
    // targetCameraPitch = Math.max(-pitchLimit, Math.min(pitchLimit, targetCameraPitch)); // Commented out for testing
    targetCameraPitch = Math.max(-pitchLimit, Math.min(pitchLimit, targetCameraPitch)); // RE-ENABLED pitch clamping
  }
});

// Load main character model
loader.load('/models/ifindretards.fbx', (fbx) => {
  model = fbx;
  model.scale.set(0.012, 0.012, 0.012); // Reasonable scale
  model.position.set(0, 0, 0);
  model.rotation.y = Math.PI; // Initial facing direction (away from camera)
  model.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      
      // Make material whiter and rougher
      if (child.material) {
        // Handle array of materials
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => {
            mat.color = new THREE.Color(0xffffff); // Pure white
            mat.roughness = 0.8; // Rougher surface
            mat.metalness = 0.1; // Less metallic
          });
        } else {
          // Single material
          child.material.color = new THREE.Color(0xffffff); // Pure white
          child.material.roughness = 0.8; // Rougher surface
          child.material.metalness = 0.1; // Less metallic
        }
      }
    }
  });
  scene.add(model);

  mixer = new THREE.AnimationMixer(model);
  mixer.clock = new THREE.Clock(); // Ensure clock exists
  
  // Create collision debugger now that model is loaded
  collisionDebugger = createCollisionDebugger(scene, model);
  collisionDebugger.setVisible(false); // Hidden by default
  
  // Initialize camera position once model is loaded
  initializeCamera();

  // Create zombie targets around the map
  createZombieTargetsInMap();

  // Initialize multiplayer connection
  initializeMultiplayer();

  // Load animations
  const animations = [
    { name: 'idle', file: 'ifindretardsidle.fbx' },
    { name: 'punch', file: 'ifindretardspunching.fbx' },
    { name: 'torso_punch', file: 'ifindretardspunchingtorso.fbx' },
    { name: 'walk', file: 'ifindretardswalkinginplace.fbx' },
    { name: 'strafe_left', file: 'ifindretardsleftstrafe.fbx' },
    { name: 'strafe_right', file: 'ifindretardsrightstrafe.fbx' },
    { name: 'hit', file: 'ifindretardshitstomach.fbx' },
    { name: 'jump', file: 'ifindretardsjumpunarmed.fbx' }
  ];

  let loaded = 0;
  animations.forEach(anim => {
    // Use absolute path format for better compatibility with Vite production builds
    loader.load(`/models/${anim.file}`, (animFBX) => {
      const clip = animFBX.animations[0];
      
      // Clean up animation tracks to remove bones that don't exist in the model
      if (anim.name === 'jump') {
        // Filter out tracks that reference bones that don't exist in the model
        const validTracks = [];
        for (let i = 0; i < clip.tracks.length; i++) {
          const track = clip.tracks[i];
          // Skip tracks with names containing "_end_end_end" which cause warnings
          if (!track.name.includes('_end_end_end')) {
            validTracks.push(track);
          }
        }
        clip.tracks = validTracks;
      }
      
      actions[anim.name] = mixer.clipAction(clip);
      
      // Set clampWhenFinished to prevent returning to T-pose
      if (anim.name === 'punch' || anim.name === 'hit' || anim.name === 'jump') {
        actions[anim.name].clampWhenFinished = true;
      }
      
      loaded++;
      if (loaded === animations.length) {
        setAction('idle');
      }
    });
  });
}, undefined, (err) => {
  console.error('Error loading main model:', err);
});

// Animation state tracking
let previousAction = null;
let isOneShot = false;

// Track upper body actions separately from movement
let upperBodyAction = null;
let lowerBodyAction = null;
let punchTimeout = null;
const PUNCH_DURATION = 512; // set to exactly 512ms as requested

// Zombie target management
let zombieTargets = [];
let isPunching = false;
let isPunchAnimationComplete = true; // New flag to track complete punch cycle
const PUNCH_RANGE = 2.5; // How far the punch can reach
const PUNCH_COOLDOWN = 500; // Milliseconds between punches
let lastPunchTime = 0;

// Variables for tracking key press times for A+S+D handling
const keyPressTimes = {
  KeyA: 0,
  KeyS: 0,
  KeyD: 0
};
let allThreeKeysHeldStartTime = null; // When all three keys were first held together

// Bone names for Mixamo upper body isolation
const upperBodyBones = [
  'mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2', 'mixamorigNeck', 'mixamorigHead',
  'mixamorigLeftShoulder', 'mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigLeftHand',
  'mixamorigRightShoulder', 'mixamorigRightArm', 'mixamorigRightForeArm', 'mixamorigRightHand'
];

// Function to isolate upper body bones in an animation with smoother transitions
function isolateUpperBody(action, influence = 1.0, isAdditive = false) {
  if (!action || !model) return;
  
  // Get all tracks in the animation clip
  const tracks = action.getClip().tracks;
  
  // For each track, check if it affects an upper body bone
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const trackName = track.name;
    
    // Check if this track affects an upper body bone
    const isUpperBodyTrack = upperBodyBones.some(boneName => trackName.includes(boneName));
    
    // More nuanced weight application based on bone type
    if (isUpperBodyTrack) {
      // For additive animations, we need more careful weighting to prevent jitter
      if (isAdditive) {
        // Arms and hands get zero influence as requested
        if (trackName.includes('Arm') || trackName.includes('Hand')) {
          // Forearms and hands get 0% influence
          if (trackName.includes('ForeArm') || trackName.includes('Hand')) {
            action.getClip().tracks[i].weight = influence * 0.0; // 0% influence
          } else {
            // Upper arms get 0% influence
            action.getClip().tracks[i].weight = influence * 0.0; // 0% influence
          }
        } else if (trackName.includes('Shoulder')) {
          // Shoulders get 0% influence
          action.getClip().tracks[i].weight = influence * 0.0; // 0% influence
        } else if (trackName.includes('Spine')) {
          // Spine gets 0% influence as requested
          action.getClip().tracks[i].weight = influence * 0.0; // 0% influence
        } else if (trackName.includes('Neck') || trackName.includes('Head')) {
          // Neck and head get 100% influence
          action.getClip().tracks[i].weight = influence * 1.0; // 100% influence
        }
      } else {
        // Original non-additive animation weights - with arms disabled
        if (trackName.includes('Arm') || trackName.includes('Hand')) {
          action.getClip().tracks[i].weight = influence * 0.0; // 0% influence
        } else if (trackName.includes('Shoulder')) {
          action.getClip().tracks[i].weight = influence * 0.0; // 0% influence
        } else if (trackName.includes('Spine') || trackName.includes('Neck')) {
          action.getClip().tracks[i].weight = influence * 0.7;
        } else if (trackName.includes('Head')) {
          action.getClip().tracks[i].weight = influence * 0.5;
        }
      }
    } else if (trackName.includes('Hips')) {
      // Hips get 0% influence in additive mode as requested
      action.getClip().tracks[i].weight = isAdditive ? 0.0 : 0.3;
    } else {
      // Lower body tracks get 0% influence in additive mode as requested
      action.getClip().tracks[i].weight = isAdditive ? 0.0 : 0.05;
    }
  }
}

// Set temporary action (punch, hit) - upper body
function setPunchAction(name) {
  // Don't allow new punch until previous one is completely finished (including fadeout)
  if (!isPunchAnimationComplete) {
    console.log('Punch rejected: Previous punch animation not complete');
    return;
  }
  
  // Determine if the character is currently walking
  const isWalking = lowerBodyAction === actions['walk'];
  
  // Use torso_punch when walking, otherwise use the original punch animation
  const punchName = isWalking && name === 'punch' ? 'torso_punch' : name;
  
  if (!actions[punchName]) return;
  
  // Clear any existing punch timeout
  if (punchTimeout) {
    clearTimeout(punchTimeout);
    punchTimeout = null;
  }
  
  // Set up punch action with enhanced impact but smoother transitions
  const action = actions[punchName];
  
  // Use smoothing parameters appropriate for the animation type
  const isAdditive = punchName === 'torso_punch';
  const fadeInTime = isAdditive ? 0.14 : 0.17; // Quicker fade-in for more responsive punch feel
  const effectiveWeight = isAdditive ? 3.0 : 2.5; // Increased weight for stronger additive punch
  const timeScale = isAdditive ? 1.4 : 1.8; // Torso punch at 1.4x, regular punch restored to 1.8x
  
  action.reset()
    .setLoop(THREE.LoopOnce, 1)
    .setEffectiveWeight(effectiveWeight)
    .fadeIn(fadeInTime)
    .play();
  
  // Adjust animation speed for better fluidity
  action.timeScale = timeScale;
  
  // Explicitly set interpolation mode for smoother animation
  action.interpolationType = THREE.InterpolateSmooth;
  
  // Apply graduated influence to different parts of the upper body
  // Pass the isAdditive flag to use appropriate weighting - increased influence for stronger punch
  isolateUpperBody(action, isAdditive ? 2.8 : 2.8, isAdditive); 
  
  // Ensure it holds the last frame
  action.clampWhenFinished = true;
  
  // Set punching state, animation completion flag, and check for hits on zombie targets
  isPunching = true;
  isPunchAnimationComplete = false; // Mark animation as in-progress
  checkPunchHits();
  
  // Add subtle forward punch step over 300ms - adjust for additive animation
  if ((punchName === 'punch' || punchName === 'torso_punch') && model) {
    const punchDirection = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), model.rotation.y);
    const lungeDistance = 0.1;
    const lungeSteps = 6;
    const stepTime = 300 / lungeSteps;
    const lungePerStep = lungeDistance / lungeSteps;
    for (let i = 0; i < lungeSteps; i++) {
      setTimeout(() => {
        if (model) {
          model.position.addScaledVector(punchDirection, lungePerStep);
        }
      }, i * stepTime);
    }
  }
  
  // Update reference
  upperBodyAction = action;
  
  // Send animation update to server
  if (isMultiplayerConnected && multiplayerManager && multiplayerManager.isConnected()) { // Check instance exists
    multiplayerManager.sendMessage('animation', { animation: punchName });
  }
  
  // Set timeout to clear punch action - with adjusted fadeout time for additive animations
  punchTimeout = setTimeout(() => {
    if (upperBodyAction) {
      // Fadeout time for each animation type
      const fadeOutTime = punchName === 'torso_punch' ? 0.512 : 0.08; // Torso: 512ms, Regular: 80ms
      upperBodyAction.fadeOut(fadeOutTime);
      
      // Set another timeout to ensure we only accept a new punch after complete fadeout
      const totalFadeoutTime = punchName === 'torso_punch' ? 512 : 80; // Convert to milliseconds
      setTimeout(() => {
        upperBodyAction = null;
        isPunching = false;
        isPunchAnimationComplete = true; // Mark animation as fully complete, including fadeout
        console.log('Punch animation fully complete, ready for next punch');
      }, totalFadeoutTime);
    }
  }, PUNCH_DURATION);
}

// Sets the main movement animation (walk, idle, strafe)
function setMovementAction(actionName) {
  if (lowerBodyAction === actions[actionName]) return; // Already playing
  
  const oldAction = lowerBodyAction;
  lowerBodyAction = actions[actionName];
  
  if (oldAction) {
    oldAction.fadeOut(0.2);
  }
  
  if (lowerBodyAction) {
    lowerBodyAction.reset()
      .setEffectiveWeight(1.0)
      .fadeIn(0.2)
      .play();
  }
  
  // If the movement action changed, update the server
  if (actionName !== currentActionName && isMultiplayerConnected && multiplayerManager && multiplayerManager.isConnected()) { // Check instance exists
    multiplayerManager.sendMessage('animation', { animation: actionName });
    currentActionName = actionName; // Update local tracker as well
  }
}

// Main action setter that decides which sub-setter to use
function setAction(name, isTemporary = false) {
  if (name === 'punch' || name === 'hit') {
    // These are temporary upper body actions
    setPunchAction(name);
  } else if (name === 'walk' || name === 'idle' || name === 'strafe_left' || name === 'strafe_right') {
    // These are movement actions
    setMovementAction(name);
    activeAction = actions[name];
  } else if (name === 'jump') {
    if (isTemporary) {
      return;
    }
    // This code path is only used if setAction('jump') is called directly (not from the keydown handler)
    if (activeAction && activeAction !== actions[name]) {
      activeAction.fadeOut(0.1);
    }
    if (actions[name]) {
      actions[name].reset()
        .setLoop(THREE.LoopOnce, 1)
        .setEffectiveTimeScale(0.5) // Slowed jump animation speed as requested
        .setEffectiveWeight(0.7) // Adjust jump animation influence weight to 70%
        .fadeIn(0.1)
        .play();
      
      actions[name].clampWhenFinished = true;
      activeAction = actions[name];
    }
  }
  
  // Send animation change to server if connected
  if (isMultiplayerConnected && multiplayerManager && multiplayerManager.isConnected()) { // Check instance exists
    multiplayerManager.sendMessage('animation', { animation: name });
  }
}

let forwardRampStartTime = null; // Track forward walk ramp start

function updateMovement(delta) {
  if (!model) return;
  const nowMs = performance.now();
  
  // Smoothly interpolate actual camera angles towards biased target
  cameraYaw = lerpAngle(cameraYaw, targetCameraYaw, 0.20); // Adjusted smoothing factor to 0.20
  
  const pitchSmooth = 0.075;
  cameraPitch = lerpAngle(cameraPitch, targetCameraPitch, pitchSmooth);
  
  // Store current horizontal position for tracking movement
  const currentPosition = new THREE.Vector3(model.position.x, 0, model.position.z);
  
  // Handle jump preparation and physics
  const currentTime = performance.now();
  
  // Handle jump preparation phase (crouch)
  if (isPrepareJumping && !isJumping) {
    const prepDuration = currentTime - jumpPrepStartTime;
    
    // When preparation time is complete, initiate the actual jump
    if (prepDuration >= JUMP_PREP_TIME) {
      // Transition from preparation to actual jump
      isPrepareJumping = false;
      isJumping = true;
      jumpVelocity = (move.forward || move.backward || move.left || move.right) ? JUMP_FORCE : JUMP_FORCE_STATIONARY;
      jumpStartTime = currentTime;
      lastJumpTime = currentTime;
      
      // Store current movement state for maintaining momentum while jumping
      const wasMoving = move.forward || move.backward || move.left || move.right;
      
      // Set max jump height based on movement state at jump initiation (most efficient approach)
      currentMaxJumpHeight = wasMoving ? MAX_JUMP_HEIGHT_MOVING : MAX_JUMP_HEIGHT_STATIONARY;
      console.log(`Jump initiated after preparation. Max height: ${currentMaxJumpHeight} (${wasMoving ? 'moving' : 'stationary'})`);      
      
      // Set the ground position to current position to ensure jump works even when moving
      if (model) {
        lastGroundY = model.position.y;
        jumpBaseY = lastGroundY;
      }
      
      // Speed up the animation for the actual jump
      if (actions['jump']) {
        actions['jump'].timeScale = 0.5; // Slowed jump animation speed as requested
      }
    }
  }
  
  // Handle actual jumping physics
  if (isJumping) {
    // Time-based jump with horizontal movement & collision-based landing
    const elapsed = nowMs - jumpStartTime;
    const t = Math.min(elapsed / JUMP_DURATION, 1);
    // Calculate vertical height
    let height = t < 0.5
      ? easeOutQuad(t * 2) * MAX_JUMP_HEIGHT
      : easeInQuad((1 - t) * 2) * MAX_JUMP_HEIGHT;
    
    // Horizontal movement during jump
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camDir.y = 0;
    camDir.normalize();
    const camRight = camDir.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    const dir = new THREE.Vector3();
    if (move.forward) dir.add(camDir);
    if (move.backward) dir.sub(camDir);
    if (move.left) dir.sub(camRight);
    if (move.right) dir.add(camRight);
    if (dir.length() > 0) {
      dir.normalize();
      // Match ground speed scaling (delta*60 for frame-independence)
      const horizDelta = dir.clone().multiplyScalar(moveSpeed * delta * 60);
      const adj = adjustMovementForCollisions(model.position.clone(), horizDelta);
      model.position.x += adj.x;
      model.position.z += adj.z;
    }
    
    // Determine desired Y and check for early landing
    const desiredY = jumpBaseY + height;
    const groundY = findGroundHeight(model.position) ?? jumpBaseY;
    if (t >= 1 || (t > 0.5 && desiredY <= groundY + 0.1)) {
      model.position.y = groundY;
      isJumping = false;
      isPrepareJumping = false;
      // More robust animation transition when landing from jump
      if (actions['jump'] && (activeAction === actions['jump'] || !activeAction)) {
        // First check if we should transition to walk or idle based on movement
        const isMoving = move.forward || move.backward || move.left || move.right;
        const targetActionName = isMoving ? 'walk' : 'idle';
        
        if (actions[targetActionName]) {
          // Make sure the target animation is properly reset and ready
          actions[targetActionName].reset();
          
          // Ensure the jump animation is properly stopped with a crossfade
          actions['jump'].crossFadeTo(actions[targetActionName], 0.2, false);
          
          // Update the active action reference
          activeAction = actions[targetActionName];
          lowerBodyAction = actions[targetActionName];
          
          // Set proper timeScale for walk animation if needed
          if (isMoving && targetActionName === 'walk') {
            if (move.backward && !move.left && !move.right) {
              actions['walk'].timeScale = -0.7; // backward movement
            } else {
              actions['walk'].timeScale = 0.77; // forward or sideways movement
            }
          }
          
          console.log(`Jump landed, transitioning to ${targetActionName} animation`);
        }
      }
    } else {
      model.position.y = desiredY;
    }
    
    // Allow mid-air spin: align character orientation with camera while airborne
    model.rotation.y = lerpAngle(model.rotation.y, targetCameraYaw + Math.PI, 0.1);
    
    // Update collision debugger visuals
    if (collisionDebugger) collisionDebugger.update();
    
    return;
  }
  
  // Ensure camera yaw is normalized for consistent movement direction
  const normalizedCameraYaw = normalizeAngle(cameraYaw);
  
  // Determine movement axes based on actual camera orientation
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  cameraDirection.y = 0;
  cameraDirection.normalize();
  const cameraRight = cameraDirection.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();

  // Forward+strafe: prioritize strafing animation but face forward
  const fwdLeft = move.forward && move.left && !move.right;
  const fwdRight = move.forward && move.right && !move.left;
  if ((fwdLeft || fwdRight) && !isMobileControlActive) {
    // Skip strafing animations on mobile to allow camera rotation
    // Use strafe animation for diagonal movement (desktop only)
    setMovementAction(fwdLeft ? 'strafe_left' : 'strafe_right');
    
    // Restore old behavior: face forward (relative to camera) when moving diagonally forward
    const targetRotation = Math.atan2(cameraDirection.x, cameraDirection.z);
    model.rotation.y = lerpAngle(model.rotation.y, targetRotation, 0.14); // Adjusted rotation speed
    
    // Combined movement vector
    const dir = cameraDirection.clone().add(fwdLeft ? cameraRight.clone().negate() : cameraRight.clone()).normalize();
    const moveVec = dir.multiplyScalar(moveSpeed * 0.87 * delta * 60); // Adjusted to 0.87 (87%) for diagonal forward movement
    const adjusted = adjustMovementForCollisions(model.position, moveVec);
    model.position.x += adjusted.x;
    model.position.z += adjusted.z;
    if (!isJumping) {
      const groundY = findGroundHeight(model.position);
      if (groundY !== null) model.position.y = groundY + 0.05;
    }
    return;
  }
  
  // Handle A+S+D key combination with most recent key taking precedence
  if (move.backward && move.left && move.right) {
    // All three keys are pressed - check which was pressed most recently
    const now = performance.now();
    
    // Start tracking when all three keys were first held together
    if (!allThreeKeysHeldStartTime) {
      allThreeKeysHeldStartTime = now;
    }
    
    // If all three keys have been held for more than 500ms, use pure backward movement
    const allThreeKeysHeldLong = allThreeKeysHeldStartTime && (now - allThreeKeysHeldStartTime >= 500);
    
    if (allThreeKeysHeldLong) {
      // All three keys held for a long time - use pure backward movement
      move.left = false;
      move.right = false;
    } else {
      // Otherwise, let the most recent key take precedence
      if (keyPressTimes.KeyA > keyPressTimes.KeyD) {
        // A was pressed more recently - prioritize backward+left
        move.right = false;
      } else {
        // D was pressed more recently (or same time) - prioritize backward+right
        move.left = false;
      }
    }
  } else {
    // Reset the timer if not all three keys are pressed
    allThreeKeysHeldStartTime = null;
  }
  
  // Backward+strafe: moonwalk-style diagonal movement
  const backLeft = move.backward && move.left && !move.right;
  const backRight = move.backward && move.right && !move.left;
  if (backLeft || backRight) {
    // Use walk animation for backward diagonal movement (moonwalk style)
    setMovementAction('walk');
    
    // Restore classic behavior: face away from camera for backward-diagonal
    const targetRotation = normalizeAngle(cameraYaw + Math.PI);
    model.rotation.y = lerpAngle(model.rotation.y, targetRotation, 0.14); // Adjusted rotation speed
    if (actions['walk']) actions['walk'].timeScale = -0.5;
    
    // Combined movement vector (backward + strafe)
    const dir = cameraDirection.clone().negate().add(backLeft ? cameraRight.clone().negate() : cameraRight.clone()).normalize();
    const moveVec = dir.multiplyScalar(moveSpeed * 0.55 * delta * 60); // Reduced to 0.55 (55% of normal speed)
    const adjusted = adjustMovementForCollisions(model.position, moveVec);
    model.position.x += adjusted.x;
    model.position.z += adjusted.z;
    
    if (!isJumping) {
      const groundY = findGroundHeight(model.position);
      if (groundY !== null) {
        const feetOffset = 0.05;
        model.position.y = groundY + feetOffset;
        lastGroundY = model.position.y;
      }
    }
    return;
  }

  // Strafing: side-step without rotating model when only strafing
  const onlyLeft = move.left && !move.right && !move.forward && !move.backward;
  const onlyRight = move.right && !move.left && !move.forward && !move.backward;
  if ((onlyLeft || onlyRight) && !isMobileControlActive) {
    // Skip pure strafe animations on mobile to allow camera rotation
    const actionName = onlyLeft ? 'strafe_left' : 'strafe_right';
    setMovementAction(actionName);
    
    // For pure strafing, rotate to face camera direction to fix strafe angles
    const targetRotation = Math.atan2(cameraDirection.x, cameraDirection.z);
    model.rotation.y = lerpAngle(model.rotation.y, targetRotation, 0.14); // Adjusted rotation speed
    
    // Apply strafing movement
    const strafeDir = onlyLeft ? cameraRight.clone().negate() : cameraRight.clone();
    strafeDir.multiplyScalar(moveSpeed * 0.8 * delta * 60); // Added 0.8 multiplier for slightly slower strafe
    const adjusted = adjustMovementForCollisions(model.position, strafeDir);
    model.position.x += adjusted.x;
    model.position.z += adjusted.z;
    // Ground check
    if (!isJumping) {
      const groundY = findGroundHeight(model.position);
      if (groundY !== null) model.position.y = groundY + 0.05;
    }
    return;
  }

  // Calculate movement direction based on WASD input relative to camera
  let moveDirection = new THREE.Vector3(0, 0, 0);
  
  // Determine primary movement direction
  if (move.forward) {
    moveDirection.add(cameraDirection); // W = forward
  }
  if (move.backward) {
    moveDirection.sub(cameraDirection); // S = backward
  }
  if (move.right) moveDirection.add(cameraRight); // D = right
  if (move.left) moveDirection.sub(cameraRight); // A = left
  
  // Normalize movement direction
  if (moveDirection.length() > 0) {
    moveDirection.normalize();
    
    // Sync physical speed with animation playback speed
    const animScale = actions['walk'] ? Math.abs(actions['walk'].timeScale) : 1.0;
    moveVector.set(
      moveDirection.x * moveSpeed * animScale * delta * 60,
      0,
      moveDirection.z * moveSpeed * animScale * delta * 60
    );
    
    // Adjust movement for collisions
    const adjustedMove = adjustMovementForCollisions(model.position, moveVector);
    
    // Apply adjusted movement
    model.position.x += adjustedMove.x;
    model.position.z += adjustedMove.z;
    
    // Apply ground detection to keep character properly grounded ONLY IF NOT JUMPING
    if (!isJumping) {
      const groundHeight = findGroundHeight(model.position);
      if (groundHeight !== null) {
        const feetOffset = 0.05;
        model.position.y = groundHeight + feetOffset;
        lastGroundY = model.position.y;
      }
    }
    
    // Handle character rotation and animation based on movement direction
    if (move.backward && !move.left && !move.right) {
      // Pure backward movement - face away from camera
      const targetRotation = normalizeAngle(cameraYaw + Math.PI);
      model.rotation.y = lerpAngle(model.rotation.y, targetRotation, 0.14); // Adjusted rotation speed
      setMovementAction('walk');
      forwardRampStartTime = null;
      if (actions['walk']) actions['walk'].timeScale = -0.5;
      
      // IMPORTANT: We're overriding the previous movement calculation completely
      // Clear previous movement to avoid double application
      model.position.x -= adjustedMove.x;
      model.position.z -= adjustedMove.z;
      
      // Apply slower backward movement
      const moveVec = cameraDirection.clone().negate().multiplyScalar(moveSpeed * 0.55 * delta * 60); // Reduced to 0.55 (55% of normal speed)
      const adjusted = adjustMovementForCollisions(model.position, moveVec);
      model.position.x += adjusted.x;
      model.position.z += adjusted.z;
    } else {
      // Forward or sideways movement - rotate character to face movement direction
      const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
      model.rotation.y = lerpAngle(model.rotation.y, targetRotation, 0.14); // Adjusted rotation speed

      // Reset to forward walking animation
      setMovementAction('walk');
      
      // Ramp forward speed from 0.65 to 0.88 over 3.2s
      if (actions['walk']) {
        const now = performance.now();
        if (forwardRampStartTime === null) forwardRampStartTime = now;
        const elapsed = now - forwardRampStartTime;
        const t = Math.min(elapsed / 3200, 1.0); // extend ramp to 3.2s
        actions['walk'].timeScale = 0.65 + 0.23 * t; // Ramp from 0.65 to 0.88 (0.65 + 0.23 = 0.88)
      }
    }
  } else {
    // Not moving, play idle animation
    setMovementAction('idle');
    // Keep current rotation when idle
  }
}

// Helper function to interpolate between angles correctly with improved handling
function lerpAngle(start, end, t) {
  // Normalize both angles to ensure consistent range
  start = normalizeAngle(start);
  end = normalizeAngle(end);
  
  // Find the shortest path between angles
  let diff = end - start;
  
  // Ensure we're taking the shortest path around the circle
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  
  // Apply lerp with a maximum change limit to prevent sudden jumps
  const maxChange = 0.2; // Maximum change allowed in one frame
  const rawChange = diff * t;
  const limitedChange = Math.max(-maxChange, Math.min(maxChange, rawChange));
  
  // Return normalized result
  return normalizeAngle(start + limitedChange);
}

// WASD movement and punch/hit controls
// Toggle collision debug visualization
function toggleCollisionDebug() {
  if (!collisionDebugger) return;
  
  collisionDebugEnabled = !collisionDebugEnabled;
  collisionDebugger.setVisible(collisionDebugEnabled);
  console.log('Collision debug:', collisionDebugEnabled ? 'enabled' : 'disabled');
}

// Function to get horizontal movement direction while jumping
function getJumpMovementDirection() {
  // Calculate movement direction based on camera/player orientation
  const moveDirection = new THREE.Vector3(0, 0, 0);
  
  if (!model) return moveDirection;
  
  // Get camera direction for movement relative to view
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  cameraDirection.y = 0;
  cameraDirection.normalize();
  
  // Get camera right vector
  const cameraRight = new THREE.Vector3().crossVectors(
    new THREE.Vector3(0, 1, 0),
    cameraDirection
  ).normalize();
  
  // Movement is camera-relative
  if (move.forward) moveDirection.add(cameraDirection);
  if (move.backward) moveDirection.sub(cameraDirection);
  if (move.left) moveDirection.add(cameraRight); // Swapped to fix left/right direction
  if (move.right) moveDirection.sub(cameraRight); // Swapped to fix left/right direction
  
  // Normalize movement direction if moving
  if (moveDirection.length() > 0) moveDirection.normalize();
  
  return moveDirection;
}

// Function to check if a new punch can be initiated
function canInitiatePunch() {
  return isPunchAnimationComplete;
}

window.addEventListener('keydown', (e) => {
  // Record timestamp of key presses for A, S, D keys
  if (e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') {
    keyPressTimes[e.code] = performance.now();
  }
  
  if (e.code === 'KeyW') move.forward = true;
  if (e.code === 'KeyS') move.backward = true;
  if (e.code === 'KeyA') move.left = true;
  if (e.code === 'KeyD') move.right = true;
  const now = performance.now();
  if (e.code === 'Space' && !isJumping && !isPrepareJumping && now - lastJumpTime >= jumpCooldown) {
    // Start jump preparation phase (crouch/wind-up)
    isPrepareJumping = true;
    jumpPrepStartTime = performance.now();
    lastGroundY = model.position.y;
    
    // Check for ground height using collision system
    const groundHeight = findGroundHeight(model.position);
    if (groundHeight !== null) {
      lastGroundY = groundHeight;
    }
    
    console.log('Jump preparation started');
    
    // Transition to jump animation but play very slowly at first (for crouch)
    if (activeAction) {
      activeAction.fadeOut(0.15);
    }
    
    // Start with VERY slow timeScale to show the wind-up/crouch part of animation
    actions['jump'].reset()
      .setLoop(THREE.LoopOnce, 1)
      .setEffectiveTimeScale(0.15) // Even slower initial animation for wind-up to match new jump speed
      .setEffectiveWeight(0.7) // Adjust wind-up jump animation weight to 70%
      .fadeIn(0.15)
      .play();
    
    actions['jump'].clampWhenFinished = true;
    activeAction = actions['jump'];
    
    // Slightly lower the character during preparation
    if (model) {
      // Gradual crouch effect
      const crouchSteps = 3; // Fewer steps for faster crouch
      const crouchAmount = 0.10; // Increased to 0.10 total crouch amount as requested
      const stepTime = JUMP_PREP_TIME / crouchSteps;
      const crouchPerStep = crouchAmount / crouchSteps;
      
      for (let i = 0; i < crouchSteps; i++) {
        setTimeout(() => {
          if (model && isPrepareJumping) {
            model.position.y -= crouchPerStep;
          }
        }, i * stepTime);
      }
    }
  }
  if (e.code === 'KeyF') setAction('hit', true); // true = temporary one-shot animation
  if (e.code === 'KeyC') toggleCollisionDebug(); // Toggle collision debug visualization
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') move.forward = false;
  if (e.code === 'KeyS') move.backward = false;
  if (e.code === 'KeyA') move.left = false;
  if (e.code === 'KeyD') move.right = false;
  
  // Check if all movement keys are released and immediately set to idle
  if (!move.forward && !move.backward && !move.left && !move.right && !isJumping && !isPrepareJumping) {
    setMovementAction('idle');
  }
});
window.addEventListener('mousedown', (e) => {
  if (e.button === 0 && canInitiatePunch()) {
    setAction('punch', true); // Can punch while moving, but only if previous punch is complete
  }
});

// Setup mobile controls if on a mobile device
if (isMobile()) {
  console.log('Mobile device detected, initializing touch controls');
  document.getElementById('mobile-controls').style.display = 'block';
  
  // Get joystick and button elements
  const joystickZone = document.getElementById('joystick-zone');
  const joystickThumb = document.getElementById('joystick-thumb');
  const attackButton = document.getElementById('attack-button');
  const jumpButton = document.getElementById('jump-button');

  // Mobile controls state
  let joystickActive = false;
  let joystickStartX = 0, joystickStartY = 0;
  let joystickCurrentX = 0, joystickCurrentY = 0;
  let lastMoveDirection = null;

  // Joystick dimensions - we'll update these when needed for orientation changes
  let joystickRect = joystickZone.getBoundingClientRect();
  let joystickCenterX = joystickRect.width / 2;
  let joystickCenterY = joystickRect.height / 2;
  let maxDistance = joystickRect.width / 3;
  
  // Function to update joystick dimensions - call this when orientation changes
  function updateJoystickDimensions() {
    joystickRect = joystickZone.getBoundingClientRect();
    joystickCenterX = joystickRect.width / 2;
    joystickCenterY = joystickRect.height / 2;
    maxDistance = joystickRect.width / 3;
    console.log('Joystick dimensions updated:', joystickRect.width, joystickRect.height);
  }
  
  // Listen for orientation changes
  window.addEventListener('orientationchange', () => {
    // Wait a moment for the browser to complete the rotation
    setTimeout(updateJoystickDimensions, 300);
  });
  
  // Also listen for resize events which happen during orientation changes
  window.addEventListener('resize', () => {
    updateJoystickDimensions();
  });

  // Thumb update
  function updateJoystickThumb() {
    const deltaX = joystickCurrentX - joystickCenterX;
    const deltaY = joystickCurrentY - joystickCenterY;
    const absDx = Math.abs(deltaX), absDy = Math.abs(deltaY);
    const distance = absDx + absDy - (Math.min(absDx, absDy) / 2);
    let limitedX = deltaX, limitedY = deltaY;
    if (distance > maxDistance) {
      const ratio = maxDistance / distance;
      limitedX = deltaX * ratio;
      limitedY = deltaY * ratio;
    }
    joystickThumb.style.transform = `translate3d(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px), 0)`;
  }

  // Movement update
  function updateMovementDirection() {
    const deltaX = joystickCurrentX - joystickCenterX;
    const deltaY = joystickCurrentY - joystickCenterY;
    const absDx = Math.abs(deltaX), absDy = Math.abs(deltaY);
    const distance = absDx + absDy - (Math.min(absDx, absDy) / 2);
    if (distance > 10) {
      const isHoriz = absDx > absDy;
      move.forward = move.backward = move.left = move.right = false;
      if (isHoriz) {
        if (deltaX > 0) { move.right = true; lastMoveDirection = 'right'; }
        else { move.left = true; lastMoveDirection = 'left'; }
      } else {
        if (deltaY > 0) move.backward = true;
        else move.forward = true;
      }
    }
  }
  // Touch events
  joystickZone.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    joystickStartX = t.clientX - joystickRect.left;
    joystickStartY = t.clientY - joystickRect.top;
    joystickCurrentX = joystickStartX;
    joystickCurrentY = joystickStartY;
    joystickActive = true;
    isMobileControlActive = true; // Flag that mobile controls are active
    updateJoystickThumb();
    updateMovementDirection();
  }, { passive: false });
  
  let lastMoveUpdate = 0;
  const MOVE_THROTTLE = 16; // Reduced to ~60 FPS (16.67ms) for much more responsive controls
  joystickZone.addEventListener('touchmove', e => {
    if (!joystickActive) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastMoveUpdate < MOVE_THROTTLE) return;
    lastMoveUpdate = now;
    const t = e.touches[0];
    // Always get latest rect dimensions to support orientation changes
    const rect = joystickZone.getBoundingClientRect();
    joystickCurrentX = t.clientX - rect.left;
    joystickCurrentY = t.clientY - rect.top;
    updateJoystickThumb();
    updateMovementDirection();
  }, { passive: false });

  const endTouch = e => {
    e.preventDefault();
    joystickActive = false;
    joystickThumb.style.transform = 'translate(-50%, -50%)';
    move.forward = move.backward = move.left = move.right = false;
  };
  joystickZone.addEventListener('touchend', endTouch, { passive: false });
  joystickZone.addEventListener('touchcancel', endTouch, { passive: false });

  // Attack and Jump
  attackButton.addEventListener('touchstart', e => { e.preventDefault(); setAction('punch', true); }, { passive: false });
  jumpButton.addEventListener('touchstart', e => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); }, { passive: false });
}

// Initialize camera position once model is loaded
function initializeCamera() {
  if (model) {
    // Position camera closer to player for a more immersive view (similar to Chivalry 2)
    camera.position.set(0, 1, 7); // Adjusted distance (z=7) with height (y=1)
    camera.lookAt(model.position.x, model.position.y + 1.75, model.position.z); // Updated lookAt target to 1.75
  }
}

// Initialize multiplayer connection and setup handlers
async function initializeMultiplayer() {
  console.log('[main.js] Initializing multiplayer connection...');
  const serverUrl = 'ws://localhost:2567'; // Define server URL (adjust if needed)
  console.log('[main.js] Server URL:', serverUrl);

  multiplayerManager = new MultiplayerManager(serverUrl); // Instantiate the class WITH serverUrl

  // Assign callbacks BEFORE connecting
  multiplayerManager.assignCallbacks({ 
    onConnect: handleMultiplayerConnect,
    onPlayerAdd: handlePlayerAdd,
    onPlayerChange: handlePlayerChange,
    onPlayerRemove: handlePlayerRemove,
    onError: handleMultiplayerError
  });

  try {
    // Connect to multiplayer server using the instance - NO serverUrl argument needed here
    await multiplayerManager.connect(); 

    // Connection success is handled by the connect method resolving.
    // We check isConnected() if needed later.
  } catch (error) {
    console.error('[main.js] Error connecting to multiplayer server:', error);
    isMultiplayerConnected = false;
    multiplayerManager = null; // Reset manager on connection failure
  }
}

function handleMultiplayerConnect(sessionId) {
  console.log(`[main.js] Successfully connected to multiplayer! My Session ID: ${sessionId}`);
  isMultiplayerConnected = true;
}

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

const LOOK_AT_SMOOTH = 0.15; // tighter smoothing to keep character more centered
let currentLookAtTarget = new THREE.Vector3(); // smoothed lookAt target

// Frame rate limiting variables
let lastFrameTime = 0;
const targetFPS = 60;
const frameInterval = 1000 / targetFPS;
// --- Helper Function Definitions for Animate Loop ---

// Need to track previous mobile move state for change detection
let previousMoveState = { left: false, right: false };

// Updates FPS counter and collision debugger visualization
function _updateDebugInfo(deltaTime, now) {
  // Update collision debug visualization if enabled
  if (collisionDebugEnabled && collisionDebugger) {
    collisionDebugger.update();
  }

  // Throttle debug text updates to avoid excessive DOM manipulation
  if (now - lastDebugUpdate > 100) { // Update debug text every 100ms
    if (debugDiv) {
      debugDiv.textContent = `Yaw: ${cameraYaw.toFixed(2)}, Pitch: ${cameraPitch.toFixed(2)}`;
    }
    if (coordsDiv && model) { // Ensure model is loaded before accessing position
      coordsDiv.textContent = `X: ${model.position.x.toFixed(2)}, Y: ${model.position.y.toFixed(2)}, Z: ${model.position.z.toFixed(2)}`;
    }
    lastDebugUpdate = now;
  }

  // Update FPS counter
  frameCount++;
  if (now - lastFpsUpdate > FPS_UPDATE_INTERVAL) {
    fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
    frameCount = 0;
    lastFpsUpdate = now;
    // Update the fpsDiv element directly
    if (fpsDiv) {
      fpsDiv.textContent = `FPS: ${fps}`;
    }
  }
  // Remove the old code trying to find 'fpsCounter'
  // const fpsElement = document.getElementById('fpsCounter');
  // if (fpsElement) {
  //   fpsElement.textContent = `FPS: ${fps}`;
  // }
}

// Updates non-player entities like zombies
function _updateNonPlayerEntities(deltaTime) {
  // Update zombie targets
  if (zombieTargets && zombieTargets.length > 0) {
    zombieTargets.forEach(target => {
      if (target) target.update(deltaTime);
    });
  }

  // Update slobber zombie animation if mixer exists
  if (zombieMixer) {
    zombieMixer.update(deltaTime);
  }
}

// Updates the local player's animation mixer and calls the main movement/collision logic
function _updateLocalPlayer(delta) {
  if (mixer) { // Check if mixer exists
     // Note: We use mixer.clock.getDelta() specifically for the animation mixer
     // But pass the main calculated deltaTime (based on frame limiter) to updateMovement
     const mixerDelta = mixer.clock.getDelta();
     mixer.update(mixerDelta);
  }
  // Use the frame-limited deltaTime for physics/movement updates
  updateMovement(delta);
}


// Interpolates position and rotation for remote players and updates their animations
function _updateRemotePlayers(delta) {
  otherPlayerModels.forEach((otherModel) => {
    if (otherModel.userData.mixer) {
      // Always use the main frame delta for remote player animations
      otherModel.userData.mixer.update(delta);
    }

    // Interpolate position and rotation towards target state from server
    const interpolationFactor = 0.15;
    if (otherModel.userData.targetPosition) {
      otherModel.position.lerp(otherModel.userData.targetPosition, interpolationFactor);
    }
    if (otherModel.userData.targetRotationY !== undefined) {
      // Make sure targetRotationY exists before lerping
      // Negate targetRotationY AND add Math.PI to correct inversion and 180-degree offset
      otherModel.rotation.y = lerpAngle(otherModel.rotation.y, -otherModel.userData.targetRotationY + Math.PI, interpolationFactor);
    }
  });
   // Commenting out the seemingly redundant second interpolation loop from original code
   /*
   otherPlayerModels.forEach((otherModel, sessionId) => {
     if (otherModel.userData.targetRotationY !== undefined) {
       // Make sure targetRotationY exists before lerping
       otherModel.rotation.y = lerpAngle(otherModel.rotation.y, otherModel.userData.targetRotationY, 0.15);
     }
   });
   */
}

// Sends local player's position and rotation updates to the server if changed
function _sendNetworkUpdates(now) {
  if (multiplayerManager && multiplayerManager.isConnected()) {
    if (model) { // Ensure the player model exists
      // Store current position/rotation values
      const currentPos = {
        x: model.position.x,
        y: model.position.y,
        z: model.position.z,
        rotationY: model.rotation.y
      };

      // Check for movement-based updates (when movement exceeds threshold)
      const shouldSendMovementUpdate = 
        now - lastUpdateSent > UPDATE_INTERVAL && 
        (!model.userData.lastSentPos ||
        Math.abs(currentPos.x - model.userData.lastSentPos.x) > 0.001 ||
        Math.abs(currentPos.y - model.userData.lastSentPos.y) > 0.001 ||
        Math.abs(currentPos.z - model.userData.lastSentPos.z) > 0.001 ||
        Math.abs(currentPos.rotationY - model.userData.lastSentPos.rotationY) > 0.01);

      // Check for timed updates (every 2 seconds)
      // Use a global variable instead of userData for more reliable persistence
      if (lastTimedNetworkUpdate === 0) {
        lastTimedNetworkUpdate = now;
        console.log(`[Network] Initializing lastTimedNetworkUpdate to ${now}`);
      }
      
      const timeSinceLastTimedUpdate = now - lastTimedNetworkUpdate;
      const shouldSendTimedUpdate = timeSinceLastTimedUpdate > 2000; // 2 seconds
      
      // Debug logging for timed update tracking (once per second at 60fps)
      if (frameCount % 60 === 0) {
        console.log(`[Network] Time since last timed update: ${timeSinceLastTimedUpdate.toFixed(0)}ms, shouldSendTimedUpdate: ${shouldSendTimedUpdate}`);
      }

      // Send update if either condition is met
      if (shouldSendMovementUpdate || shouldSendTimedUpdate) {
        // Debug which condition triggered the update
        if (shouldSendMovementUpdate) console.log(`[Network] Sending movement update (movement detected)`);
        if (shouldSendTimedUpdate) console.log(`[Network] Sending timed update (2s interval)`);
        
        // Send the update
        const updateSuccess = multiplayerManager.sendMessage('move', currentPos);
        if (updateSuccess) {
          console.log(`[Network] Update sent successfully`);
          
          // Store last sent position
          model.userData.lastSentPos = { ...currentPos };
          
          // Update timestamps
          if (shouldSendMovementUpdate) {
            lastUpdateSent = now;
          }
          if (shouldSendTimedUpdate) {
            lastTimedNetworkUpdate = now;
            console.log(`[Network] Updated lastTimedNetworkUpdate to ${now}`);
          }
        } else {
          console.warn(`[Network] Failed to send update`);
        }
      }
    }
  }
}

// Updates the third-person camera position and lookAt target
function _updateCamera(deltaTime) {
    if (!model) return; // Need the player model for camera calculations

    // Different camera behavior for mobile and desktop
    if (isMobile()) {
        // --- Mobile Camera Logic ---
        // Use editable values
        const cameraDistance = editableCameraDistance;
        const cameraHeight = editableCameraHeightOffset;
        const lookAtYOffset = editableCameraLookAtYOffset;

        const characterRotation = model.rotation.y;
        const targetAngle = characterRotation + Math.PI; // Behind character

        const currentMobileTime = performance.now();

        // Track previous state for direction change detection
        const moveChanged = (move.left !== previousMoveState.left) || (move.right !== previousMoveState.right);
        if (moveChanged) {
             lastDirectionChangeTime = currentMobileTime;
             previousMoveState.left = move.left;
             previousMoveState.right = move.right;
        }

        // Simplified mobile camera rotation logic (adjust as needed)
        if (currentMobileTime - lastDirectionChangeTime > cameraAdjustmentDelay) {
            targetCameraYaw = lerpAngle(targetCameraYaw, targetAngle, 0.025); // Gradual return
        }
        if (move.left) targetCameraYaw += 0.008;
        if (move.right) targetCameraYaw -= 0.008;

        targetCameraYaw = normalizeAngle(targetCameraYaw);
        cameraYaw = lerpAngle(cameraYaw, targetCameraYaw, 0.08); // Responsive rotation

        const baseY = isJumping ? lastGroundY : model.position.y;
        const targetPosition = new THREE.Vector3(model.position.x, baseY + lookAtYOffset, model.position.z); // Use editable Y offset

        // Clamp target height - Commented out to allow full control via LookAtYOff
        /*
        if (targetPosition.y > lastGroundY + MAX_CAMERA_TARGET_Y_ABOVE_GROUND) {
            targetPosition.y = lastGroundY + MAX_CAMERA_TARGET_Y_ABOVE_GROUND;
        }
        */

        cameraPitch = mobileCameraPitch; // Use mobile specific pitch

        const cameraOffset = new THREE.Vector3(
            Math.sin(cameraYaw) * cameraDistance, // Removed Math.cos(cameraPitch)
            cameraHeight, // Use fixed height offset, independent of pitch
            Math.cos(cameraYaw) * cameraDistance // Removed Math.cos(cameraPitch)
        );

        currentLookAtTarget.lerp(targetPosition, LOOK_AT_SMOOTH); // Smooth lookAt target
        const cameraTargetPosition = new THREE.Vector3().copy(model.position).add(cameraOffset);

        // --- Mobile Camera Position Smoothing ---
        {
            const ascendSmooth = 0.005;
            const descendSmooth = 0.05;
            const horizSmooth = 0.15;
            const vertSmooth = (cameraTargetPosition.y > camera.position.y) ? ascendSmooth : descendSmooth;
            camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraTargetPosition.x, horizSmooth);
            camera.position.z = THREE.MathUtils.lerp(camera.position.z, cameraTargetPosition.z, horizSmooth);
            camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraTargetPosition.y, vertSmooth);
            camera.lookAt(currentLookAtTarget);
        }

    } else {
        // --- Desktop Camera Logic ---
        // Use editable values
        const cameraDistance = editableCameraDistance;
        const cameraHeight = editableCameraHeightOffset;
        const lookAtYOffset = editableCameraLookAtYOffset;

        // Smooth camera Yaw/Pitch towards target values (controlled by mouse input)
        // cameraYaw = lerpAngle(cameraYaw, targetCameraYaw, cameraSmoothingFactor); // REMOVED: Redundant lerp, yaw is now directly assigned in updateMovement
        // cameraPitch = THREE.MathUtils.lerp(cameraPitch, targetCameraPitch, cameraSmoothingFactor); // Removed: Redundant lerp, handled in updateMovement
        // cameraPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraPitch)); // Old clamp
        cameraPitch = Math.max(-pitchLimit, Math.min(pitchLimit, cameraPitch)); // Use stricter pitchLimit

         const cameraOffset = new THREE.Vector3(
            Math.sin(cameraYaw) * cameraDistance, // Removed Math.cos(cameraPitch)
            cameraHeight, // Use fixed height offset, independent of pitch
            Math.cos(cameraYaw) * cameraDistance // Removed Math.cos(cameraPitch)
        );

        const cameraOffsetOriginal = new THREE.Vector3(
          Math.sin(cameraYaw) * Math.cos(cameraPitch) * cameraDistance,
          // Use neutral pitch (0) for vertical offset when jumping to prevent pitch-down effect
          (isJumping ? 0 : Math.sin(cameraPitch)) * cameraDistance + cameraHeight,
          Math.cos(cameraYaw) * Math.cos(cameraPitch) * cameraDistance
        );

        const baseY = isJumping ? lastGroundY : model.position.y;
        const targetPosition = new THREE.Vector3(model.position.x, baseY + lookAtYOffset, model.position.z); // Use editable Y offset

        // Clamp target height - Commented out to allow full control via LookAtYOff
        /*
        if (targetPosition.y > lastGroundY + MAX_CAMERA_TARGET_Y_ABOVE_GROUND) {
             targetPosition.y = lastGroundY + MAX_CAMERA_TARGET_Y_ABOVE_GROUND; // Clamp lookAt target height
        }
        */

        const lookAtTargetY = model.position.y + lookAtYOffset;
        const targetPositionForLookAt = new THREE.Vector3(model.position.x, lookAtTargetY, model.position.z);

        // Clamp target height - Commented out to allow full control via LookAtYOff
        /*
        if (targetPositionForLookAt.y > lastGroundY + MAX_CAMERA_TARGET_Y_ABOVE_GROUND) {
             targetPositionForLookAt.y = lastGroundY + MAX_CAMERA_TARGET_Y_ABOVE_GROUND;
        }
        */

        // Smooth the look-at target towards the model's actual height
        currentLookAtTarget.lerp(targetPositionForLookAt, LOOK_AT_SMOOTH);

        // Calculate camera's target *position* using cameraOffsetOriginal (which handles pitch/jump)
        const finalCameraTargetPosition = new THREE.Vector3().copy(model.position).add(cameraOffsetOriginal);
        // REMOVED: Simplified - Removed the potentially problematic Y-adjustment line.
        // Let cameraOffsetOriginal handle the position relative to the model.


        // --- Desktop Camera Position Smoothing ---
        const desktopSmoothFactor = 0.12; // tighter follow for desktop
        const jumpSmoothFactor = 0.08; // Increased jump smooth factor to improve tracking
        const currentSmoothFactor = isJumping ? jumpSmoothFactor : desktopSmoothFactor; // Restore conditional factor
        
        // Interpolate camera position using the conditional factor
        camera.position.lerp(finalCameraTargetPosition, currentSmoothFactor);
        // Ensure lookAt is still called
        camera.lookAt(currentLookAtTarget);
    }
}

// Throttles shadow map updates, especially on mobile
function _updateShadows() {
  // Use frameCount which is updated in _updateDebugInfo or main loop
  if (!isMobile() || frameCount % 10 === 0) {
    // Ensure throttledShadowUpdate exists and is callable
    if (typeof throttledShadowUpdate === 'function') {
       throttledShadowUpdate();
    } else {
       // console.warn("throttledShadowUpdate function not found!"); // Optional warning
    }
  }
}
// --- End Helper Function Definitions ---

function animate(timestamp) {
  requestAnimationFrame(animate);

  // --- Frame Rate Limiting & Delta Time ---
  const now = performance.now(); // Use performance.now() consistently
  const elapsed = now - lastFrameTime;
  if (elapsed < frameInterval && lastFrameTime !== 0) { // Add check for first frame
    return; // Skip frame if not enough time has passed
  }
  // Calculate actual deltaTime based on elapsed frame time
  // Use max to prevent negative delta on first frame or timing issues
  let deltaTime = Math.max(0, elapsed / 1000.0);
  lastFrameTime = now - (elapsed % frameInterval); // Adjust for remainder

  // Optional: Clamp deltaTime to prevent huge jumps if tab was inactive
  deltaTime = Math.min(deltaTime, 0.1); // e.g., max 100ms jump

  // --- Updates ---
  _updateDebugInfo(deltaTime, now);       // Update FPS counter, collision debugger
  _updateNonPlayerEntities(deltaTime);    // Update zombies, etc.
  _updateLocalPlayer(deltaTime);          // Update local player mixer and call updateMovement
  _updateRemotePlayers(deltaTime);        // Interpolate/animate remote players
  _sendNetworkUpdates(now);             // Send updates to server
  _updateCamera(deltaTime);               // Update third-person camera
  _updateShadows();                     // Update shadows (throttled)

  // --- Rendering ---
  if (renderer && scene && camera) { // Ensure they exist before rendering
      renderer.render(scene, camera);
  } else {
      // console.warn("Renderer, scene, or camera not ready for rendering."); // Optional warning
  }
}
 
animate();

// Placeholder for error handling from multiplayer
function handleMultiplayerError(error) {
  console.error("[main.js] Multiplayer Error:", error);
  // Potentially add UI feedback here (e.g., show a 'connection failed' message)
}
