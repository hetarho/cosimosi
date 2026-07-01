module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // @cosimosi/i18n's Paraglide output uses `export * as m from …`; Metro's RN preset
  // doesn't transform export-namespace by default, so enable it explicitly.
  plugins: [
    '@babel/plugin-transform-export-namespace-from',
    // react-native-reanimated v4 worklets transform — MUST stay last in the list.
    'react-native-worklets/plugin',
  ],
};
