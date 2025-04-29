const colyseus = require('colyseus');
const schema = require('@colyseus/schema');
const http = require('http');
const express = require('express');
const path = require('path'); // Needed for serving static files

const port = process.env.PORT || 2567;
const app = express();

app.use(express.json());

// --- Define State Schemas ---

// Player state
class Player extends schema.Schema {
    constructor() {
        super();
        this.x = Math.random() * 5; // Initial random position
        this.y = 0;
        this.z = Math.random() * 5;
        this.username = ""; // Username will be set via message
    }
}
schema.defineTypes(Player, {
    x: "number",
    y: "number",
    z: "number",
    username: "string"
});

// Game state containing a map of players
class GameState extends schema.Schema {
    constructor() {
        super();
        this.players = new schema.MapSchema();
    }
}
schema.defineTypes(GameState, {
    players: { map: Player }
});

// --- Define Game Room ---

class GameRoom extends colyseus.Room {

    onCreate(options) {
        console.log("[GameRoom] Room created!");
        this.setState(new GameState());

        // Handle messages from clients
        this.onMessage("playerInfo", (client, message) => {
            console.log(`[GameRoom] Received 'playerInfo' from ${client.sessionId}:`, message);
            const player = this.state.players.get(client.sessionId);
            if (player && message.username) {
                // Sanitize username (basic example)
                player.username = message.username.substring(0, 16); // Limit length
                console.log(`[GameRoom] Updated username for ${client.sessionId} to ${player.username}`);
            } else {
                console.log(`[GameRoom] Warning: Player ${client.sessionId} not found or username missing in message.`);
            }
        });

        // Handle player position updates (example)
        this.onMessage("updatePosition", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (player && typeof message.x === 'number' && typeof message.y === 'number' && typeof message.z === 'number') {
                player.x = message.x;
                player.y = message.y;
                player.z = message.z;
                // No need to broadcast manually, state sync handles it
            }
        });
    }

    onJoin(client, options) {
        console.log(`[GameRoom] Client joined: ${client.sessionId}`);
        // Create a new player instance in the state
        this.state.players.set(client.sessionId, new Player());
        console.log(`[GameRoom] Current players: ${this.state.players.size}`);

        // The client is expected to send a 'playerInfo' message soon after joining
        // containing their desired username.
    }

    onLeave(client, consented) {
        console.log(`[GameRoom] Client left: ${client.sessionId}`);
        if (this.state.players.has(client.sessionId)) {
            this.state.players.delete(client.sessionId);
            console.log(`[GameRoom] Player ${client.sessionId} removed.`);
        }
        console.log(`[GameRoom] Current players: ${this.state.players.size}`);
    }

    onDispose() {
        console.log("[GameRoom] Room disposed!");
    }
}

// --- Setup Server ---

const gameServer = new colyseus.Server({
    server: http.createServer(app)
});

// Register your room
gameServer.define("game_room", GameRoom);

// Serve static files (like your index.html and client-side JS)
// Adjust the path '..' if your server.js is not directly inside multiplayer-server
const staticPath = path.join(__dirname, '..');
console.log(`[Server] Serving static files from: ${staticPath}`);
app.use(express.static(staticPath));

// Start the server
gameServer.listen(port);
console.log(`[Server] Listening on ws://localhost:${port}`); 