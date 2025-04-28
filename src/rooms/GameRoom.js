const { Room } = require('colyseus');
const { GameState, Player } = require('../schema/GameState');

class GameRoom extends Room {
  onCreate(options) {
    console.log("GameRoom: onCreate started.");
    console.log("Game room created options:", options);

    // Initialize room state
    console.log("GameRoom: Setting state...");
    this.setState(new GameState());
    console.log("GameRoom: State set successfully.");

    // Handle player movement messages
    console.log("GameRoom: Registering 'move' message handler...");
    this.onMessage("move", (client, data) => {
      this.state.updatePlayer(client.sessionId, data);
    });
    console.log("GameRoom: 'move' message handler registered.");

    // Handle player animation change messages
    console.log("GameRoom: Registering 'animation' message handler...");
    this.onMessage("animation", (client, data) => {
      this.state.updatePlayer(client.sessionId, {
        animation: data.animation
      });
    });
    console.log("GameRoom: 'animation' message handler registered.");

    // Handle jump state messages
    console.log("GameRoom: Registering 'jump' message handler...");
    this.onMessage("jump", (client, data) => {
      this.state.updatePlayer(client.sessionId, {
        isJumping: data.isJumping
      });
    });
    console.log("GameRoom: 'jump' message handler registered.");

    // Handler for clients requesting the full player list
    this.onMessage("getFullState", (client) => {
      console.log(`GameRoom: Received 'getFullState' request from ${client.sessionId}`);
      const allPlayersData = {};
      this.state.players.forEach((player, sessionId) => {
        // Convert player schema object to a plain JS object for sending
        // (Adjust properties based on your Player schema)
        allPlayersData[sessionId] = {
          x: player.x,
          y: player.y,
          z: player.z,
          rotY: player.rotY,
          animState: player.animState
          // Add other relevant player properties here
        };
      });
      console.log(`GameRoom: Sending 'fullStateResponse' to ${client.sessionId} with ${Object.keys(allPlayersData).length} players.`);
      client.send("fullStateResponse", allPlayersData);
    });

    // Set the simulation interval (optional)
    console.log("GameRoom: Setting simulation interval...");
    this.setSimulationInterval(() => this.update(), 1000 / 60); // 60 fps
    console.log("GameRoom: Simulation interval set.");
    console.log("GameRoom: onCreate finished.");
  }

  onJoin(client, options) {
    console.log(`GameRoom: onJoin started for client ${client.sessionId}`);
    console.log(`Player joined: ${client.sessionId}`);

    // Directly add the player to the state map
    console.log(`GameRoom: Attempting direct state.players.set for ${client.sessionId}. Current player map size: ${this.state.players.size}`);
    this.state.players.set(client.sessionId, new Player());
    console.log(`GameRoom: Direct state.players.set completed for ${client.sessionId}. Current player map size: ${this.state.players.size}`);

    console.log(`GameRoom: onJoin finished for client ${client.sessionId}. Final player map size: ${this.state.players.size}`);
  }

  onLeave(client, consented) {
    console.log(`GameRoom: onLeave started for client ${client.sessionId}, consented: ${consented}`);
    try {
        console.log(`GameRoom: Attempting state.removePlayer for ${client.sessionId}. Current player map size: ${this.state.players.size}`);
        this.state.removePlayer(client.sessionId); // This now logs map size internally
        console.log(`GameRoom: state.removePlayer called for ${client.sessionId}. Final player map size: ${this.state.players.size}`);
    } catch (e) {
        console.error(`GameRoom: Error during removePlayer for ${client.sessionId}:`, e);
    }
    console.log(`GameRoom: onLeave finished for client ${client.sessionId}`);
  }

  update() {
    // console.log("GameRoom: update tick"); // Optional: uncomment for verbose logging
    // This method is called at the simulation interval
    // You can add server-side game logic here if needed
  }

  onDispose() {
    console.log("GameRoom: onDispose started.");
    console.log("GameRoom: onDispose finished.");
  }
}

module.exports = { GameRoom };
