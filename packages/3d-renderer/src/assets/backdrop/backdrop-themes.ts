import type { BackdropField, BackdropFieldKey } from './backdrop-fields.ts'
import type { BackdropMote, BackdropMoteKey } from './backdrop-motes.ts'

import { DEFAULT_BACKDROP_FIELD, backdropMoteCount } from './backdrop-fields.ts'
import { DEFAULT_BACKDROP_MOTE, backdropMoteTriangles } from './backdrop-motes.ts'

// A backdrop is a MOTE poured into a FIELD — one row from each catalogue, and nothing else. The two
// answer questions that do not constrain each other (what one particle is · what space they fill), so
// the set of possible backdrops is their product rather than a list someone has to keep writing.
//
// What lives here is the named pairs: the ones worth shipping, offering for sale, or opening on. A
// theme adds no parameter of its own — if a look needs something neither catalogue offers, the axis is
// where it goes, because a primitive added to an axis multiplies across every pair while a trick
// inlined into one row helps exactly one row.
//
// None of this touches the universe's own bodies. The backdrop carries no domain data — no memory, no
// emotion, no strength — so a pair can be picked, changed or emptied without any meaning moving with
// it. The emotion sky is a separate axis behind it, and the two are chosen independently.

export interface BackdropTheme {
  /** Stable id (kebab-case). */
  readonly key: string
  /** Display name. */
  readonly label: string
  /** One line on what the pair becomes together. */
  readonly blurb: string
  /** Which particle. */
  readonly mote: BackdropMoteKey
  /** Which space. */
  readonly field: BackdropFieldKey
}

export const BACKDROP_THEMES = [
  {
    key: 'starlight',
    label: 'Starlight',
    blurb: 'Distant stars, evenly through the shell, each twinkling on its own clock.',
    mote: 'pinprick',
    field: 'even',
  },
  {
    key: 'void',
    label: 'Void',
    blurb: 'No field at all — the emotion sky alone, with nothing between it and the universe.',
    mote: 'pinprick',
    field: 'empty',
  },
  {
    key: 'dust-veil',
    label: 'Dust Veil',
    blurb: 'Grey dust, dense and completely still — present, and spending almost nothing.',
    mote: 'ash-speck',
    field: 'haze',
  },
  {
    key: 'crackle',
    label: 'Crackle',
    blurb: 'Hard cold sparks flaring in and out — the loudest sky in the set.',
    mote: 'ice-spark',
    field: 'frantic',
  },
  {
    key: 'teeming',
    label: 'Teeming',
    blurb:
      'Packed close dust in every direction — the field crowds the scene instead of framing it.',
    mote: 'ash-speck',
    field: 'packed',
  },
  {
    key: 'milky-band',
    label: 'Milky Band',
    blurb: 'One dense band of stars across a sparse sky, with strays either side of it.',
    mote: 'pinprick',
    field: 'milky-way',
  },
  {
    key: 'spiral-arms',
    label: 'Spiral Arms',
    blurb: 'Arms trailing out of a warm core into a cool rim, breathing slowly.',
    mote: 'galaxy-dust',
    field: 'spiral',
  },
  {
    key: 'ember-chips',
    label: 'Ember Chips',
    blurb: 'Warm angular chips spread evenly, each catching the light on one facet at a time.',
    mote: 'ember-chip',
    field: 'even',
  },
  {
    key: 'pixel-sky',
    label: 'Pixel Sky',
    blurb: 'Square dots switching between brightness steps, each in its own hue.',
    mote: 'pixel',
    field: 'switchboard',
  },
  {
    key: 'spark-fall',
    label: 'Spark Fall',
    blurb: 'Long vertical slivers glinting hard — a sky caught mid-shower.',
    mote: 'ice-needle',
    field: 'frantic',
  },
  {
    key: 'anamorphic',
    label: 'Anamorphic',
    blurb: 'Light stretched sideways on one far dome, drifting slowly — a wide lens on the sky.',
    mote: 'wide-streak',
    field: 'dome',
  },
  {
    key: 'diffraction',
    label: 'Diffraction',
    blurb: 'Few but large crossed sparkles, evenly spread — stars through a real aperture.',
    mote: 'diffraction',
    field: 'sparse',
  },
  {
    key: 'diffraction-clusters',
    label: 'Diffraction Clusters',
    blurb: 'The same crossed sparkles gathered into groups, with a lot of nothing between them.',
    mote: 'diffraction',
    field: 'clusters',
  },
  {
    key: 'diffraction-band',
    label: 'Diffraction Band',
    blurb: 'The crossed sparkles drawn into one band, so the arms line up across the sky.',
    mote: 'diffraction',
    field: 'milky-way',
  },
  {
    key: 'bokeh-drift',
    label: 'Bokeh Drift',
    blurb: 'Warm out-of-focus rings breathing in place — points a lens could not resolve.',
    mote: 'ember-bokeh',
    field: 'slow-breath',
  },
  {
    key: 'snow-fleck',
    label: 'Snow Fleck',
    blurb: 'Flat cold flecks close in, flickering as they turn edge-on.',
    mote: 'snow-fleck',
    field: 'packed',
  },
  {
    key: 'pulse-front',
    label: 'Pulse Front',
    blurb: 'One wave of light sweeping a sky of round white balls, neighbours lighting together.',
    mote: 'orb',
    field: 'wave-front',
  },
  {
    key: 'shard-glint',
    label: 'Shard Glint',
    blurb: 'Angular chips catching the light one facet at a time, each its own colour.',
    mote: 'prism-shard',
    field: 'even',
  },
] as const satisfies readonly BackdropTheme[]

export type BackdropThemeKey = (typeof BACKDROP_THEMES)[number]['key']

/** The backdrop an undecorated universe wears. */
export const DEFAULT_BACKDROP_THEME: BackdropThemeKey = 'starlight'

/**
 * The fixed triangle cost a shipped pair may reach, at the web instance count.
 *
 * The backdrop is the scene's largest FIXED vertex cost: it is paid on every surface that mounts a
 * universe, every frame, whether or not a single memory exists, and it is invisible to any budget that
 * starts from what a memory renders. A pair is allowed to spend more than the plainest field — density
 * and mote form are what these looks ARE — but not without limit.
 *
 * The ceiling binds the NAMED pairs, which are the only ones a product surface can wear. The review
 * bench combines the two catalogues freely and reports what a combination would cost, because a mote
 * of four times the triangles poured into the densest field is a real answer to "why not both" and
 * seeing it is the point.
 */
export const BACKDROP_TRIANGLE_CEILING = 128_000

/** Resolve a theme key. An unknown or retired key falls back to the DEFAULT by name, not to whatever
 *  sits first in the catalogue, so reordering the rows cannot change what a stale key renders as. */
export function resolveBackdropTheme(key: string): (typeof BACKDROP_THEMES)[number] {
  return (
    BACKDROP_THEMES.find((theme) => theme.key === key) ??
    BACKDROP_THEMES.find((theme) => theme.key === DEFAULT_BACKDROP_THEME) ??
    BACKDROP_THEMES[0]
  )
}

/** The pair the DEFAULT theme names — what a surface renders when nothing has been chosen. */
export const DEFAULT_BACKDROP_PAIR = {
  mote: DEFAULT_BACKDROP_MOTE,
  field: DEFAULT_BACKDROP_FIELD,
} as const

/** The fixed triangle cost of a pair — how many motes the field places, times the mote's topology. */
export function backdropTriangleCost(
  mote: BackdropMote,
  field: BackdropField,
  count: number,
): number {
  return backdropMoteCount(field, count) * backdropMoteTriangles(mote)
}
