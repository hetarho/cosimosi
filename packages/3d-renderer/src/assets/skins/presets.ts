// Universe "skins" — the non-domain ambiance of the background/environment. A skin is a
// typed instance: it picks a background TYPE (which carries that type's props) plus
// scene-level ambiance (bloom, camera) that applies to any type. It carries no domain
// meaning — emotion/position/strength stay owned by the domain ([I3][I11]). The ACTIVE skin
// is a build-time constant (spec/values.yaml → rendering.active_skin); re-skin by editing
// these or that constant. Shared verbatim by web and React Native.
import type { BackgroundSpec } from '../backgrounds/registry.ts'
import type { BloomParams } from '../../layers/PostFX.tsx'

export type SkinKey = 'aurora' | 'ember' | 'void' | 'dawn'

export interface UniverseSkin {
  readonly key: SkinKey
  readonly label: string
  /** Which background this skin draws + that type's props (discriminated by `type`). */
  readonly background: BackgroundSpec
  /** Scene-level bloom (post) — applies to any background type. */
  readonly bloom: BloomParams
  /** Scene-level camera mood. */
  readonly camera: { readonly fov: number }
}

export const UNIVERSE_SKINS: Record<SkinKey, UniverseSkin> = {
  aurora: {
    key: 'aurora',
    label: 'Aurora',
    background: {
      type: 'nebula',
      props: {
        clear: [0.01, 0.02, 0.05],
        palette: [0x070a1a, 0x1b2a6b, 0x2f8f9d],
        pattern: { warp: 0.55, freq: 1.6, detail: 1.4 },
      },
    },
    bloom: { strength: 0.9, radius: 0.6, threshold: 0.2 },
    camera: { fov: 55 },
  },
  ember: {
    key: 'ember',
    label: 'Ember',
    background: {
      type: 'nebula',
      props: {
        clear: [0.04, 0.02, 0.02],
        palette: [0x0a0506, 0x4a1530, 0xb5532a],
        pattern: { warp: 0.8, freq: 1.9, detail: 1.7 },
      },
    },
    bloom: { strength: 1.1, radius: 0.5, threshold: 0.25 },
    camera: { fov: 55 },
  },
  void: {
    key: 'void',
    label: 'Void',
    background: {
      type: 'nebula',
      props: {
        clear: [0.0, 0.0, 0.01],
        palette: [0x02030a, 0x140a2e, 0x4151a0],
        pattern: { warp: 0.4, freq: 1.2, detail: 1.1 },
      },
    },
    bloom: { strength: 0.7, radius: 0.7, threshold: 0.15 },
    camera: { fov: 50 },
  },
  dawn: {
    key: 'dawn',
    label: 'Dawn',
    background: {
      type: 'gradient',
      props: { top: 0x1a2a52, bottom: 0xe9a17c },
    },
    bloom: { strength: 0.6, radius: 0.6, threshold: 0.3 },
    camera: { fov: 55 },
  },
}

export const SKIN_KEYS = Object.keys(UNIVERSE_SKINS) as SkinKey[]

export function isSkinKey(value: string): value is SkinKey {
  return value in UNIVERSE_SKINS
}
