console.log(`[multiplayer.js] Player CHANGED via NATIVE player.onChange: ${sessionId}`, player);
if (this.callbacks.onPlayerChange) {
    // Pass the raw player object from Colyseus state
    // <<< CHANGE: Always pass a plain JS object >>>
    this.callbacks.onPlayerChange(player.toJSON(), sessionId);
}

console.log(`[multiplayer.js] onStateChange: First valid state with players map received (Size: ${state.players.size}). Processing initial players and attaching listeners...`);

// <<< REMOVE Initial State Processing Loop >>>
// We will rely on players.onAdd instead
/* 
state.players.forEach((player, sessionId) => {
    console.log(`[multiplayer.js] Processing existing player from initial state: ${sessionId}`);
    if (this.callbacks.onPlayerAdd) {
         // Pass a plain JS object for consistency
         this.callbacks.onPlayerAdd(sessionId, player.toJSON ? player.toJSON() : player); 
    }
});
*/

// Setup listeners AFTER initial state might have been processed
if (!this.playerListenersAttached) { 
} 

console.log('[multiplayer.js] Attaching Room onLeave listener.');
// ... (rest of onLeave setup)

// Main state change handler
this.room.onStateChange((state) => {
    // console.log('[multiplayer.js] Raw state change received:', state);

    // Check if players map exists and is ready
    if (state.players && state.players.size !== undefined && !this.initialStateProcessed) {
        console.log(`[multiplayer.js] onStateChange: First valid state with players map received (Size: ${state.players.size}). Attaching listeners if needed...`);

        // <<< DELETE Initial Player Processing Loop from onStateChange >>>
        // Rely solely on players.onAdd triggered by Colyseus
        // The loop below should be completely removed.
        console.log(`[multiplayer.js] Initial player processing loop properly removed.`); // Updated log message

        // Setup per-player listeners ONLY ONCE after the map is first available
        if (!this.playerListenersAttached) {
            this.setupPlayerListeners();
        }

        // Mark initial state as processed to prevent re-attaching listeners
        this.initialStateProcessed = true;
        console.log('[multiplayer.js] Initial state processed flag set true.');

    } else if (!state.players || state.players.size === undefined) {
        console.log('[multiplayer.js] onStateChange: State received, but players map not ready yet or doesn\'t exist.');
    }
    // Subsequent state changes will be handled by player.onChange etc.
}, true); // `true` = trigger immediately for initial state 

console.log(`[MultiplayerListener] players.onAdd triggered for ${sessionId}`);
if (this.callbacks.onPlayerAdd) {
    // Pass a plain JS object for consistency
    this.callbacks.onPlayerAdd(sessionId, player.toJSON ? player.toJSON() : player);
} 

// Check if model already exists (should ideally not happen if logic is correct)
if (otherPlayerModels.has(sessionId)) {
  console.log(`[main.js] Model for sessionId ${sessionId} already exists, skipping`);
  return;
} 