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
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
