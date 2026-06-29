const reactNativePreset = require('@react-native/jest-preset');

/**
 * Host-only Jest config for the app-shell smoke test. Runs in Node with the
 * React Native preset's native-module mocks — no emulator.
 *
 * Two repo-specific overrides:
 * - `transform`: pin the code transformer to this app's babel.config.js via
 *   `configFile` so workspace packages (symlinked from ../../packages, outside
 *   this app's babel root) are still compiled with @react-native/babel-preset.
 * - `transformIgnorePatterns`: also transform the navigation/safe-area packages,
 *   which ship untranspiled sources.
 */
module.exports = {
  ...reactNativePreset,
  setupFiles: [...reactNativePreset.setupFiles, '<rootDir>/jest.setup.js'],
  transform: {
    ...reactNativePreset.transform,
    '^.+\\.(js|ts|tsx)$': ['babel-jest', {configFile: require.resolve('./babel.config.js')}],
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-screens|react-native-safe-area-context)/)',
  ],
};
