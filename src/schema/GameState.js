import { Schema, MapSchema } from '@colyseus/schema';

// Define a Player schema for syncing player data
class Player extends Schema {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.rotationY = 0;
    this.animation = 'idle';
    this.isJumping = false;
  }
}

// Define types for serialization using static schema property
Player.schema = {
  x: "number",
  y: "number",
  z: "number",
  rotationY: "number",
  animation: "string",
  isJumping: "boolean"
};

// Main game state that holds all players
class GameState extends Schema {
  constructor() {
    super();
    // MapSchema is like a synchronized Map that handles add/remove events
    this.players = new MapSchema();
  }

  createPlayer(sessionId) {
    console.log(`Creating player in MapSchema: ${sessionId}`);
    this.players.set(sessionId, new Player());
    console.log(`Player MapSchema size after add: ${this.players.size}`);
  }

  removePlayer(sessionId) {
    console.log(`Removing player from MapSchema: ${sessionId}`);
    this.players.delete(sessionId);
    console.log(`Player MapSchema size after remove: ${this.players.size}`);
  }

  // UpdatePlayer might not be needed for this test, but keep the structure
  updatePlayer(sessionId, data) {
    const player = this.players.get(sessionId);
    if (player) {
      // Update player properties
      player.x = data.x || player.x;
      player.y = data.y || player.y;
      player.z = data.z || player.z;
      player.rotationY = data.rotationY || player.rotationY;
      player.animation = data.animation || player.animation;
      player.isJumping = data.isJumping !== undefined ? data.isJumping : player.isJumping;
    } else {
      console.warn(`updatePlayer called for unknown sessionId ${sessionId}`);
    }
  }
}

// Define types for serialization using static schema property
GameState.schema = {
  players: { map: Player }
};

export { GameState, Player };
