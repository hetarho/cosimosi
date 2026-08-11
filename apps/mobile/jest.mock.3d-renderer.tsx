// Jest mock for @cosimosi/3d-renderer. The shell smoke tests run in Node and exercise
// the shell, not the WebGPU renderer; the real package pulls in three (ESM) which the
// host jest env doesn't transform. Stub the surface the nav tree imports.
import * as React from 'react'

import { VALUES } from '@cosimosi/config'

const Passthrough = ({ children }: { children?: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children)
const Noop = () => null

export const UniverseCanvas = Passthrough
export const SkinProvider = Passthrough
export const SkySphere = Noop
export const StarField = Noop
export const LatentField = Noop
export const ColorField = Noop
export const BandFog = Noop
export const PostFX = Noop
export const InstancedNodeLayer = Noop
export const FatLineLayer = Noop
export const NavigationRig = Noop
export const FrameTick = Noop
export const SceneExposure = Noop
// Passthrough, not Noop: it wraps the body it turns, so stubbing it out would take the star with it.
export const SpinGroup = Passthrough
export const AdaptiveDprLayer = Noop
// The floor the shell's `dpr` range starts at — a real number, because the shell passes it to the
// canvas host and a test reading that prop should see what ships.
export const ADAPTIVE_DPR_FLOOR = 1
export const createPrimitiveBodySource = () => ({ resolve: () => ({}) })
export const DEFAULT_STAR_SHAPE = 'orb'
export const createStarShapeBodySource = () => ({ resolve: () => ({}) })
export const createCellStarBodySource = () => ({ resolve: () => ({}) })
export const createFilamentBodySource = () => ({ resolve: () => ({}) })
export const createGistStarBodySource = () => ({ resolve: () => ({}) })
export const COORDINATE_STRIDE = 3
// Real numbers, not stand-ins: a shell test asserting the mobile budget must fail when the mobile
// budget moves, and these ARE just the generated scalars.
export const STAR_FIELD_PROFILE = {
  web: { count: VALUES.rendering.starFieldCount, radius: VALUES.rendering.starFieldRadius },
  mobile: {
    count: VALUES.rendering.starFieldCountMobile,
    radius: VALUES.rendering.starFieldRadiusMobile,
  },
}
export const LATENT_FIELD_SEGMENTS = {
  web: VALUES.rendering.latentStarSegments,
  mobile: VALUES.rendering.latentStarSegmentsMobile,
}
export const STAR_INSTANCE_TINT = 'aStarTint'
export const STAR_INSTANCE_BRIGHTNESS = 'aStarBrightness'
export const STAR_INSTANCE_SEED = 'aStarSeed'
export const STAR_INSTANCE_SCALE = 'aStarScale'
export const GIST_INSTANCE_TINT = 'aGistTint'
export const GIST_INSTANCE_DIFFUSE = 'aGistDiffuse'
export const FILAMENT_VERTEX_COLOR = 'aFilamentColor'
export const SKY_EFFECTS = [
  {
    key: 'grainient',
    label: 'Grainient',
    blurb: '',
    build: () => null,
    opacity: 0.9,
    headroom: 0.72,
  },
]
export const DEFAULT_SKY_EFFECT = 'grainient'
export const resolveSkyEffect = () => SKY_EFFECTS[0]
export const useSkin = () => ({
  skin: {
    key: 'emotion',
    label: 'Emotion Sky',
    sky: { effect: 'grainient', night: 0x0a0a12 },
    camera: { fov: 55 },
    bloom: { strength: 1, radius: 0.5, threshold: 0.2 },
  },
  skinKey: 'emotion',
  setSkinKey: () => {},
})
export const resolveActiveSkin = (key: string) => key
export const UNIVERSE_SKINS = {
  emotion: {
    key: 'emotion',
    label: 'Emotion Sky',
    sky: { effect: 'grainient', night: 0x0a0a12 },
    camera: { fov: 55 },
    bloom: { strength: 1, radius: 0.5, threshold: 0.2 },
  },
}
