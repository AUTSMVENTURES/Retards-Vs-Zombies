const { Server } = require('colyseus');
const { createServer } = require('http');
const express = require('express');
const cors = require('cors');
const { GameRoom } = require('./rooms/GameRoom');
const { WebSocketTransport } = require('@colyseus/ws-transport');

// Create express app and HTTP server
const app = express();
const port = process.env.PORT || 2567;

// Define CORS options
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5177', // Explicitly allow Vite dev server origin
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5177',
    'https://retardedfightsimulator2.netlify.app'
  ],
  credentials: false, // Explicitly disable credentials
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Apply CORS to Express routes
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Serve static files (optional - for future admin panel or client hosting)
app.use(express.static('public'));

// Add a simple status endpoint
app.get('/status', (req, res) => {
  res.json({ status: 'Server running', time: new Date().toISOString() });
});

// Create HTTP & WebSocket servers
const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer
  })
});

// Make sure the server knows about your room - add debugging
console.log('Registering game_room with Colyseus server');

// Register your room handlers with explicit options
gameServer.define('game_room', GameRoom, {
  maxClients: 16,  // Optional: limit number of clients per room
  metadata: { gameType: 'dune-combat' }
});

// Debug endpoint to check registration
app.get('/room-status', (req, res) => {
  res.json({
    availableRooms: gameServer.matchMaker.rooms.map(r => r.roomId),
    registeredHandlers: Object.keys(gameServer.matchMaker.handlers)
  });
});

// Start server
httpServer.listen(port, () => {
  console.log(`
=================================
 Multiplayer server running!
 Listening on port ${port}
=================================
  `);
});
