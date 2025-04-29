// Unified audio system for the game
// Handles both background music and narration voice lines

// Music configuration
const MUSIC_VOLUME = 0.44; // 44% volume as requested for desktop
const MUSIC_VOLUME_MOBILE = 0.25; // 25% volume for mobile devices (reduced to compensate for mobile audio differences)
const MUSIC_BREAK_DURATION = 4 * 60 * 1000; // 4 minutes in milliseconds

// Narration configuration
const MIN_INTERVAL = 15 * 1000; // Minimum 15 seconds between narrations
const MAX_INTERVAL = 28 * 1000; // Maximum 28 seconds between narrations
const NARRATION_VOLUME = 1.0; // 100% volume for narrations
const NARRATION_CHANCE = 0.95; // 95% chance to play when timer triggers
const MUSIC_VOLUME_DURING_NARRATION = 0.15; // Lower music to 15% during narration

// Audio elements
let musicElement = null;
let narrationElement = null;
let isPlaying = false;
let lastPlayedTime = 0;
let musicTimeout = null;
let narrationTimeout = null;
let isNarrationPlaying = false;
let narrationFiles = [];
let lastPlayedIndex = -1;

// Track narration history to avoid repetition
let narrationHistory = [];
const HISTORY_SIZE = 3; // Remember the last 3 played narrations to avoid repeating them

// Debug flag to help troubleshoot audio issues
const DEBUG_AUDIO = true;

// Wind sound loop setup
let windElement = null;
function randomWindRate() {
  const cents = Math.random() * (50 - 10) + 10; // random between 10-50 cents
  return Math.pow(2, cents / 1200);
}
function initWindLoop() {
  windElement = new Audio();
  windElement.src = './sfx/wind1.mp3';
  windElement.volume = 0.3;
  windElement.playbackRate = randomWindRate();
  windElement.addEventListener('ended', () => {
    windElement.playbackRate = randomWindRate();
    windElement.currentTime = 0;
    windElement.play();
  });
}

/**
 * Initialize the audio system
 */
function initAudioSystem() {
  // Make function globally accessible
  window.initAudioSystem = initAudioSystem;
  try {
    // console.log('Initializing unified audio system...');
    
    if (DEBUG_AUDIO) {
      // console.log('Browser audio capabilities:');
      // console.log('- Audio context supported:', typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined');
      // console.log('- Audio element supported:', typeof Audio !== 'undefined');
      // console.log('- User interaction detected:', document.readyState === 'complete');
    }
    
    // Initialize music player
    initMusicPlayer();
    
    // Initialize narration system
    initNarrationSystem();
    
    // Add user interaction handler to help with autoplay restrictions
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });
    
    // console.log('Audio system initialized successfully');
  } catch (error) {
    console.error('Error initializing audio system:', error);
  }
}

/**
 * Handle user interaction to enable audio autoplay
 */
function handleUserInteraction() {
  if (DEBUG_AUDIO) // console.log('User interaction detected, attempting to play audio');
  
  // Flag to indicate user has interacted with the page
  window._userHasInteracted = true;
  
  // Try to play music if not already playing
  if (musicElement && !isPlaying) {
    playMusic();
    // console.log('Manually attempting to play music after user interaction');
  }
  
  // Create and play a silent audio element to unlock audio on iOS
  try {
    const silentSound = new Audio();
    silentSound.src = 'data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
    silentSound.volume = 0.001; // Nearly silent
    silentSound.play().then(() => {
      // if (DEBUG_AUDIO) console.log('Silent sound played successfully to unlock audio');
      
      // Try to initialize narration after silent sound plays
      if (!isNarrationPlaying && narrationElement) {
        // Attempt to play a narration immediately to verify narration works
        playRandomNarration();
      }
    }).catch(e => {
      console.error('Failed to play silent sound:', e);
    });
  } catch (e) {
    console.error('Error creating silent sound:', e);
  }
  
  // Initialize and play wind loop sound on first interaction
  initWindLoop();
  windElement.play();
}

/**
 * Initialize the music player
 */
