import type { BackdropLifeKey, BackdropToneKey } from './backdrop-life.ts'
import type { BackdropMoteKey } from './backdrop-motes.ts'
import type { BackdropScatterKey } from './backdrop-scatter.ts'

import { backdropMoteTriangles } from './backdrop-motes.ts'

// The catalogue of backdrops a universe's decorative field can wear. Each is a RECIPE — an
// arrangement of the four axes (scatter · mote · life · tone) plus the three scalars that decide how
// much of it there is — and the catalogue grows by arranging them differently, not by writing another
// field. A primitive added to an axis multiplies across every row here; a trick inlined into one row
// helps exactly one row, which is why the axes are where the work goes.
//
// A theme is the character of the WHOLE backdrop, never of one particle. That is why density and
// absence are rows rather than settings: "packed", "barely there" and "nothing at all" are as much
// looks as any mote form, and a row that reads as one field cannot be assembled from per-particle
// choices.
//
// None of this touches the universe's own bodies. The backdrop carries no domain data — no memory,
// no emotion, no strength — so a theme can be picked, changed or emptied without any meaning moving
// with it. The emotion sky is a separate axis behind this one, and the two are chosen independently.

export interface BackdropTheme {
  /** Stable id (kebab-case). */
  readonly key: string
  /** Display name. */
  readonly label: string
  /** One line on what the field becomes. */
  readonly blurb: string
  /** Where the motes sit. */
  readonly scatter: BackdropScatterKey
  /** What one mote is drawn as. */
  readonly mote: BackdropMoteKey
  /** How its brightness moves. */
  readonly life: BackdropLifeKey
  /** What colour that brightness is spent on. */
  readonly tone: BackdropToneKey
  /** Multiplies the platform's instance count. `0` empties the field entirely. */
  readonly density: number
  /** Multiplies every mote's world size. */
  readonly size: number
  /** Slow drift of the whole field, radians/sec. `0` holds it still. */
  readonly spin: number
}

