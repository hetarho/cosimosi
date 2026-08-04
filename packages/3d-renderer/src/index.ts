// @cosimosi/3d-renderer — the cross-platform 3D rendering library. One shared source for
// web and React Native: the shader-art toolkit, composable skins, R3F scene layers, the
// skin seam, and the asset-source port. The ONLY platform fork is the canvas host
// (UniverseCanvas web here / .native sibling) — everything else is shared verbatim.
import './jsx-elements.ts'

export * from './shader-art/index.ts'
// Skins (typed instances) for the one shipped emotion sky.
export {
  UNIVERSE_SKINS,
  SKIN_KEYS,
  isSkinKey,
  type SkinKey,
  type UniverseSkin,
} from './assets/skins/presets.ts'
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
  STAR_INSTANCE_TINT,
  STAR_INSTANCE_BRIGHTNESS,
  STAR_INSTANCE_SEED,
  STAR_INSTANCE_SCALE,
} from './assets/bodies/star-body.ts'
// The star-shape bench: candidate looks for the big star, all on the star body's channel contract.
export {
  DEFAULT_STAR_SHAPE,
  STAR_SHAPES,
  createStarShapeBodySource,
  resolveStarShape,
  type StarShape,
  type StarShapeKey,
  type StarShapeOptions,
} from './assets/bodies/star-shapes.ts'
export { createCellStarBodySource } from './assets/bodies/cell-star-body.ts'
export { createFilamentBodySource, FILAMENT_VERTEX_COLOR } from './assets/bodies/filament-body.ts'
export {
  createGistStarBodySource,
  GIST_INSTANCE_TINT,
  GIST_INSTANCE_DIFFUSE,
} from './assets/bodies/gist-star-body.ts'
export { StarField, type StarFieldProps } from './layers/StarField.tsx'
export { LatentField, type LatentFieldProps } from './layers/LatentField.tsx'
export { ColorField, type ColorFieldProps } from './layers/ColorField.tsx'
export { CameraControls } from './layers/CameraControls.tsx'
export { SkySphere, type SkySphereProps } from './layers/SkySphere.tsx'
export {
  buildEmotionGradientTexture,
  updateEmotionGradientTexture,
  type GradientStop,
} from './assets/sky/emotion-gradient.ts'
export {
  SKY_EFFECTS,
  DEFAULT_SKY_EFFECT,
  resolveSkyEffect,
  type SkyEffect,
  type SkyEffectKey,
} from './assets/sky/sky-effects.ts'
export {
  COORDINATE_STRIDE,
  InstancedNodeLayer,
  type CoordinateBufferRef,
  type InstanceAttributeChannel,
  type InstanceChannels,
  type InstancedNodeLayerProps,
  type InstancePositionMapper,
} from './layers/InstancedNodeLayer.tsx'
export { BandFog, type BandFogProps } from './layers/BandFog.tsx'
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
export { UniverseCanvas, type UniverseCanvasProps } from './canvas/UniverseCanvas.tsx'
export { resolveToneMapping, type ToneMappingKey } from './canvas/tone-mapping.ts'
