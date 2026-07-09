module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // @cosimosi/i18n's Paraglide output uses `export * as m from …`; Metro's RN preset
  // doesn't transform export-namespace by default, so enable it explicitly.
  plugins: [
    '@babel/plugin-transform-export-namespace-from',
    // three@0.185 (bundled via @cosimosi/3d-renderer) emits static class blocks that the
    // RN preset doesn't transform; enable the plugin so Metro can parse three's build.
    '@babel/plugin-transform-class-static-block',
    // react-native-reanimated v4 worklets transform — MUST stay last in the list.
    'react-native-worklets/plugin',
  ],
}
