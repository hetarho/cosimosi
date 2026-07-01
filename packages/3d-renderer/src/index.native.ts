// React Native entry. The 3D scene, shader-art toolkit, skins, and skin seam are SHARED with
// web verbatim — only the canvas HOST forks, because R3F's web `<Canvas>` needs a DOM element
// + ResizeObserver (react-use-measure) that the RN runtime lacks. The native host drives the
// same shared scene through a manual R3F root over react-native-webgpu (see
// canvas/UniverseCanvas.native.tsx). Build setup on native:
//   1) install react-native-webgpu (+ react-native-reanimated, react-native-worklets)
//   2) patch-package @react-three/fiber so its "react-native" field resolves to the webgpu
//      web build (see the react-native-webgpu README)
//   3) metro: resolve three -> its WebGPU build
//   4) New Architecture, RN >= 0.81, custom dev client (no Expo Go); verify on a device.
// Re-export the shared surface, then override UniverseCanvas with the native host (an explicit
// named export takes precedence over the `export *` for the same name).
export * from './index.ts'
export { UniverseCanvas, type UniverseCanvasProps } from './canvas/UniverseCanvas.native.tsx'
