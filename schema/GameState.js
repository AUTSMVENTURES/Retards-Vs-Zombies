"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player = exports.GameState = void 0;
const schema_1 = require("@colyseus/schema");
// Define a Player schema for syncing player data
class Player extends schema_1.Schema {
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
exports.Player = Player;
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], Player.prototype, "x", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], Player.prototype, "y", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], Player.prototype, "z", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], Player.prototype, "rotationY", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], Player.prototype, "animation", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], Player.prototype, "isJumping", void 0);
// Main game state that holds all players
class GameState extends schema_1.Schema {
    constructor() {
        super();
        this.players = new schema_1.MapSchema();
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
            // Movement logs commented out for development performance
            console.log(`[Server UPDATE] Updating player ${sessionId}:`);
            console.log(`  Current : x=${player.x?.toFixed(4)}, y=${player.y?.toFixed(4)}, z=${player.z?.toFixed(4)}, rotY=${player.rotationY?.toFixed(4)}, isJumping=${player.isJumping}`);
            console.log(`  Incoming: x=${data.x?.toFixed(4)}, y=${data.y?.toFixed(4)}, z=${data.z?.toFixed(4)}, rotY=${data.rotationY?.toFixed(4)}, isJumping=${data.isJumping}`);
            // Update player properties using ?? and stricter boolean check
            player.x = data.x ?? player.x;
            player.y = data.y ?? player.y;
            player.z = data.z ?? player.z;
            player.rotationY = data.rotationY ?? player.rotationY;
            player.animation = data.animation ?? player.animation;
            player.isJumping = typeof data.isJumping === 'boolean' ? data.isJumping : player.isJumping;
            console.log(`  Updated : x=${player.x?.toFixed(4)}, y=${player.y?.toFixed(4)}, z=${player.z?.toFixed(4)}, rotY=${player.rotationY?.toFixed(4)}, isJumping=${player.isJumping}`);
        }
        else {
            console.warn(`GameState: updatePlayer called for unknown sessionId ${sessionId}`);
        }
    }
}
exports.GameState = GameState;
__decorate([
    (0, schema_1.type)({ map: Player }),
    __metadata("design:type", Object)
], GameState.prototype, "players", void 0);
