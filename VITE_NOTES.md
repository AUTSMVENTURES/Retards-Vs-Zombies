# Vite Development Notes

## Path Resolution Issues

### Problem
Vite handles path resolution differently between development and production builds:
- In development mode, relative paths (`./models/file.fbx`) work fine
- In production builds, these paths may not resolve correctly, causing assets to fail loading

### Solution
Use absolute paths (starting with `/`) for all asset loading:
- ✅ `/models/file.fbx` - Works in both development and production
- ❌ `./models/file.fbx` - May fail in production builds

### Affected Code Patterns
- FBX model loading: `loader.load('/models/file.fbx', ...)`
- Animation loading: `loader.load(`/models/${anim.file}`, ...)`
- Collision map loading: `loadCollisionMap('/models/file.fbx', ...)`

### Examples of Fixed Code

```javascript
// Before (problematic in production)
loader.load('./models/character.fbx', (fbx) => {
  // Process model
});

// After (works in both development and production)
loader.load('/models/character.fbx', (fbx) => {
  // Process model
});
```

## Other Vite-Related Notes

- Make sure all assets are placed in the `public` directory for proper bundling
- For dynamically loaded assets, use absolute paths
- When using import.meta.url for asset paths, be cautious as this may behave differently in production

## References
- [Vite Static Asset Handling](https://vitejs.dev/guide/assets.html)
- [Vite Build Production](https://vitejs.dev/guide/build.html)
