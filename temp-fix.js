// Multiplayer variables - add these to your main.js file at the global scope
let otherPlayers = new Map();
let isMultiplayerConnected = false;
let lastUpdateSent = 0;
const UPDATE_INTERVAL = 50;
