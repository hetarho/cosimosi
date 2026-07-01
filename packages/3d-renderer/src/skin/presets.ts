// Universe "skins" — the non-domain ambiance of the background/environment. A skin is
// pure data (palette + pattern params) that the shader-art toolkit composes into a look
// (skin/background-node). It carries no domain meaning — emotion/position/strength stay
// owned by the domain ([I3][I11]). The ACTIVE skin is a build-time constant
// (spec/values.yaml → rendering.active_skin); re-skin by editing these or that constant.
// Shared verbatim by web and React Native — the single cross-platform skin source.

export type SkinKey = 'aurora' | 'ember' | 'void'

export interface UniverseSkin {
  readonly key: SkinKey
  readonly label: string
  /** Renderer clear color, linear RGB 0..1. */
  readonly clear: readonly [number, number, number]
  /** Nebula palette hues (hex): [base, mid, highlight] the background composes between. */
  readonly palette: readonly [number, number, number]
  /** Toolkit tuning: domain-warp amount, base frequency, density contrast. */
  readonly pattern: { readonly warp: number; readonly freq: number; readonly detail: number }
  readonly bloom: { readonly strength: number; readonly radius: number; readonly threshold: number }
  readonly camera: { readonly fov: number }
}

export const UNIVERSE_SKINS: Record<SkinKey, UniverseSkin> = {
  aurora: {
    key: 'aurora',
    label: 'Aurora',
    clear: [0.01, 0.02, 0.05],
    palette: [0x070a1a, 0x1b2a6b, 0x2f8f9d],
    pattern: { warp: 0.55, freq: 1.6, detail: 1.4 },
    bloom: { strength: 0.9, radius: 0.6, threshold: 0.2 },
    camera: { fov: 55 },
  },
  ember: {
    key: 'ember',
    label: 'Ember',
    clear: [0.04, 0.02, 0.02],
    palette: [0x0a0506, 0x4a1530, 0xb5532a],
    pattern: { warp: 0.8, freq: 1.9, detail: 1.7 },
    bloom: { strength: 1.1, radius: 0.5, threshold: 0.25 },
    camera: { fov: 55 },
  },
  void: {
    key: 'void',
    label: 'Void',
    clear: [0.0, 0.0, 0.01],
    palette: [0x02030a, 0x140a2e, 0x4151a0],
    pattern: { warp: 0.4, freq: 1.2, detail: 1.1 },
    bloom: { strength: 0.7, radius: 0.7, threshold: 0.15 },
    camera: { fov: 50 },
  },
}

export const SKIN_KEYS = Object.keys(UNIVERSE_SKINS) as SkinKey[]

export function isSkinKey(value: string): value is SkinKey {
  return value in UNIVERSE_SKINS
}
