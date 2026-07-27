// Universe "skins" — the non-domain ambiance of the environment. The retired gradient/nebula
// presets are deliberately gone: the shipped universe now has one emotion-driven sky on both
// platforms. The seam remains typed so future visual skins can be added without leaking domain
// meaning into the renderer ([I3][I11]).
import type { SkyEffectKey } from '../sky/sky-effects.ts'
import type { BloomParams } from '../../layers/PostFX.tsx'

export type SkinKey = 'emotion'

export interface UniverseSkin {
  readonly key: SkinKey
  readonly label: string
  /** The enclosing emotion sky plus its opaque bare-night clear color. */
  readonly sky: {
    readonly effect: SkyEffectKey
    readonly night: number
  }
  /** Scene-level bloom (post). */
  readonly bloom: BloomParams
  /** Scene-level camera mood. */
  readonly camera: { readonly fov: number }
}

export const UNIVERSE_SKINS: Record<SkinKey, UniverseSkin> = {
  emotion: {
    key: 'emotion',
    label: 'Emotion Sky',
    // `night` matches the emotion ramp's bare-night base (#0a0a12), so the translucent sphere
    // and the canvas clear read as one continuous sky with no legacy background layer beneath it.
    sky: { effect: 'grainient', night: 0x0a0a12 },
    bloom: { strength: 0.9, radius: 0.6, threshold: 0.2 },
    camera: { fov: 55 },
  },
}

export const SKIN_KEYS = Object.keys(UNIVERSE_SKINS) as SkinKey[]

export function isSkinKey(value: string): value is SkinKey {
  return value in UNIVERSE_SKINS
}
