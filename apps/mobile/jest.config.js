const reactNativePreset = require('@react-native/jest-preset')

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
  // Full-app render tests (App smoke test, deletion-flow sheet) mount deep RN trees whose
  // `waitFor` polling gets starved on a busy multi-worker CI runner; the 5s default is too
  // tight there even though each test is sub-second in isolation. Give them headroom.
  testTimeout: 20000,
  setupFiles: [...reactNativePreset.setupFiles, '<rootDir>/jest.setup.js'],
  transform: {
    ...reactNativePreset.transform,
    '^.+\\.(js|ts|tsx)$': ['babel-jest', { configFile: require.resolve('./babel.config.js') }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-screens|react-native-safe-area-context)/)',
  ],
  // The shell smoke tests exercise the shell, not the WebGPU renderer; stub the 3D
  // package so jest doesn't load three (ESM, untransformed in this host config).
  moduleNameMapper: {
    ...reactNativePreset.moduleNameMapper,
    '^@cosimosi/3d-renderer$': '<rootDir>/jest.mock.3d-renderer.tsx',
  },
}
