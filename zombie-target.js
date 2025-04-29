// Zombie Target implementation
// Destructible targets that fall over after taking 3 hits

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Loader for FBX models
const loader = new FBXLoader();

// Class to manage zombie cutout targets
export class ZombieTarget {
  constructor(scene, position, rotation = 0) {
    this.scene = scene;
    // Store initial position (y will be adjusted by ground detection)
    this.position = new THREE.Vector3(position.x, 0, position.z);
    this.rotation = rotation;
    
    // Target state
    this.health = 3; // Takes 3 hits to knock down
    this.isAlive = true;
    this.isAnimating = false;
    this.model = null;
    this.brokenModel = null;
    this.mixer = null;
    
    // Load models
    this.loadModels();
  }
  
  // Load both normal and broken models
  loadModels() {
    // Load the standing zombie cutout
    loader.load('./models/zombiecutout.fbx', (fbx) => {
      this.model = fbx;
      
      // Configure the model
      this.model.position.copy(this.position);
      this.model.rotation.y = this.rotation;
      this.model.scale.set(0.014, 0.014, 0.014); // Slightly smaller medium scale
      
      // Setup materials and shadows
      this.model.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Make materials double-sided
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                mat.side = THREE.DoubleSide;
                mat.roughness = 1.0; // Maximum roughness to reduce light reflection
                mat.metalness = 0.0; // Minimum metalness for a matte appearance
              });
            } else {
              child.material.side = THREE.DoubleSide;
              child.material.roughness = 1.0; // Maximum roughness to reduce light reflection
              child.material.metalness = 0.0; // Minimum metalness for a matte appearance
            }
          }
        }
      });
      
      // Add to scene
      this.scene.add(this.model);
      
      // Adjust position with a small offset from the initial position
      this.position.y += 0.1; // Small offset to prevent ground clipping
      this.model.position.copy(this.position);
      
      // Load the broken/falling zombie cutout
      loader.load('./models/zombiecutoutbroken.fbx', (brokenFbx) => {
        this.brokenModel = brokenFbx;
        
        // Configure the broken model (but don't add to scene yet)
        this.brokenModel.position.copy(this.position);
        this.brokenModel.rotation.y = this.rotation;
        this.brokenModel.scale.set(0.014, 0.014, 0.014); // Match slightly smaller scale
        
        // Setup materials and shadows
        this.brokenModel.traverse(child => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Make materials double-sided
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                  mat.side = THREE.DoubleSide;
                  mat.roughness = 1.0; // Maximum roughness to reduce light reflection
                  mat.metalness = 0.0; // Minimum metalness for a matte appearance
                });
              } else {
                child.material.side = THREE.DoubleSide;
                child.material.roughness = 1.0; // Maximum roughness to reduce light reflection
                child.material.metalness = 0.0; // Minimum metalness for a matte appearance
              }
            }
          }
        });
        
        // Setup animation mixer for the broken model
        this.mixer = new THREE.AnimationMixer(this.brokenModel);
        
        // If there's an animation in the broken model, set it up
        if (this.brokenModel.animations.length > 0) {
          const fallAnimation = this.mixer.clipAction(this.brokenModel.animations[0]);
          fallAnimation.setLoop(THREE.LoopOnce);
          fallAnimation.clampWhenFinished = true;
          
          // Store for later use
          this.fallAnimation = fallAnimation;
        }
        
        // Hide the broken model until needed
        this.brokenModel.visible = false;
        this.scene.add(this.brokenModel);
      });
    });
  }
  
  // Check if a point is close enough to hit this target
  isInHitRange(point, range = 2) {
    if (!this.model || !this.isAlive) return false;
    
    // Calculate distance between point and target
    const distance = new THREE.Vector3()
      .copy(this.position)
      .sub(point)
      .length();
      
    // Check if within hit range
    return distance <= range;
  }
  
  // Handle being hit by the player
  hit() {
    if (!this.isAlive || this.isAnimating) return false;
    
    // Reduce health
    this.health--;
    
    // Apply a small "hit reaction" by tilting the model slightly
    if (this.health > 0) {
      // Only do hit reaction if still alive
      this.applyHitReaction();
      return true;
    } else {
      // Zombie is defeated, play falling animation
      this.knockDown();
      return true;
    }
  }
  
  // Apply a small hit reaction (tilt/shake)
  applyHitReaction() {
    if (!this.model) return;
    
    // Remember original rotation
    const originalRotation = this.model.rotation.y;
    
    // Apply a small random tilt
    const tiltAmount = (Math.random() * 0.2) - 0.1;
    this.model.rotation.z += tiltAmount;
    
    // Flag as animating during hit reaction
    this.isAnimating = true;
    
    // Reset after a short delay
    setTimeout(() => {
      if (this.model) {
        // Smoothly reset rotation
        const resetDuration = 300; // ms
        const startTime = Date.now();
        const startTilt = this.model.rotation.z;
        
        const resetInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / resetDuration, 1);
          
          // Ease back to original position
          this.model.rotation.z = startTilt * (1 - progress);
          
          if (progress >= 1) {
            clearInterval(resetInterval);
            this.isAnimating = false;
          }
        }, 16);
      }
    }, 100);
  }
  
  // Knock down the zombie target (switch to broken model and play animation)
  knockDown() {
    if (!this.model || !this.brokenModel) return;
    
    // Mark as no longer alive
    this.isAlive = false;
    this.isAnimating = true;
    
    // Hide the regular model
    this.model.visible = false;
    
    // Show the broken model
    this.brokenModel.visible = true;
    
    // Play the falling animation if available
    if (this.fallAnimation) {
      this.fallAnimation.reset();
      this.fallAnimation.play();
      
      // Listen for animation completion
      this.mixer.addEventListener('finished', () => {
        this.isAnimating = false;
      });
    } else {
      // If no animation, just set a timer to mark animation as complete
      setTimeout(() => {
        this.isAnimating = false;
      }, 1000);
    }
  }
  
  // Reset the target to its original state
  reset() {
    this.health = 3;
    this.isAlive = true;
    this.isAnimating = false;
    
    if (this.model && this.brokenModel) {
      // Show the regular model
      this.model.visible = true;
      this.model.rotation.z = 0;
      
      // Hide the broken model
      this.brokenModel.visible = false;
      
      // Reset animation if needed
      if (this.fallAnimation) {
        this.fallAnimation.stop();
      }
    }
  }
  
  // Update method to be called in animation loop
  update(delta) {
    // Update animation mixer if active
    if (this.mixer && this.isAnimating) {
      this.mixer.update(delta);
    }
  }
  
  // This method is no longer used - we're using direct positioning instead
  findGroundHeight() {
    // Method kept for compatibility but not used
    return true;
  }
  
  // Remove from scene (cleanup)
  remove() {
    if (this.model) {
      this.scene.remove(this.model);
    }
    if (this.brokenModel) {
      this.scene.remove(this.brokenModel);
    }
  }
}

// Create a group of zombie targets at predefined positions
export function createZombieTargets(scene, positions) {
  const targets = [];
  
  positions.forEach(pos => {
    // Create a new zombie target
    const target = new ZombieTarget(
      scene, 
      new THREE.Vector3(pos.x, pos.y, pos.z),
      pos.rotation || 0
    );
    
    targets.push(target);
  });
  
  return targets;
}