function initMusicPlayer() {
  try {
    // console.log('Initializing music player...');
    
    // Create audio element for music
    musicElement = new Audio();
    
    // Use relative path for Vite's public directory
    const musicPath = './music/rvztheme1.mp3';
    musicElement.src = musicPath;
    
    // Check if this is a mobile device and set appropriate volume
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    musicElement.volume = isMobile ? MUSIC_VOLUME_MOBILE : MUSIC_VOLUME;
    
    // if (DEBUG_AUDIO) {
    //   console.log(`Setting initial music volume: ${musicElement.volume} (${isMobile ? 'mobile' : 'desktop'} device)`);
    // }
    
    musicElement.preload = 'auto';
    
    // if (DEBUG_AUDIO) {
    //   console.log(`Music file path: ${musicPath}`);
      
    //   // Add event listeners for debugging
    //   musicElement.addEventListener('canplaythrough', () => {
    //     console.log('Music loaded and can play through');
    //   });
      
    //   musicElement.addEventListener('error', (e) => {
    //     console.error('Music error:', e);
    //     console.error('Error code:', musicElement.error ? musicElement.error.code : 'unknown');
    //     console.error('Error message:', musicElement.error ? musicElement.error.message : 'unknown');
    //   });
      
    //   musicElement.addEventListener('stalled', () => {
    //     console.error('Music playback stalled');
    //   });
      
    //   musicElement.addEventListener('waiting', () => {
    //     console.error('Music playback waiting for data');
    //   });
    // }
    
    // Set up ended event to handle replay with delay
    musicElement.addEventListener('ended', () => {
      // console.log('Music ended, will play again after 4 minute break');
      isPlaying = false;
      lastPlayedTime = Date.now();
      
      // Schedule next play after the break
      if (musicTimeout) clearTimeout(musicTimeout);
      musicTimeout = setTimeout(playMusic, MUSIC_BREAK_DURATION);
    });
    
    // Don't auto-play - wait for user interaction due to browser restrictions
    // We'll play in the handleUserInteraction function instead
    // console.log('Music player initialized, waiting for user interaction to play');
    
    // console.log('Music player initialized');
  } catch (error) {
    console.error('Error initializing music player:', error);
  }
}

/**
 * Initialize the narration system
 */
function initNarrationSystem() {
  try {
    // console.log('Initializing narration system...');
    
    // List of narration files (MP3 format) - using relative paths
    narrationFiles = [
      './vox/narrator1.mp3',
      './vox/narrator2.mp3',
      './vox/narrator3.mp3',
      './vox/narrator4.mp3',
      './vox/narrator5.mp3',
      './vox/narrator6.mp3',
      './vox/narrator7.mp3',
      './vox/narrator8.mp3',
      './vox/narrator9.mp3',
      './vox/narrator10weekend1.mp3'
    ];
    
    // Create audio element for narration
    narrationElement = new Audio();
    narrationElement.volume = NARRATION_VOLUME;
    
    // Set up ended event
    narrationElement.addEventListener('ended', () => {
      // console.log('Narration ended');
      isNarrationPlaying = false;
      
      // Restore music volume if it was lowered
      restoreMusicVolume();
      
      // Schedule next narration
      scheduleNextNarration();
    });
    
    // Play first narration after game start, but only after user interaction on mobile
    const initialDelay = Math.floor(Math.random() * 3000) + 2000; // Random delay between 2-5 seconds
    // console.log(`First narration will play in ${Math.round(initialDelay/1000)} seconds after user interaction`);
    
    // Check if this is a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    // if (DEBUG_AUDIO) {
    //   console.log('Device detection:', isMobile ? 'Mobile device' : 'Desktop device');
    // }
    
    // Function to schedule the first narration
    const scheduleFirstNarration = () => {
      setTimeout(() => {
        // Play a random narration immediately
        playRandomNarration();
      }, initialDelay);
    };
    
    // On mobile, wait for user interaction before scheduling first narration
    if (isMobile) {
      const checkUserInteraction = () => {
        if (window._userHasInteracted) {
          scheduleFirstNarration();
          return;
        }
        // Check again in 1 second
        setTimeout(checkUserInteraction, 1000);
      };
      checkUserInteraction();
    } else {
      // On desktop, schedule immediately
      scheduleFirstNarration();
    }
    
    // console.log('Narration system initialized with ' + narrationFiles.length + ' voice files');
  } catch (error) {
    console.error('Error initializing narration system:', error);
  }
}

/**
 * Play music
 */
