// Jest mock for @cosimosi/3d-renderer. The shell smoke tests run in Node and exercise
// the shell, not the WebGPU renderer; the real package pulls in three (ESM) which the
// host jest env doesn't transform. Stub the surface the nav tree imports.
import * as React from 'react'

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
export const EdgeLineLayer = Noop
export const FatLineLayer = Noop
export const NavigationRig = Noop
export const FrameTick = Noop
export const createPrimitiveBodySource = () => ({ resolve: () => ({}) })
export const DEFAULT_STAR_SHAPE = 'orb'
export const createStarShapeBodySource = () => ({ resolve: () => ({}) })
export const createCellStarBodySource = () => ({ resolve: () => ({}) })
export const createFilamentBodySource = () => ({ resolve: () => ({}) })
export const createGistStarBodySource = () => ({ resolve: () => ({}) })
export const COORDINATE_STRIDE = 3
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
