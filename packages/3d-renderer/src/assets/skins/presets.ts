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
    // `threshold` decides WHAT glows, and it has to thread between two failures. At 0.2 the colour
    // field's diffuse haze qualified, so the pass blurred the whole glow back across the bodies and
    // buried each star's surface under a flat lift. Pushed too far the other way (0.55+) nothing
    // qualifies at all and the stars stop emitting — they read as opaque matte solids sitting in
    // space rather than as light. 0.4 sits above the field's peak amplitude (nebula.base_intensity
    // times a mood tint, all of it below 0.4) and below a star's lit crowns, so the bodies glow and
    // the haze does not.
    bloom: { strength: 0.65, radius: 0.6, threshold: 0.4 },
    camera: { fov: 55 },
  },
}

export const SKIN_KEYS = Object.keys(UNIVERSE_SKINS) as SkinKey[]

export function isSkinKey(value: string): value is SkinKey {
  return value in UNIVERSE_SKINS
}