function playMusic() {
  try {
    // if (DEBUG_AUDIO) console.log('Attempting to play music...');
    
    const currentTime = Date.now();
    
    // If it's been less than the break duration since last play ended, wait
    if (lastPlayedTime > 0 && currentTime - lastPlayedTime < MUSIC_BREAK_DURATION) {
      const timeToWait = MUSIC_BREAK_DURATION - (currentTime - lastPlayedTime);
      // console.log(`Waiting ${timeToWait/1000} seconds before playing music again`);
      
      // Schedule next play after the remaining break time
      if (musicTimeout) clearTimeout(musicTimeout);
      musicTimeout = setTimeout(playMusic, timeToWait);
      return;
    }
    
    // Play the music
    if (!isPlaying && musicElement) {
      // if (DEBUG_AUDIO) {
      //   console.log('Music element state:');
      //   console.log('- Source:', musicElement.src);
      //   console.log('- Ready state:', musicElement.readyState);
      //   console.log('- Paused:', musicElement.paused);
      //   console.log('- Volume:', musicElement.volume);
      // }
      
      musicElement.currentTime = 0; // Start from beginning
      
      // Create a user gesture simulation for browsers that require it
      const simulateUserGesture = () => {
        document.body.addEventListener('click', () => {
          // This empty function helps with some browsers
        }, { once: true });
      };
      
      // Attempt to play with error handling
      const playPromise = musicElement.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // console.log('Music started playing successfully');
            isPlaying = true;
          })
          .catch(error => {
            console.error('Error playing music:', error);
            isPlaying = false;
            
            if (error.name === 'NotAllowedError') {
              // console.log('Autoplay prevented by browser, waiting for user interaction');
              simulateUserGesture();
            } else {
              // Try again after a short delay
              setTimeout(playMusic, 5000);
            }
          });
      } else {
        // For older browsers that don't return a promise
        if (!musicElement.paused) {
          // console.log('Music appears to be playing (legacy browser)');
          isPlaying = true;
        } else {
          console.error('Music failed to play (legacy browser)');
          isPlaying = false;
          // Try again after a short delay
          setTimeout(playMusic, 5000);
        }
      }
    }
  } catch (error) {
    console.error('Error in playMusic:', error);
  }
}

/**
 * Schedule the next narration
 */
function scheduleNextNarration() {
  try {
    // Clear any existing timeout
    if (narrationTimeout) {
      clearTimeout(narrationTimeout);
    }
    
    // Random delay between MIN_INTERVAL and MAX_INTERVAL
    const delay = Math.floor(Math.random() * (MAX_INTERVAL - MIN_INTERVAL + 1)) + MIN_INTERVAL;
    
    // console.log(`Next narration possible in ${Math.round(delay/1000)} seconds`);
    
    // Set timeout for next narration
    narrationTimeout = setTimeout(() => {
      // Only play if random chance is met (adds more randomness)
      if (Math.random() < NARRATION_CHANCE) {
        playRandomNarration();
      } else {
        // console.log('Narration chance not met, skipping this opportunity');
        scheduleNextNarration(); // Try again later
      }
    }, delay);
  } catch (error) {
    console.error('Error scheduling narration:', error);
  }
}

/**
 * Play a random narration file
 */
