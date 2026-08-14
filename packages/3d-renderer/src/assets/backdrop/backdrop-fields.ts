import type { BackdropLifeKey } from './backdrop-life.ts'
import type { BackdropScatterKey } from './backdrop-scatter.ts'

// FIELD — the other catalogue a backdrop is chosen from (the first is the MOTE).
//
// A field is the SPACE the motes are scattered through: where they sit, how many there are, and how
// their light moves. It says nothing about what a mote looks like — that whole question, form and size
// and colour, belongs to the mote catalogue — so any mote can be poured into any field and the pair is
// a backdrop.
//
// Emptiness and crowding are rows here rather than settings, because they are what a field IS: "packed
// to the horizon", "barely there" and "nothing at all" are three looks, and a picker that hid them
// behind a slider would be hiding the three most different answers it has.
//
// Twinkle is a field property for the same reason. The life axis offers six ways for brightness to
// move; a field picks one and then bends it with two numbers — how fast, and how far — so a sky that
// twinkles frantically and the same sky barely breathing are separate rows without a seventh mode.

export interface BackdropField {
  /** Stable id (kebab-case). */
  readonly key: string
  /** Display name. */
  readonly label: string
  /** One line on what the space becomes. */
  readonly blurb: string
  /** Where the motes sit. */
  readonly scatter: BackdropScatterKey
  /** Multiplies the platform's instance count. `0` empties the field entirely. */
  readonly density: number
  /** How a mote's brightness moves. */
  readonly life: BackdropLifeKey
  /** Scales the life mode's own clock — how FAST it twinkles. */
  readonly twinkleRate: number
  /** How FAR it twinkles: `1` is the mode's full swing, `0` holds every mote at a steady brightness. */
  readonly twinkleDepth: number
  /** Slow drift of the whole field, radians/sec. `0` holds it still. */
  readonly spin: number
}

