// React Native entry. The 3D scene, shader-art toolkit, skins, seam, and the R3F canvas
// are SHARED with web verbatim — only the BUILD SETUP forks on native, not the code:
//   1) install react-native-webgpu (+ react-native-reanimated, react-native-worklets)
//   2) patch-package @react-three/fiber so its "react-native" field resolves to the webgpu
//      web build (see the react-native-webgpu README)
//   3) metro: resolve three -> its WebGPU build
//   4) New Architecture, RN >= 0.81, custom dev client (no Expo Go); verify on a device.
// With that setup react-native-webgpu polyfills the canvas + WebGPU so the same R3F scene
// runs on device. The code stays shared; this entry re-exports the web one.
export * from './index.ts'
