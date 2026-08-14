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
// The gist-shape bench: candidate looks for the gist body, all on the gist body's channel contract.
export {
  DEFAULT_GIST_SHAPE,
  GIST_SHAPES,
  GIST_TRIANGLE_CEILING,
  createGistShapeBodySource,
  resolveGistShape,
  type GistShape,
  type GistShapeKey,
  type GistShapeOptions,
} from './assets/bodies/gist-shapes.ts'
export { createCellStarBodySource } from './assets/bodies/cell-star-body.ts'
export { createFilamentBodySource, FILAMENT_VERTEX_COLOR } from './assets/bodies/filament-body.ts'
export {
  createGistStarBodySource,
  GIST_INSTANCE_TINT,
  GIST_INSTANCE_DIFFUSE,
} from './assets/bodies/gist-star-body.ts'
// The backdrop: a MOTE (one particle's form · size · colour) poured into a FIELD (where they sit, how
// many, how they twinkle). Two catalogues, and every pair of rows is a backdrop; the named pairs are
// the themes.
export {
  BACKDROP_THEMES,
  BACKDROP_TRIANGLE_CEILING,
  DEFAULT_BACKDROP_PAIR,
  DEFAULT_BACKDROP_THEME,
  backdropTriangleCost,
  resolveBackdropTheme,
  type BackdropTheme,
  type BackdropThemeKey,
} from './assets/backdrop/backdrop-themes.ts'
export {
  BACKDROP_MOTES,
  DEFAULT_BACKDROP_MOTE,
  MOTE_RADIUS,
  backdropMoteFormTriangles,
  backdropMoteTriangles,
  createBackdropMoteForm,
  resolveBackdropMote,
  type BackdropMote,
  type BackdropMoteForm,
  type BackdropMoteFormKey,
  type BackdropMoteKey,
} from './assets/backdrop/backdrop-motes.ts'
export {
  BACKDROP_FIELDS,
  DEFAULT_BACKDROP_FIELD,
  backdropMoteCount,
  resolveBackdropField,
  type BackdropField,
  type BackdropFieldKey,
} from './assets/backdrop/backdrop-fields.ts'
export {
  backdropBrightness,
  backdropTint,
  type BackdropGraphInputs,
  type BackdropLifeKey,
  type BackdropToneKey,
  type BackdropTwinkle,
} from './assets/backdrop/backdrop-life.ts'
export {
  scatterBackdrop,
  seededRandom,
  type BackdropScatterKey,
  type BackdropScatterResult,
  type BackdropScatterSpec,
} from './assets/backdrop/backdrop-scatter.ts'
export { SKY_SPHERE_RADIUS, UNIVERSE_CANVAS_FAR } from './backdrop-scale.ts'
export {
  STAR_FIELD_PROFILE,
  StarField,
  type StarFieldProfile,
  type StarFieldProps,
} from './layers/StarField.tsx'
export { LATENT_FIELD_SEGMENTS, LatentField, type LatentFieldProps } from './layers/LatentField.tsx'
export { ColorField, type ColorFieldProps } from './layers/ColorField.tsx'
export { CameraControls, type CameraControlsProps } from './layers/CameraControls.tsx'
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
  type InstanceAnimationRevisionRef,
  type InstanceAttributeChannel,
  type InstanceChannels,
  type InstancedNodeLayerProps,
  type InstancePositionMapper,
} from './layers/InstancedNodeLayer.tsx'
export { AdaptiveDprLayer, type AdaptiveDprLayerProps } from './layers/AdaptiveDprLayer.tsx'
export {
  ADAPTIVE_DPR_FLOOR,
  createAdaptiveDprSampler,
  sampleAdaptiveDpr,
  type AdaptiveDprSampler,
  type AdaptiveDprThresholds,
} from './layers/adaptive-dpr.ts'
export { BandFog, type BandFogProps } from './layers/BandFog.tsx'
export { FatLineLayer, type FatLineLayerProps } from './layers/FatLineLayer.tsx'
export {
  NavigationRig,
  type NavigationPose,
  type NavigationPoseMode,
  type NavigationRigProps,
  type PinnedView,
} from './layers/NavigationRig.tsx'
export {
  createPinnedOffset,
  pinnedCameraPosition,
  readPinnedOffset,
  type PinnedEnvelope,
  type PinnedOffset,
} from './layers/pinned-pose.ts'
export { FrameTick } from './layers/FrameTick.tsx'
export { SceneExposure } from './layers/SceneExposure.tsx'
export { SpinGroup, type SpinGroupProps } from './layers/SpinGroup.tsx'
export { PostFX, type BloomParams } from './layers/PostFX.tsx'
export { UniverseCanvas, type UniverseCanvasProps } from './canvas/UniverseCanvas.tsx'
export { resolveToneMapping, type ToneMappingKey } from './canvas/tone-mapping.ts'
