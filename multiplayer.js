import { Client, getStateCallbacks } from 'colyseus.js';

// Define callbacks placeholders - these will be assigned by main.js
let onPlayerAddCallback = (sessionId, playerData) => { console.warn("[multiplayer.js] onPlayerAddCallback not assigned!"); };
let onPlayerRemoveCallback = (sessionId) => { console.warn("[multiplayer.js] onPlayerRemoveCallback not assigned!"); };
let onPlayerChangeCallback = (sessionId, changes) => { console.warn("[multiplayer.js] onPlayerChangeCallback not assigned!"); };
let onConnectionCallback = () => { console.warn("[multiplayer.js] onConnectionCallback not assigned!"); };
let onErrorCallback = (error) => { console.warn("[multiplayer.js] onErrorCallback not assigned!"); };

export class MultiplayerManager {
    constructor(serverUrl, roomName = "game_room") {
        this.serverUrl = serverUrl;
        this.roomName = roomName;
        this.client = null;
        this.room = null;
        this.$ = null; // Initialize callback handler
        this.callbacks = {};
        this.playerListenersAttached = false; // Flag to track listener status
        this.initialStateProcessed = false; // Flag to ensure initial state is processed only once

        console.log(`[multiplayer.js] MultiplayerManager initialized. Server: ${serverUrl}, Room: ${roomName}`);
    }

    // Method to set callbacks from main.js
    setCallbacks(callbacks) {
        this.callbacks = callbacks;
    }

    // Add this method
    assignCallbacks(callbacks) {
        // Expect callbacks for: onConnect, onPlayerAdd, onPlayerChange, onPlayerRemove, onError
        if (!callbacks || typeof callbacks.onPlayerAdd !== 'function' || 
            typeof callbacks.onPlayerChange !== 'function' || 
            typeof callbacks.onPlayerRemove !== 'function' || 
            typeof callbacks.onError !== 'function') {
            console.error("[multiplayer.js] assignCallbacks: Required player/error callbacks are missing or not functions.", callbacks);
            throw new Error("Missing required multiplayer callbacks.");
        }
         // onConnect is optional but good practice
        if (callbacks.onConnect && typeof callbacks.onConnect !== 'function') {
             console.warn("[multiplayer.js] assignCallbacks: Provided onConnect is not a function.");
        }

        this.callbacks = { ...this.callbacks, ...callbacks }; 
        console.log("[multiplayer.js] Assigning callbacks:", this.callbacks);
    }

    async connect() { 
        if (this.isConnected()) {
            console.warn("[multiplayer.js] Already connected.");
            return;
        }

        // Reset flags for potential reconnection
        this.playerListenersAttached = false;
        this.initialStateProcessed = false;

        // Use assigned callbacks - Destructure for clarity
        const { onConnect, onPlayerAdd, onPlayerChange, onPlayerRemove, onError } = this.callbacks;

        this.client = new Client(this.serverUrl);
        console.log("[multiplayer.js] Connecting to multiplayer server...");

        try {
            // Check for essential onError callback first
            if (!onError) {
                console.error("[multiplayer.js] connect: onError callback is not assigned. Cannot proceed safely.");
                throw new Error("onError callback must be assigned before connecting.");
            }

            this.room = await this.client.joinOrCreate(this.roomName);
            this.$ = getStateCallbacks(this.room); // Get the callback handler here
            console.log(`[multiplayer.js] Successfully joined room: ${this.room.name}`);
            const sessionId = this.room.sessionId;
            console.log(`[multiplayer.js] My session ID: ${sessionId}`);

            // --- Setup Room Listeners --- 
            this._setupRoomListeners(); // Call the new method here

            // --- Connection Success --- 
            console.log("[multiplayer.js] Calling onConnect callback.");
            if (this.callbacks.onConnect) {
                console.log("[multiplayer.js] Calling onConnect callback.");
                onConnect(sessionId); // Pass the session ID
            } else {
                console.warn("[multiplayer.js] onConnect callback was not provided.");
            }

        } catch (error) {
            console.error("[multiplayer.js] Connection failed:", error);
            if (onError) {
                onError(error.message || "An unknown connection error occurred."); // Use assigned error callback
            } else {
                 // Fallback if onError wasn't assigned despite the check (shouldn't happen)
                 console.error("[multiplayer.js] CRITICAL: Connection failed but onError callback is missing!");
            }
            // Maybe add cleanup here too?
            this.cleanup();
        }
    }

