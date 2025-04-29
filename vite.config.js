import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Base path - change this if hosting in a subdirectory
  // Example: '/games/fight-simulator/' if hosting at yourdomain.com/games/fight-simulator/
  base: './',
  
  // Development server settings
  server: {
    port: 5177,         // use port 5177
    strictPort: true,    // fail if 5177 is already in use
    open: false,         // Don't automatically open the browser
  },
  
  // Build options
  build: {
    // Improve chunking for better loading performance
    // Raised to 1024KB (power of two) to reduce warnings, and split major libs
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        // Simplify chunking: Group all node_modules into a 'vendor' chunk
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    },
    // Ensure assets are handled correctly
    assetsInlineLimit: 0, // Don't inline any assets as base64
    // Copy the models directory to the output directory
    copyPublicDir: true
  },
  
  // Resolve paths
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
