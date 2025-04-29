import { Schema, MapSchema, type } from '@colyseus/schema';

// Define a Player schema for syncing player data
class Player extends Schema {
  @type("number")
  x: number = 0;
  @type("number")
  y: number = 0;
  @type("number")
  z: number = 0;
  @type("number")
  rotationY: number = 0;
  @type("string")
  animation: string = 'idle';
  @type("boolean")
  isJumping: boolean = false;

  constructor() {
    super();
  }
}

// Main game state that holds all players
class GameState extends Schema {
  @type({ map: Player })
  players = new MapSchema<Player>();

  constructor() {
    super();
  }

  createPlayer(sessionId: string) {
    console.log(`Creating player in MapSchema: ${sessionId}`);
    this.players.set(sessionId, new Player());
    console.log(`Player MapSchema size after add: ${this.players.size}`);
  }

  removePlayer(sessionId: string) {
    console.log(`Removing player from MapSchema: ${sessionId}`);
    this.players.delete(sessionId);
    console.log(`Player MapSchema size after remove: ${this.players.size}`);
  }

  // UpdatePlayer might not be needed for this test, but keep the structure
  updatePlayer(sessionId: string, data: any) {
    const player = this.players.get(sessionId);
    if (player) {
      // Movement logs commented out for development performance
      // console.log(`[Server UPDATE] Updating player ${sessionId}:`);
      // console.log(`  Current : x=${player.x?.toFixed(4)}, y=${player.y?.toFixed(4)}, z=${player.z?.toFixed(4)}, rotY=${player.rotationY?.toFixed(4)}, isJumping=${player.isJumping}`);
      // console.log(`  Incoming: x=${data.x?.toFixed(4)}, y=${data.y?.toFixed(4)}, z=${data.z?.toFixed(4)}, rotY=${data.rotationY?.toFixed(4)}, isJumping=${data.isJumping}`);

      // Update player properties using ?? and stricter boolean check
      player.x = data.x ?? player.x; 
      player.y = data.y ?? player.y;
      player.z = data.z ?? player.z;
      player.rotationY = data.rotationY ?? player.rotationY;
      player.animation = data.animation ?? player.animation;
      player.isJumping = typeof data.isJumping === 'boolean' ? data.isJumping : player.isJumping; 

      // console.log(`  Updated : x=${player.x?.toFixed(4)}, y=${player.y?.toFixed(4)}, z=${player.z?.toFixed(4)}, rotY=${player.rotationY?.toFixed(4)}, isJumping=${player.isJumping}`);
    } else {
      console.warn(`GameState: updatePlayer called for unknown sessionId ${sessionId}`);
    }
  }
}

export { GameState, Player };