    // Private method to setup listeners after room is joined
    _setupRoomListeners() {
        if (!this.room) {
            console.error("[multiplayer.js] _setupRoomListeners called but room is null.");
            return;
        }
        console.log("[multiplayer.js] Setting up room listeners...");

        // --- Standard State Change Listener --- 
        // This single listener handles both initial state and subsequent patches.
        this.room.onStateChange((state) => {
            // console.log("[multiplayer.js] onStateChange triggered. Current state keys:", Object.keys(state)); // Optional: Debug log

            // Process FULL state and attach listeners only on the first valid update containing players
            if (!this.initialStateProcessed && state.players && state.players.size !== undefined) { // Check if players map exists
                console.log(`[multiplayer.js] onStateChange: First valid state with players map received (Size: ${state.players.size}). Processing initial players and attaching listeners...`);
                
                // Attach MapSchema listeners NOW that we know state.players exists
                this.setupPlayerListeners(state);

                // Manually process any players already in the initial state
                state.players.forEach((player, sessionId) => {
                    console.log(`[multiplayer.js] Processing existing player from initial state: ${sessionId}`);
                    const initialPlayerData = player.toJSON(); // Store initial state
                    if (this.callbacks.onPlayerAdd) {
                        this.callbacks.onPlayerAdd(sessionId, initialPlayerData);
                    }
                     // Attach individual onChange listener here for initial players
                     this.attachIndividualPlayerListener(player, sessionId);

                });
                
                this.initialStateProcessed = true; // Mark initial state as processed
                console.log("[multiplayer.js] Initial state processed and listeners attached.");

            } else {
                console.log("[multiplayer.js] onStateChange: State received, but players map not ready yet or doesn't exist.");
            }
        });
        console.log("[multiplayer.js] onStateChange listener attached.");


        // --- Room Error Listener --- 
        console.log("[multiplayer.js] Attaching Room onError listener.");
        this.room.onError((code, message) => {
            console.error(`[multiplayer.js] Room error (Code: ${code}):`, message);
            if (this.callbacks.onError) {
                this.callbacks.onError({ code, message });
            }
            // Consider adding logic here to attempt reconnection or notify the user
        });
        console.log("[multiplayer.js] Room onError listener attached.");

        // --- Room Leave Listener --- 
        console.log("[multiplayer.js] Attaching Room onLeave listener.");
        this.room.onLeave((code) => {
            console.log(`[multiplayer.js] Left room (Code: ${code})`);
            this.initialStateProcessed = false; // Reset flag if we leave
            this.playerListenersAttached = false; // Reset flag
            this.room = null; // Clear room reference
            // Potentially notify main.js about the disconnection
            if (code === 1000) { // 1000 = Normal closure
                console.log("[multiplayer.js] Normal disconnect.");
            } else {
                console.warn(`[multiplayer.js] Abnormal disconnect code: ${code}`);
                if (this.callbacks.onError) {
                    this.callbacks.onError({ code, message: `Disconnected with code ${code}` });
                }
            }
        });
        console.log("[multiplayer.js] Room onLeave listener attached.");

    }

