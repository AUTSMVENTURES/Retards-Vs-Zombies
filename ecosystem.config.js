const os = require('os');

module.exports = {
  apps: [{
    name: "colyseus-app",
    script: 'build/index.js', // Points to compiled JS
    instances: os.cpus().length,
    exec_mode: 'fork',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
