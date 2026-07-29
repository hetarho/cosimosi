import { VALUES } from '@cosimosi/config'

import type { SkyNodeBuilder } from './sky-node.ts'

import { evilEyeSkyNode } from './evil-eye-sky.ts'
import { ferrofluidSkyNode } from './ferrofluid-sky.ts'
import { floatingLinesSkyNode } from './floating-lines-sky.ts'
import { grainientSkyNode } from './grainient-sky.ts'
import { grainstormSkyNode } from './grainstorm-sky.ts'
import { iridescenceSkyNode } from './iridescence-sky.ts'
import { lightfallSkyNode } from './lightfall-sky.ts'
import { liquidEtherSkyNode } from './liquid-ether-sky.ts'
import { pixelBlastSkyNode } from './pixel-blast-sky.ts'
import { plasmaWaveSkyNode } from './plasma-wave-sky.ts'
import { prismaticBurstSkyNode } from './prismatic-burst-sky.ts'
import { softAuroraSkyNode } from './soft-aurora-sky.ts'

// The catalogue of backdrops a universe can wear. Each is a RECIPE — an arrangement of the four sky
// axes (domain · field · emotion · finish) — and the catalogue grows by arranging them differently, not
// by hand-writing another shader. A primitive added to an axis multiplies across every row here; a
// trick inlined into one recipe helps exactly one row, which is why the axes are where the work goes.
//
// There is no fidelity field and no notion of a source to be faithful to. These looks were arrived at
// by looking, and a row's only obligations are the ones below.
//
// No recipe caps how many feelings it will take. The emotion axis divides the sphere by weight — a
// feeling's territory IS its share — so a recipe handed thirteen feelings shows thirteen smaller places
// rather than muddying five. A cap would only be re-deciding, per recipe, something the partition
// already answers correctly for all of them.
//
// `headroom` is the ceiling a recipe holds itself under, leaving the rest of the range for the light
// ADDED on top of it — the stars, the nebula field, the bloom pass. Addition over an already-bright
// surface passes 1 in every channel at once, which is white, so the wider and brighter a recipe fills
// the frame the lower its ceiling has to be.

export interface SkyEffect {
  /** Stable id (kebab-case). */
  readonly key: string
  /** Display name. */
  readonly label: string
  /** One line on how the universe's emotions reshape it. */
  readonly blurb: string
  /** The TSL colour-node builder. */
  readonly build: SkyNodeBuilder
  /** Effect-specific alpha: dense fills are clearer; sparse marks retain more presence. */
  readonly opacity: number
  /** The ceiling this recipe holds itself under, so light added on top of it stays coloured. */
  readonly headroom: number
}