    // Attach listeners to the players map within the room's state
    setupPlayerListeners(state) {
        // *** Idempotency Check: Prevent attaching listeners multiple times ***
        if (this.playerListenersAttached) {
            // console.log("[multiplayer.js] setupPlayerListeners: Listeners already attached. Skipping.");
            return; 
        }

        console.log("[multiplayer.js] setupPlayerListeners: Checking for players map in state:", state);
        if (state && state.players && this.$) { // Also check if this.$ exists
            console.log(`[multiplayer.js] setupPlayerListeners: Players map found (Size: ${state.players.size}). Attaching listeners...`);

            this.$(state.players).onAdd((player, sessionId) => { // Use this.$ wrapper
                console.log(`[multiplayer.js] Player ADDED via MapSchema.onAdd: ${sessionId}`, player.toJSON()); // Log player data
                // Attach the individual onChange listener to this specific player schema
                this.attachIndividualPlayerListener(player, sessionId); // <<< RE-ADDED

                if (this.callbacks.onPlayerAdd) {
                    this.callbacks.onPlayerAdd(sessionId, player.toJSON());
                }
            });

            this.$(state.players).onRemove((player, sessionId) => { // Use this.$ wrapper // Schema listener gives player object too
                console.log(`[multiplayer.js] Player REMOVED via MapSchema.onRemove: ${sessionId}`);
                if (this.callbacks.onPlayerRemove) {
                    this.callbacks.onPlayerRemove(sessionId);
                }
            });

            console.log("[multiplayer.js] setupPlayerListeners: Add/Remove Listeners attached successfully."); // Updated log
            // *** Set flag AFTER listeners are attached ***
            // Note: We might set this flag manually in fullStateResponse handler too
            if (!this.playerListenersAttached) { // Avoid redundant logs if already set by manual processing
                console.log("[multiplayer.js] setupPlayerListeners: Setting playerListenersAttached = true.");
                this.playerListenersAttached = true; 
            }

        } else {
            console.warn("[multiplayer.js] setupPlayerListeners: Called, but state or state.players is missing. Cannot attach listeners yet.");
        }
    }

    // Helper to attach onChange listener to a single player schema
    attachIndividualPlayerListener(player, sessionId) {
        if (!player || !this.$) return; // Guard clause
        
        // console.log(`[multiplayer.js] Attaching onChange listener for player: ${sessionId}`);
        this.$(player).onChange(() => { // Use this.$ wrapper on the specific player instance
             console.log(`[multiplayer.js] Player CHANGED via NATIVE player.onChange: ${sessionId}`, player.toJSON()); 
             if (this.callbacks.onPlayerChange) {
                 this.callbacks.onPlayerChange(sessionId, player.toJSON());
             }
        });
    }

    // Method to send player movement data
    sendPlayerState(state) {
        if (this.room && this.isConnected()) {
            // Send movement data without logging
            this.room.send('move', state);
        }
    }

    sendAnimationUpdate(animationName) {
        if (this.room && this.isConnected()) {
            this.room.send('animation', { animationName });
        }
    }

    sendJump() {
        if (this.room && this.isConnected()) {
            this.room.send('jump');
        }
    }

    // Add this method to send messages to the server
    sendMessage(type, payload) {
        if (this.room && this.isConnected()) {
            try {
                this.room.send(type, payload);
                return true; // Message sent successfully
            } catch (error) {
                console.error(`[multiplayer.js] Error sending message (${type}):`, error);
                return false; // Error occurred
            }
        } else {
            console.warn(`[multiplayer.js] Cannot send message (${type}), not connected to room.`);
            return false; // Not connected
        }
    }

    // Method to check if connected (based on room existence)
    isConnected() {
        // Check client, room, and connection status
        return this.client !== null && this.room !== null && this.room.connection && this.room.connection.isOpen;
    }

    getSessionId() {
        return this.room ? this.room.sessionId : null;
    }

    // Cleanup method
    cleanup() {
        console.log("[multiplayer.js] Cleaning up multiplayer connection.");
        if (this.room) {
            this.room.leave();
        }
        this.client = null;
        this.room = null;
        this.playerListenersAttached = false;
        this.initialStateProcessed = false; 
    }
}