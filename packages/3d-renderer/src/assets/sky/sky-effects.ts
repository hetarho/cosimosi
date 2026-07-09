import type { SkyNodeBuilder } from './sky-node.ts'

import { evilEyeSkyNode } from './evil-eye-sky.ts'
import { ferrofluidSkyNode } from './ferrofluid-sky.ts'
import { floatingLinesSkyNode } from './floating-lines-sky.ts'
import { grainientSkyNode } from './grainient-sky.ts'
import { iridescenceSkyNode } from './iridescence-sky.ts'
import { lightfallSkyNode } from './lightfall-sky.ts'
import { liquidEtherSkyNode } from './liquid-ether-sky.ts'
import { pixelBlastSkyNode } from './pixel-blast-sky.ts'
import { pixelSnowSkyNode } from './pixel-snow-sky.ts'
import { plasmaWaveSkyNode } from './plasma-wave-sky.ts'
import { prismaticBurstSkyNode } from './prismatic-burst-sky.ts'
import { rippleGridSkyNode } from './ripple-grid-sky.ts'
import { softAuroraSkyNode } from './soft-aurora-sky.ts'

// The emotion-sky registry: every backdrop the universe can wear, each a TSL sky-sphere effect
// ported from a react-bits Background. `faithful` effects track their source's shader math on the
// sphere surface; `adapted` effects re-create the LOOK of a source that is fundamentally screen-space
// 3D or a multi-pass simulation (it cannot live in one sphere-surface node) — honest about the seam.
//
// `emotionCounts` is how many feelings each effect reads well holding, and `defaultCount` the one it
// opens on. Gradient/field effects subdivide cleanly into many color zones; discrete-band and radial
// effects stay legible with fewer; the near-monochrome ones want one or two. This is the per-backdrop
// emotion budget the UI test exercises.

export type SkyFidelity = 'faithful' | 'adapted'

export interface SkyEffect {
  /** Stable id (kebab-case). */
  readonly key: string
  /** Display name. */
  readonly label: string
  /** One line on how the universe's emotions reshape it. */
  readonly blurb: string
  /** Whether it tracks the react-bits shader (`faithful`) or re-creates its look (`adapted`). */
  readonly fidelity: SkyFidelity
  /** The TSL color-node builder. */
  readonly build: SkyNodeBuilder
  /** Emotion counts this effect reads well holding (the panel offers these). */
  readonly emotionCounts: readonly number[]
  /** The count it opens on. */
  readonly defaultCount: number
}

export const SKY_EFFECTS = [
  {
    key: 'grainient',
    label: 'Grainient',
    blurb: 'A warped, grain-lit gradient — the palette marbles across the whole sky.',
    fidelity: 'faithful',
    build: grainientSkyNode,
    emotionCounts: [1, 3, 5, 7],
    defaultCount: 5,
  },
  {
    key: 'iridescence',
    label: 'Iridescence',
    blurb: 'An oil-slick shimmer rolling through every emotion in turn.',
    fidelity: 'faithful',
    build: iridescenceSkyNode,
    emotionCounts: [1, 3, 5, 7],
    defaultCount: 5,
  },
  {
    key: 'soft-aurora',
    label: 'Soft Aurora',
    blurb: 'Two hanging curtains of light, each its own feeling.',
    fidelity: 'faithful',
    build: softAuroraSkyNode,
    emotionCounts: [1, 2, 3, 5],
    defaultCount: 3,
  },
  {
    key: 'liquid-ether',
    label: 'Liquid Ether',
    blurb: 'Emotions smeared like dye in slow water, marbling together.',
    fidelity: 'adapted',
    build: liquidEtherSkyNode,
    emotionCounts: [3, 5, 7],
    defaultCount: 5,
  },
  {
    key: 'prismatic-burst',
    label: 'Prismatic Burst',
    blurb: 'Rays streaming outward, sweeping the palette along their length.',
    fidelity: 'faithful',
    build: prismaticBurstSkyNode,
    emotionCounts: [3, 5, 7],
    defaultCount: 5,
  },
  {
    key: 'plasma-wave',
    label: 'Plasma Wave',
    blurb: 'Two neon tubes coiling — richest when two or three emotions share the sky.',
    fidelity: 'faithful',
    build: plasmaWaveSkyNode,
    emotionCounts: [2, 3, 5],
    defaultCount: 3,
  },
  {
    key: 'ferrofluid',
    label: 'Ferrofluid',
    blurb: 'Magnetic ridges rising and merging, lit at the crests in bands of feeling.',
    fidelity: 'faithful',
    build: ferrofluidSkyNode,
    emotionCounts: [1, 3, 5],
    defaultCount: 3,
  },
  {
    key: 'floating-lines',
    label: 'Floating Lines',
    blurb: 'A woven stack of glowing waves, one filament per emotion.',
    fidelity: 'faithful',
    build: floatingLinesSkyNode,
    emotionCounts: [1, 3, 6],
    defaultCount: 6,
  },
  {
    key: 'ripple-grid',
    label: 'Ripple Grid',
    blurb: 'A grid rippling outward in concentric rings of color.',
    fidelity: 'faithful',
    build: rippleGridSkyNode,
    emotionCounts: [1, 3, 5],
    defaultCount: 3,
  },
  {
    key: 'evil-eye',
    label: 'Evil Eye',
    blurb: 'A single ocular flame — one dominant emotion, a second tinting the rim.',
    fidelity: 'faithful',
    build: evilEyeSkyNode,
    emotionCounts: [1, 2, 3],
    defaultCount: 2,
  },
  {
    key: 'lightfall',
    label: 'Lightfall',
    blurb: 'Rays of light falling, each carrying its own feeling downward.',
    fidelity: 'adapted',
    build: lightfallSkyNode,
    emotionCounts: [1, 3, 6],
    defaultCount: 3,
  },
  {
    key: 'pixel-blast',
    label: 'Pixel Blast',
    blurb: 'Pixel dots pulsing in blast rings that roll through the palette.',
    fidelity: 'adapted',
    build: pixelBlastSkyNode,
    emotionCounts: [1, 3, 5],
    defaultCount: 3,
  },
  {
    key: 'pixel-snow',
    label: 'Pixel Snow',
    blurb: 'Blocky flakes drifting on a near-monochrome sky, a second hue frosting a few.',
    fidelity: 'adapted',
    build: pixelSnowSkyNode,
    emotionCounts: [1, 2, 3],
    defaultCount: 2,
  },
] as const satisfies readonly SkyEffect[]

export type SkyEffectKey = (typeof SKY_EFFECTS)[number]['key']

export const DEFAULT_SKY_EFFECT: SkyEffectKey = 'grainient'

/** Resolve an effect key to its definition (falls back to the default effect). Keeps the narrow
 *  key/fidelity literals so callers get a `SkyEffectKey`, not a widened `string`. */
export function resolveSkyEffect(key: string): (typeof SKY_EFFECTS)[number] {
  return SKY_EFFECTS.find((effect) => effect.key === key) ?? SKY_EFFECTS[0]
}