export const BACKDROP_THEMES = [
  {
    key: 'starlight',
    label: 'Starlight',
    blurb: 'Distant stars, evenly through the shell, each twinkling on its own clock.',
    scatter: 'volume',
    mote: 'grain',
    life: 'shimmer',
    tone: 'starlight',
    density: 1,
    size: 1,
    spin: 0.01,
  },
  {
    key: 'void',
    label: 'Void',
    blurb: 'No field at all — the emotion sky alone, with nothing between it and the universe.',
    scatter: 'volume',
    mote: 'grain',
    life: 'still',
    tone: 'starlight',
    density: 0,
    size: 1,
    spin: 0,
  },
  {
    key: 'dust-veil',
    label: 'Dust Veil',
    blurb: 'Grey dust, dense and completely still — present, and spending almost nothing.',
    scatter: 'volume',
    mote: 'grain',
    life: 'still',
    tone: 'ash',
    density: 1.6,
    size: 0.7,
    spin: 0.004,
  },
  {
    key: 'crackle',
    label: 'Crackle',
    blurb: 'Hard cold sparks flaring in and out — the loudest sky in the set.',
    scatter: 'volume',
    mote: 'grain',
    life: 'blitz',
    tone: 'ice',
    density: 1.2,
    size: 0.9,
    spin: 0.01,
  },
  {
    key: 'teeming',
    label: 'Teeming',
    blurb:
      'Packed close dust in every direction — the field crowds the scene instead of framing it.',
    scatter: 'swarm',
    mote: 'grain',
    life: 'shimmer',
    tone: 'starlight',
    density: 2.4,
    size: 0.6,
    spin: 0.02,
  },
  {
    key: 'milky-band',
    label: 'Milky Band',
    blurb: 'One bright band of stars across a sparse sky, with strays either side of it.',
    scatter: 'band',
    mote: 'grain',
    life: 'shimmer',
    tone: 'starlight',
    density: 1.8,
    size: 0.7,
    spin: 0.008,
  },
  {
    key: 'spiral-arms',
    label: 'Spiral Arms',
    blurb: 'Arms trailing out of a warm core into a cool rim, breathing slowly.',
    scatter: 'spiral',
    mote: 'grain',
    life: 'calm',
    tone: 'duotone',
    density: 2,
    size: 0.7,
    spin: 0.014,
  },
  {
    key: 'clusters',
    label: 'Clusters',
    blurb: 'A handful of crowded places and a lot of nothing, warm inside and cool out.',
    scatter: 'clumps',
    mote: 'grain',
    life: 'shimmer',
    tone: 'duotone',
    density: 1.3,
    size: 0.9,
    spin: 0.008,
  },
  {
    key: 'cosmic-web',
    label: 'Cosmic Web',
    blurb: 'Faint threads strung across the shell — structure in the placement, not the mote.',
    scatter: 'strands',
    mote: 'grain',
    life: 'calm',
    tone: 'ice',
    density: 1.4,
    size: 0.6,
    spin: 0.006,
  },
  {
    key: 'ring-belt',
    label: 'Ring Belt',
    blurb: 'A warm belt of chips circling the scene — the one field with an orientation to find.',
    scatter: 'belt',
    mote: 'shard',
    life: 'shimmer',
    tone: 'ember',
    density: 1.2,
    size: 0.8,
    spin: 0.016,
  },
  {
    key: 'lattice-dust',
    label: 'Lattice Dust',
    blurb: 'A jittered grid of grey cubes — a constructed space rather than a sky.',
    scatter: 'lattice',
    mote: 'pixel',
    life: 'still',
    tone: 'ash',
    density: 1,
    size: 0.8,
    spin: 0,
  },
  {
    key: 'pixel-sky',
    label: 'Pixel Sky',
    blurb: 'Square dots switching between four brightness steps, each in its own hue.',
    scatter: 'volume',
    mote: 'pixel',
    life: 'strobe',
    tone: 'spectrum',
    density: 0.9,
    size: 1,
    spin: 0.006,
  },
  {
    key: 'spark-fall',
    label: 'Spark Fall',
    blurb: 'Vertical slivers glinting hard — a sky caught mid-shower.',
    scatter: 'volume',
    mote: 'needle',
    life: 'blitz',
    tone: 'ice',
    density: 0.8,
    size: 1,
    spin: 0.01,
  },
  {
    key: 'anamorphic',
    label: 'Anamorphic',
    blurb: 'Light stretched sideways on one far dome, drifting slowly — a wide lens on the sky.',
    scatter: 'shell',
    mote: 'streak',
    life: 'calm',
    tone: 'starlight',
    density: 0.7,
    size: 1.1,
    spin: 0.005,
  },
  {
    key: 'diffraction',
    label: 'Diffraction',
    blurb: 'Few but large crossed sparkles, gathered in groups — stars through a real aperture.',
    scatter: 'clumps',
    mote: 'jack',
    life: 'blitz',
    tone: 'starlight',
    density: 0.45,
    size: 1.6,
    spin: 0.008,
  },
  {
    key: 'bokeh-drift',
    label: 'Bokeh Drift',
    blurb: 'Warm out-of-focus rings breathing in place — points a lens could not resolve.',
    scatter: 'volume',
    mote: 'bokeh',
    life: 'calm',
    tone: 'ember',
    density: 0.45,
    size: 1.2,
    spin: 0.006,
  },
  {
    key: 'snow-fleck',
    label: 'Snow Fleck',
    blurb: 'Flat cold flecks close in, flickering as they turn edge-on.',
    scatter: 'swarm',
    mote: 'plate',
    life: 'shimmer',
    tone: 'ice',
    density: 1.4,
    size: 0.9,
    spin: 0.018,
  },
  {
    key: 'ember-drift',
    label: 'Ember Drift',
    blurb: 'Warm dust gathered in slow-breathing pockets — air between you and the light.',
    scatter: 'clumps',
    mote: 'grain',
    life: 'calm',
    tone: 'ember',
    density: 1.1,
    size: 1,
    spin: 0.004,
  },
  {
    key: 'pulse-front',
    label: 'Pulse Front',
    blurb: 'One wave of light sweeping the whole field, neighbours lighting together.',
    scatter: 'volume',
    mote: 'grain',
    life: 'wave',
    tone: 'ice',
    density: 1.5,
    size: 0.8,
    spin: 0.006,
  },
  {
    key: 'shard-glint',
    label: 'Shard Glint',
    blurb: 'Angular chips catching the light one facet at a time, each its own colour.',
    scatter: 'volume',
    mote: 'shard',
    life: 'shimmer',
    tone: 'spectrum',
    density: 1,
    size: 1,
    spin: 0.012,
  },
] as const satisfies readonly BackdropTheme[]

export type BackdropThemeKey = (typeof BACKDROP_THEMES)[number]['key']

/** The field an undecorated universe wears. */
export const DEFAULT_BACKDROP_THEME: BackdropThemeKey = 'starlight'

/**
 * The fixed triangle cost a themed field may reach, at the web instance count.
 *
 * The backdrop is the scene's largest FIXED vertex cost: it is paid on every surface that mounts a
 * universe, every frame, whether or not a single memory exists, and it is invisible to any budget
 * that starts from what a memory renders. A row is allowed to spend more than the plainest field —
 * density and mote form are what these looks ARE — but not without limit, so the ceiling sits at
 * roughly two and a half times the plain field and every row is checked against it.
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

/** How many motes a theme places into a field of `count` — its density, rounded, never negative. */
export function backdropMoteCount(theme: BackdropTheme, count: number): number {
  return Math.max(0, Math.round(count * theme.density))
}

/** The fixed triangle cost of a themed field — instance count times the mote's own topology. */
export function backdropTriangleCost(theme: BackdropTheme, count: number): number {
  return backdropMoteCount(theme, count) * backdropMoteTriangles(theme.mote)
}
