// @cosimosi/3d-renderer — the cross-platform 3D rendering library. One shared source for
// web and React Native: the shader-art toolkit, composable skins, R3F scene layers, the
// skin seam, and the asset-source port. The ONLY platform fork is the canvas host
// (UniverseCanvas web here / .native sibling) — everything else is shared verbatim.
import './jsx-elements.ts'

export * from './shader-art/index.ts'
// Skins (typed instances) + background types (each owns props + node-builder) + the registry.
export {
  UNIVERSE_SKINS,
  SKIN_KEYS,
  isSkinKey,
  type SkinKey,
  type UniverseSkin,
} from './assets/skins/presets.ts'
export {
  resolveBackgroundNode,
  type BackgroundType,
  type BackgroundSpec,
} from './assets/backgrounds/registry.ts'
export { nebulaBackgroundNode, type NebulaProps } from './assets/backgrounds/nebula.ts'
export { gradientBackgroundNode, type GradientProps } from './assets/backgrounds/gradient.ts'
export {
  SkinContext,
  useSkin,
  resolveActiveSkin,
  skinValue,
  type SkinContextValue,
} from './skin-context.ts'
export { SkinProvider } from './SkinProvider.tsx'
export type { VisualBodyKind, VisualBodyRequest, VisualBodySource } from './asset-source.ts'
export { createPrimitiveBodySource, type PrimitiveBodySpec } from './primitive-body-source.ts'
// Concrete visual bodies: the star / cell-star / filament looks, each through the
// asset-source port. Per-instance channel attribute names travel with the body they feed.
export {
  createStarBodySource,
  STAR_INSTANCE_TINT,
  STAR_INSTANCE_BRIGHTNESS,
  STAR_INSTANCE_SEED,
} from './assets/bodies/star-body.ts'
export { createCellStarBodySource } from './assets/bodies/cell-star-body.ts'
export { createFilamentBodySource, FILAMENT_VERTEX_COLOR } from './assets/bodies/filament-body.ts'
export { Background } from './layers/Background.tsx'
export { StarField, type StarFieldProps } from './layers/StarField.tsx'
export { LatentField, type LatentFieldProps } from './layers/LatentField.tsx'
export { ColorField, type ColorFieldProps } from './layers/ColorField.tsx'
export { CameraControls } from './layers/CameraControls.tsx'
export {
  InstancedNodeLayer,
  type CoordinateBufferRef,
  type InstanceAttributeChannel,
  type InstanceChannels,
  type InstancedNodeLayerProps,
} from './layers/InstancedNodeLayer.tsx'
export { EdgeLineLayer, type EdgeLineLayerProps } from './layers/EdgeLineLayer.tsx'
export { FatLineLayer, type FatLineLayerProps } from './layers/FatLineLayer.tsx'
export {
  NavigationRig,
  type NavigationPose,
  type NavigationPoseMode,
  type NavigationRigProps,
} from './layers/NavigationRig.tsx'
export { FrameTick } from './layers/FrameTick.tsx'
export { PostFX, type BloomParams } from './layers/PostFX.tsx'
export { UniverseScene } from './assets/UniverseScene.tsx'
export { UniverseCanvas, type UniverseCanvasProps } from './canvas/UniverseCanvas.tsx'
