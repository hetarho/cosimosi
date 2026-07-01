// @cosimosi/3d-renderer — the cross-platform 3D rendering library. One shared source for
// web and React Native: the shader-art toolkit, composable skins, R3F scene layers, the
// skin seam, and the asset-source port. The ONLY platform fork is the canvas host
// (UniverseCanvas web here / .native sibling) — everything else is shared verbatim.
import './jsx-elements.ts'

export * from './shader-art/index.ts'
export { UNIVERSE_SKINS, SKIN_KEYS, isSkinKey, type SkinKey, type UniverseSkin } from './skin/presets.ts'
export { nebulaBackgroundNode } from './skin/background-node.ts'
export {
  SkinContext,
  useSkin,
  resolveActiveSkin,
  skinValue,
  type SkinContextValue,
} from './skin-context.ts'
export { SkinProvider } from './SkinProvider.tsx'
export type { VisualBodyKind, VisualBodyRequest, VisualBodySource } from './asset-source.ts'
export { Background } from './layers/Background.tsx'
export { StarField, type StarFieldProps } from './layers/StarField.tsx'
export { PostFX } from './layers/PostFX.tsx'
export { UniverseScene } from './layers/UniverseScene.tsx'
export { UniverseCanvas, type UniverseCanvasProps } from './canvas/UniverseCanvas.tsx'