function playRandomNarration() {
  try {
    // For mobile devices, ensure we have user interaction before playing
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && !window._userHasInteracted) {
      // console.log('Skipping narration playback - waiting for user interaction on mobile');
      scheduleNextNarration();
      return;
    }
    if (isNarrationPlaying) {
      // console.log('Narration already playing, skipping');
      scheduleNextNarration();
      return;
    }
    
    // Select a random narration file that hasn't been played recently
    let index;
    let attempts = 0;
    const maxAttempts = 20; // Increased max attempts to find a suitable narration
    
    // If we only have one narration file, we have no choice but to play it
    if (narrationFiles.length === 1) {
      index = 0;
    } else {
      // Create a list of available indices excluding the last played one
      const availableIndices = [];
      for (let i = 0; i < narrationFiles.length; i++) {
        if (i !== lastPlayedIndex && !narrationHistory.includes(i)) {
          availableIndices.push(i);
        }
      }
      
      // if (DEBUG_AUDIO) {
      //   console.log('Available narration indices:', availableIndices);
      //   console.log('Last played index:', lastPlayedIndex);
      //   console.log('Narration history:', narrationHistory);
      // }
      
      // If we have available indices that haven't been played recently, choose from them
      if (availableIndices.length > 0) {
        index = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      } else {
        // If all narrations are in history, pick a random one that's not the last played
        do {
          index = Math.floor(Math.random() * narrationFiles.length);
          attempts++;
          if (attempts >= maxAttempts) {
            // Emergency fallback - pick any index except the last played
            const possibleIndices = Array.from({length: narrationFiles.length}, (_, i) => i)
              .filter(i => i !== lastPlayedIndex);
            
            if (possibleIndices.length > 0) {
              index = possibleIndices[Math.floor(Math.random() * possibleIndices.length)];
            } else {
              // Absolute last resort - if somehow we only have one index in history
              // (shouldn't happen but just in case)
              index = Math.floor(Math.random() * narrationFiles.length);
            }
            break;
          }
        } while (index === lastPlayedIndex);
      }
    }
    
    // Update history
    lastPlayedIndex = index;
    
    // Add to history and maintain history size
    narrationHistory.push(index);
    if (narrationHistory.length > HISTORY_SIZE) {
      narrationHistory.shift(); // Remove oldest entry
    }
    
    const file = narrationFiles[index];
    
    // Set the source and play
    // Use relative path with explicit format for better mobile compatibility
    narrationElement.src = file;
    
    // Set MIME type for better mobile compatibility
    // This helps some mobile browsers properly identify the audio format
    if (file.endsWith('.mp3')) {
      narrationElement.type = 'audio/mpeg';
    }
    
    // Force preload
    narrationElement.load();
    
    // For iOS devices, we need to ensure audio is ready
    narrationElement.addEventListener('canplaythrough', function onCanPlay() {
      // Remove the event listener to avoid multiple calls
      narrationElement.removeEventListener('canplaythrough', onCanPlay);
      // if (DEBUG_AUDIO) {
      //   console.log('Narration file loaded and ready to play');
      // }
    }, { once: true });
    
    // Lower music volume before playing narration
    lowerMusicVolume();
    
    // Play the narration with a slight delay to ensure it's loaded
    setTimeout(() => {
      narrationElement.play()
        .then(() => {
          // console.log(`Playing narration: ${file}`);
          isNarrationPlaying = true;
        })
        .catch(error => {
          console.error('Error playing narration:', error);
          isNarrationPlaying = false;
          restoreMusicVolume();
          scheduleNextNarration();
        });
    }, 500);
  } catch (error) {
    console.error('Error playing random narration:', error);
    scheduleNextNarration();
  }
}

/**
 * Force play a specific narration file
 * @param {number} index - Index of the narration file to play
 */
function playSpecificNarration(index) {
  try {
    // For mobile devices, ensure we have user interaction before playing
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && !window._userHasInteracted) {
      // console.log('Cannot play specific narration - waiting for user interaction on mobile');
      return false;
    }
    if (index >= 0 && index < narrationFiles.length) {
      // Don't interrupt if already playing
      if (isNarrationPlaying) {
        return false;
      }
      
      const file = narrationFiles[index];
      
      // Set the source and play
      narrationElement.src = file;
      
      // Set MIME type for better mobile compatibility
      if (file.endsWith('.wav')) {
        narrationElement.type = 'audio/wav';
      }
      
      // Force preload
      narrationElement.load();
      
      // For iOS devices, we need to ensure audio is ready
      narrationElement.addEventListener('canplaythrough', function onCanPlay() {
        // Remove the event listener to avoid multiple calls
        narrationElement.removeEventListener('canplaythrough', onCanPlay);
        // if (DEBUG_AUDIO) {
        //   console.log('Specific narration file loaded and ready to play');
        // }
      }, { once: true });
      
      // Lower music volume before playing narration
      lowerMusicVolume();
      
      // Play the narration with a slight delay to ensure it's loaded
      setTimeout(() => {
        narrationElement.play()
          .then(() => {
            // console.log(`Playing specific narration: ${file}`);
            isNarrationPlaying = true;
            
            // Update history
            lastPlayedIndex = index;
            
            // Add to history and maintain history size
            narrationHistory.push(index);
            if (narrationHistory.length > HISTORY_SIZE) {
              narrationHistory.shift(); // Remove oldest entry
            }
          })
          .catch(error => {
            console.error('Error playing specific narration:', error);
            isNarrationPlaying = false;
            restoreMusicVolume();
            return false;
          });
      }, 500);
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error playing specific narration:', error);
    return false;
  }
}

