import type { SkyNodeBuilder } from './sky-node.ts'

import { evilEyeSkyNode } from './evil-eye-sky.ts'
import { ferrofluidSkyNode } from './ferrofluid-sky.ts'
import { floatingLinesSkyNode } from './floating-lines-sky.ts'
import { grainientSkyNode } from './grainient-sky.ts'
import { iridescenceSkyNode } from './iridescence-sky.ts'
import { lightfallSkyNode } from './lightfall-sky.ts'
import { liquidEtherSkyNode } from './liquid-ether-sky.ts'
import { pixelBlastSkyNode } from './pixel-blast-sky.ts'
import { plasmaWaveSkyNode } from './plasma-wave-sky.ts'
import { prismaticBurstSkyNode } from './prismatic-burst-sky.ts'
import { rippleGridSkyNode } from './ripple-grid-sky.ts'
import { softAuroraSkyNode } from './soft-aurora-sky.ts'

// The emotion-sky registry: every backdrop the universe can wear, each a TSL sky-sphere effect
// ported from a react-bits Background. `faithful` effects track their source's shader math on the
// sphere surface; `adapted` effects re-create the LOOK of a source that is fundamentally screen-space
// 3D or a multi-pass simulation (it cannot live in one sphere-surface node) — honest about the seam.
//
// `defaultCount` is how many feelings each effect OPENS on — the count it reads best at. There is no
// hard ceiling: every effect accepts any emotion count 1..N (the test panel lets you pick freely),
// and each effect reshapes itself to whatever count it's handed.

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
  /** The emotion count it opens on (the count it reads best at); any count is still accepted. */
  readonly defaultCount: number
}

export const SKY_EFFECTS = [
  {
    key: 'grainient',
    label: 'Grainient',
    blurb: 'A warped, grain-lit gradient — the palette marbles across the whole sky.',
    fidelity: 'faithful',
    build: grainientSkyNode,
    defaultCount: 5,
  },
  {
    key: 'iridescence',
    label: 'Iridescence',
    blurb: 'An oil-slick shimmer rolling through every emotion in turn.',
    fidelity: 'faithful',
    build: iridescenceSkyNode,
    defaultCount: 3,
  },
  {
    key: 'soft-aurora',
    label: 'Soft Aurora',
    blurb: 'Two hanging curtains of light, each its own feeling.',
    fidelity: 'faithful',
    build: softAuroraSkyNode,
    defaultCount: 5,
  },
  {
    key: 'liquid-ether',
    label: 'Liquid Ether',
    blurb: 'Emotions smeared like dye in slow water, marbling together.',
    fidelity: 'adapted',
    build: liquidEtherSkyNode,
    defaultCount: 3,
  },
  {
    key: 'prismatic-burst',
    label: 'Prismatic Burst',
    blurb: 'Rays streaming outward, sweeping the palette along their length.',
    fidelity: 'faithful',
    build: prismaticBurstSkyNode,
    defaultCount: 1,
  },
  {
    key: 'plasma-wave',
    label: 'Plasma Wave',
    blurb: 'Neon tubes weaving and crossing around the sky — each ring rides the whole palette.',
    fidelity: 'adapted',
    build: plasmaWaveSkyNode,
    defaultCount: 3,
  },
  {
    key: 'ferrofluid',
    label: 'Ferrofluid',
    blurb: 'Magnetic ridges rising and merging, lit at the crests in bands of feeling.',
    fidelity: 'faithful',
    build: ferrofluidSkyNode,
    defaultCount: 1,
  },
  {
    key: 'floating-lines',
    label: 'Floating Lines',
    blurb: 'A woven stack of glowing waves, one filament per emotion.',
    fidelity: 'faithful',
    build: floatingLinesSkyNode,
    defaultCount: 5,
  },
  {
    key: 'ripple-grid',
    label: 'Ripple Grid',
    blurb: 'A grid rippling outward in concentric rings of color.',
    fidelity: 'faithful',
    build: rippleGridSkyNode,
    defaultCount: 2,
  },
  {
    key: 'evil-eye',
    label: 'Evil Eye',
    blurb: 'A ring of ocular flames — one eye per emotion, each sized by its intensity.',
    fidelity: 'faithful',
    build: evilEyeSkyNode,
    defaultCount: 3,
  },
  {
    key: 'lightfall',
    label: 'Lightfall',
    blurb: 'Rays of light falling, each carrying its own feeling downward.',
    fidelity: 'adapted',
    build: lightfallSkyNode,
    defaultCount: 1,
  },
  {
    key: 'pixel-blast',
    label: 'Pixel Blast',
    blurb: 'Pixel dots pulsing in blast rings that roll through the palette.',
    fidelity: 'adapted',
    build: pixelBlastSkyNode,
    defaultCount: 3,
  },
] as const satisfies readonly SkyEffect[]

export type SkyEffectKey = (typeof SKY_EFFECTS)[number]['key']

export const DEFAULT_SKY_EFFECT: SkyEffectKey = 'grainient'

/** Resolve an effect key to its definition (falls back to the default effect). Keeps the narrow
 *  key/fidelity literals so callers get a `SkyEffectKey`, not a widened `string`. */
export function resolveSkyEffect(key: string): (typeof SKY_EFFECTS)[number] {
  return SKY_EFFECTS.find((effect) => effect.key === key) ?? SKY_EFFECTS[0]
}
