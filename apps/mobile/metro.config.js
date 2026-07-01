const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const workspaceRoot = path.resolve(__dirname, '../..');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * In this pnpm monorepo, dependencies are hoisted to the repo-root node_modules
 * (.npmrc node-linker=hoisted), so Metro must watch the root and resolve modules
 * from both the app and the root.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    // react-native-webgpu: resolve bare `three` to its WebGPU build so the shared
    // @cosimosi/3d-renderer scene runs on the native WebGPU backend (README guidance).
    // Resolve bare `three` to its WebGPU build so the shared @cosimosi/3d-renderer scene
    // runs on the native WebGPU backend. (@react-three/fiber → web build is handled by the
    // patch in patches/, per the react-native-webgpu README, so no redirect needed here.)
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'three') {
        return context.resolveRequest(context, 'three/webgpu', platform);
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