export const BACKDROP_FIELDS = [
  {
    key: 'even',
    label: 'Even',
    blurb: 'Evenly through the whole shell, each mote twinkling on its own clock — the plain sky.',
    scatter: 'volume',
    density: 1,
    life: 'shimmer',
    twinkleRate: 1,
    twinkleDepth: 1,
    spin: 0.01,
  },
  {
    key: 'sparse',
    label: 'Sparse',
    blurb:
      'The same spread with most of the motes taken away, so each one has room to be looked at.',
    scatter: 'volume',
    density: 0.45,
    life: 'shimmer',
    twinkleRate: 1,
    twinkleDepth: 1,
    spin: 0.008,
  },
  {
    key: 'packed',
    label: 'Packed',
    blurb: 'Crowded close in every direction — the field crowds the scene instead of framing it.',
    scatter: 'swarm',
    density: 2.4,
    life: 'shimmer',
    twinkleRate: 1,
    twinkleDepth: 1,
    spin: 0.02,
  },
  {
    key: 'empty',
    label: 'Empty',
    blurb: 'No field at all — the emotion sky alone, with nothing between it and the universe.',
    scatter: 'volume',
    density: 0,
    life: 'still',
    twinkleRate: 1,
    twinkleDepth: 0,
    spin: 0,
  },
  {
    key: 'milky-way',
    label: 'Milky Way',
    blurb: 'One dense band of light across a sparse sky, with strays either side of it.',
    scatter: 'band',
    // The band squeezes the same count toward one plane, so this is the densest row in the catalogue
    // as the eye reads it — and it sits at the plain dot's ceiling, which is what caps it.
    density: 2.4,
    life: 'shimmer',
    twinkleRate: 1,
    twinkleDepth: 1,
    spin: 0.008,
  },
  {
    key: 'spiral',
    label: 'Spiral',
    blurb: 'Arms trailing out of a core into the rim, the whole field breathing slowly.',
    scatter: 'spiral',
    density: 2,
    life: 'calm',
    twinkleRate: 1,
    twinkleDepth: 1,
    spin: 0.014,
  },
  {
    key: 'clusters',
    label: 'Clusters',
    blurb: 'A handful of crowded places and a lot of nothing — groups the eye can rest on.',
    scatter: 'clumps',
    density: 1.3,
    life: 'shimmer',
    twinkleRate: 1,
    twinkleDepth: 1,
    spin: 0.008,
  },
  {
    key: 'belt',
    label: 'Belt',
    blurb:
      'One ring circling the scene — the field with an orientation the camera can tilt out of.',
    scatter: 'belt',
    density: 1.2,
    life: 'shimmer',
    twinkleRate: 1,
    twinkleDepth: 1,
    spin: 0.016,
  },
  {
    key: 'dome',
    label: 'Dome',
    blurb: 'Everything on one far shell: no depth at all, and the middle distance left empty.',
    scatter: 'shell',
    density: 0.7,
    life: 'calm',
    twinkleRate: 1,
    twinkleDepth: 1,
    spin: 0.005,
  },
  {
    key: 'haze',
    label: 'Haze',
    blurb:
      'Dense and completely still — a fixed backdrop, so the universe is the only thing moving.',
    scatter: 'volume',
    density: 1.6,
    life: 'still',
    twinkleRate: 1,
    twinkleDepth: 0,
    spin: 0.004,
  },
  {
    key: 'frantic',
    label: 'Frantic',
    blurb: 'Hard sparks flaring in and out at speed — the loudest sky in the set.',
    scatter: 'volume',
    density: 1.2,
    life: 'blitz',
    twinkleRate: 1.6,
    twinkleDepth: 1,
    spin: 0.01,
  },
  {
    key: 'faint-pulse',
    label: 'Faint Pulse',
    blurb: 'Barely twinkling: the same sparks, most of the swing taken out of them.',
    scatter: 'volume',
    density: 1.2,
    life: 'blitz',
    twinkleRate: 0.7,
    twinkleDepth: 0.25,
    spin: 0.006,
  },
  {
    key: 'slow-breath',
    label: 'Slow Breath',
    blurb:
      'Few motes in a long shallow rise and fall, slow enough that none of them catches the eye.',
    scatter: 'volume',
    density: 0.5,
    life: 'calm',
    twinkleRate: 0.6,
    twinkleDepth: 0.7,
    spin: 0.004,
  },
  {
    key: 'wave-front',
    label: 'Wave Front',
    blurb: 'One front sweeping the whole sky, neighbours lighting together.',
    scatter: 'volume',
    // A wave is legible through NEIGHBOURS lighting together rather than through crowding, so this row
    // stays spare — which is also what lets the costliest motes be poured into it.
    density: 0.6,
    life: 'wave',
    twinkleRate: 1,
    twinkleDepth: 1,
    spin: 0.006,
  },
  {
    key: 'switchboard',
    label: 'Switchboard',
    blurb: 'Brightness in steps instead of eased — the field reads as switched rather than lit.',
    scatter: 'volume',
    density: 0.9,
    life: 'strobe',
    twinkleRate: 1.2,
    twinkleDepth: 1,
    spin: 0.006,
  },
] as const satisfies readonly BackdropField[]

export type BackdropFieldKey = (typeof BACKDROP_FIELDS)[number]['key']

/** The field an undecorated universe wears. */
export const DEFAULT_BACKDROP_FIELD: BackdropFieldKey = 'even'

/** Resolve a field key. An unknown or retired key falls back to the DEFAULT by name, not to whatever
 *  sits first in the catalogue, so reordering the rows cannot change what a stale key renders as. */
export function resolveBackdropField(key: string): (typeof BACKDROP_FIELDS)[number] {
  return (
    BACKDROP_FIELDS.find((field) => field.key === key) ??
    BACKDROP_FIELDS.find((field) => field.key === DEFAULT_BACKDROP_FIELD) ??
    BACKDROP_FIELDS[0]
  )
}

/** How many motes a field places into a shell of `count` — its density, rounded, never negative. */
export function backdropMoteCount(field: BackdropField, count: number): number {
  return Math.max(0, Math.round(count * field.density))
}