// Volume fade constants
const FADE_DURATION = 500; // 500ms fade duration
const FADE_STEPS = 20; // Number of steps in the fade

/**
 * Temporarily lower music volume during narration with a smooth fade
 */
function lowerMusicVolume() {
  try {
    if (musicElement) {
      // Store original volume
      musicElement._originalVolume = musicElement.volume;
      
      // Calculate the step size for the fade
      const startVolume = musicElement._originalVolume;
      const endVolume = MUSIC_VOLUME_DURING_NARRATION;
      const volumeStep = (startVolume - endVolume) / FADE_STEPS;
      const stepDuration = FADE_DURATION / FADE_STEPS;
      
      // Perform the fade
      let step = 0;
      const fadeInterval = setInterval(() => {
        step++;
        if (step <= FADE_STEPS) {
          const newVolume = startVolume - (volumeStep * step);
          musicElement.volume = Math.max(endVolume, newVolume);
          
          // if (DEBUG_AUDIO && step === 1) {
          //   console.log(`Starting volume fade: ${startVolume} -> ${endVolume}`);
          // }
        } else {
          // Ensure we reach the exact target volume
          musicElement.volume = endVolume;
          clearInterval(fadeInterval);
          // console.log('Completed smooth fade for narration');
        }
      }, stepDuration);
    }
  } catch (error) {
    console.error('Error lowering music volume:', error);
    // Fallback to immediate volume change
    if (musicElement) {
      musicElement.volume = MUSIC_VOLUME_DURING_NARRATION;
    }
  }
}

/**
 * Restore music volume after narration with a smooth fade
 */
function restoreMusicVolume() {
  try {
    if (musicElement && musicElement._originalVolume) {
      // Calculate the step size for the fade
      const startVolume = musicElement.volume;
      const endVolume = musicElement._originalVolume;
      const volumeStep = (endVolume - startVolume) / FADE_STEPS;
      const stepDuration = FADE_DURATION / FADE_STEPS;
      
      // Perform the fade
      let step = 0;
      const fadeInterval = setInterval(() => {
        step++;
        if (step <= FADE_STEPS) {
          const newVolume = startVolume + (volumeStep * step);
          musicElement.volume = Math.min(endVolume, newVolume);
          
          // if (DEBUG_AUDIO && step === 1) {
          //   console.log(`Starting volume restore: ${startVolume} -> ${endVolume}`);
          // }
        } else {
          // Ensure we reach the exact target volume
          musicElement.volume = endVolume;
          clearInterval(fadeInterval);
          // console.log('Completed smooth fade restoration');
        }
      }, stepDuration);
    }
  } catch (error) {
    console.error('Error restoring music volume:', error);
    // Fallback to immediate volume change
    if (musicElement && musicElement._originalVolume) {
      musicElement.volume = musicElement._originalVolume;
    }
  }
}

/**
 * Set music volume (0.0 to 1.0)
 * @param {number} volume - Volume level between 0 and 1
 */
function setMusicVolume(volume) {
  if (musicElement) {
    musicElement.volume = Math.max(0, Math.min(1, volume));
  }
}

/**
 * Set narration volume (0.0 to 1.0)
 * @param {number} volume - Volume level between 0 and 1
 */
function setNarrationVolume(volume) {
  if (narrationElement) {
    narrationElement.volume = Math.max(0, Math.min(1, volume));
  }
}

/**
 * Toggle music on/off
 * @param {boolean} enabled - Whether music should be enabled
 */
function toggleMusic(enabled) {
  if (!musicElement) return;
  
  if (enabled && !isPlaying) {
    playMusic();
  } else if (!enabled && isPlaying) {
    musicElement.pause();
    isPlaying = false;
  }
}

// Export functions for use in other modules
export {
  setMusicVolume,
  setNarrationVolume,
  toggleMusic,
  playSpecificNarration
};

// Initialize the audio system when the page loads
window.addEventListener('load', initAudioSystem);
