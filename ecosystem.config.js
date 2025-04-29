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
  }],

  // Add deploy configuration
  deploy: {
    production: {
      // user: 'SSH_USERNAME', // Replace if needed
      // host: 'SSH_HOSTMACHINE', // Replace if needed
      // ref: 'origin/master', // Git branch
      // repo: 'GIT_REPOSITORY', // Your Git repo
      path: '/home/deploy/current', // Deployment path on server - **Important**
      'post-deploy': '', // Attempt to override default script
      // Optional: specify environment variables for the deployed app
      // 'env': {
      //   'NODE_ENV': 'production'
      // }
    }
  }
};