export const SKY_EFFECTS = [
  {
    key: 'grainient',
    label: 'Grainient',
    blurb: 'A warped, grain-lit gradient — one feeling, marbled across the whole sky.',
    build: grainientSkyNode,
    opacity: VALUES.rendering.emotionSkyOpacity.grainient,
    headroom: VALUES.rendering.emotionSkyHeadroom.grainient,
  },
  {
    key: 'grainstorm',
    label: 'Grainstorm',
    blurb: 'The same marble, printed — grain you can feel, and colour pushed until it survives it.',
    build: grainstormSkyNode,
    opacity: VALUES.rendering.emotionSkyOpacity.grainstorm,
    headroom: VALUES.rendering.emotionSkyHeadroom.grainstorm,
  },
  {
    key: 'iridescence',
    label: 'Iridescence',
    blurb: 'An oil-slick shimmer rolling through every emotion in turn.',
    build: iridescenceSkyNode,
    opacity: VALUES.rendering.emotionSkyOpacity.iridescence,
    headroom: VALUES.rendering.emotionSkyHeadroom.iridescence,
  },
  {
    key: 'soft-aurora',
    label: 'Soft Aurora',
    blurb: 'Two hanging curtains of light, each its own feeling.',
    build: softAuroraSkyNode,
    opacity: VALUES.rendering.emotionSkyOpacity.soft_aurora,
    headroom: VALUES.rendering.emotionSkyHeadroom.soft_aurora,
  },
  {
    key: 'liquid-ether',
    label: 'Liquid Ether',
    blurb: 'Emotions smeared like dye in slow water, marbling together.',
    build: liquidEtherSkyNode,
    opacity: VALUES.rendering.emotionSkyOpacity.liquid_ether,
    headroom: VALUES.rendering.emotionSkyHeadroom.liquid_ether,
  },
  {
    key: 'prismatic-burst',
    label: 'Prismatic Burst',
    blurb: 'Rays streaming outward, sweeping the palette along their length.',
    build: prismaticBurstSkyNode,
    opacity: VALUES.rendering.emotionSkyOpacity.prismatic_burst,
    headroom: VALUES.rendering.emotionSkyHeadroom.prismatic_burst,
  },
  {
    key: 'plasma-wave',
    label: 'Plasma Wave',
    blurb: 'Neon tubes weaving and crossing around the sky — each ring rides the whole palette.',
    build: plasmaWaveSkyNode,
    opacity: VALUES.rendering.emotionSkyOpacity.plasma_wave,
    headroom: VALUES.rendering.emotionSkyHeadroom.plasma_wave,
  },
  {
    key: 'ferrofluid',
    label: 'Ferrofluid',
    blurb: 'Magnetic ridges rising and merging, lit at the crests in bands of feeling.',
    build: ferrofluidSkyNode,
    opacity: VALUES.rendering.emotionSkyOpacity.ferrofluid,
    headroom: VALUES.rendering.emotionSkyHeadroom.ferrofluid,
  },
  {
    key: 'floating-lines',
    label: 'Floating Lines',
    blurb:
      'Glowing filaments threading the sky — a bundle per emotion, thicker the more it weighs.',
    build: floatingLinesSkyNode,
    opacity: VALUES.rendering.emotionSkyOpacity.floating_lines,
    headroom: VALUES.rendering.emotionSkyHeadroom.floating_lines,
  },
  {
    key: 'evil-eye',
    label: 'Evil Eye',
    blurb: 'Ocular flames — one eye per emotion, each in its own place, sized by its own weight.',
    build: evilEyeSkyNode,
    opacity: VALUES.rendering.emotionSkyOpacity.evil_eye,
    headroom: VALUES.rendering.emotionSkyHeadroom.evil_eye,
  },
  {
    key: 'lightfall',
    label: 'Lightfall',
    blurb: 'Rays of light falling, each carrying its own feeling downward.',
    build: lightfallSkyNode,
    opacity: VALUES.rendering.emotionSkyOpacity.lightfall,
    headroom: VALUES.rendering.emotionSkyHeadroom.lightfall,
  },
  {
    key: 'pixel-blast',
    label: 'Pixel Blast',
    blurb: 'Pixel dots pulsing in blast rings that roll through the palette.',
    build: pixelBlastSkyNode,
    opacity: VALUES.rendering.emotionSkyOpacity.pixel_blast,
    headroom: VALUES.rendering.emotionSkyHeadroom.pixel_blast,
  },
] as const satisfies readonly SkyEffect[]

export type SkyEffectKey = (typeof SKY_EFFECTS)[number]['key']

export const DEFAULT_SKY_EFFECT: SkyEffectKey = 'grainient'

/** Resolve an effect key to its definition. An unknown or retired key falls back to the DEFAULT by
 *  name, not to whatever sits first in the catalogue, so reordering the rows cannot change what a
 *  stale key renders as. Keeps the narrow key literal so callers get a `SkyEffectKey`, not a widened
 *  `string`. */
export function resolveSkyEffect(key: string): (typeof SKY_EFFECTS)[number] {
  return (
    SKY_EFFECTS.find((effect) => effect.key === key) ??
    SKY_EFFECTS.find((effect) => effect.key === DEFAULT_SKY_EFFECT) ??
    SKY_EFFECTS[0]
  )
}
