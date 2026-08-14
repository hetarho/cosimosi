import * as THREE from 'three/webgpu'

import { VALUES } from '@cosimosi/config'

import type { BackdropToneKey } from './backdrop-life.ts'

// MOTE — one of the two catalogues a backdrop is chosen from (the other is the FIELD).
//
// A mote is ONE decorative particle: its form, how big it is drawn, and what colour it is. Those three
// travel together because they are the same question — a large warm ring and a tiny grey pinprick are
// two looks, not one look with two settings — and separating them would leave a picker whose rows are
// not things anyone can recognise.
//
// Where the motes sit, how many of them there are and how they twinkle belong to the field: a mote
// knows nothing about the space it is scattered through, which is why either catalogue can grow
// without touching the other, and why every pair of rows is a backdrop.
//
// FORMS come first. A mote is the geometry a particle is drawn as, instanced across the whole field,
// and two facts shape every form here.
//
// The first is size: a mote covers a handful of pixels, so tessellation buys nothing but the
// silhouette. Every form is authored from the twenty flat faces of an icosahedron downward, and the
// rounder-looking ones cost the fewest triangles of any shape that reads as round at that size.
//
// The second is that these are meshes, not billboards. A form with a preferred direction — a needle,
// a streak, a plate — therefore shows its length only from the sides, and turns into a dot when the
// camera looks down its axis. That is a property of the look, not a defect to correct: the field is
// large and the camera slow, so a themed field reads as a sky of streaks with a few dots in it.

export type BackdropMoteFormKey =
  'grain' | 'orb' | 'pixel' | 'shard' | 'needle' | 'streak' | 'jack' | 'plate' | 'bokeh'

/** World radius of one mote before the per-instance distance scaling. */
export const MOTE_RADIUS = 0.18

/** How far a directional form reaches along its long axis, relative to a round one. Enough to read
 *  as a line rather than a smeared dot; past roughly this the field starts to read as rain. */
const ELONGATION = 2.6
/** The thin cross-section a directional form keeps, so its width never competes with its length. */
const FILAMENT_WIDTH = 0.32

export interface BackdropMoteForm {
  /** A fresh geometry — the caller owns disposal. */
  readonly geometry: THREE.BufferGeometry
  /** Forms with no interior need both faces drawn, or half the field vanishes at every angle. */
  readonly doubleSided: boolean
  /** Forms that are light rather than solid — a hollow ring, a crossed sparkle, a flat fleck — read
   *  as light only if the ones behind them show through, so blending travels with the form. */
  readonly additive: boolean
}

/** Three quads through the origin, one per axis — a sparkle whose arms cross rather than a solid.
 *  Built by hand because it is the intersection of three planes, which no primitive builds. */
function jackGeometry(): THREE.BufferGeometry {
  // Half-extents, so an arm reaches as far as the box forms' long axis rather than twice as far.
  const long = (MOTE_RADIUS * ELONGATION) / 2
  const short = (MOTE_RADIUS * FILAMENT_WIDTH) / 2
  const positions: number[] = []
  const push = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    positions.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z)
  }
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  push(v(-long, -short, 0), v(long, -short, 0), v(long, short, 0), v(-long, short, 0))
  push(v(0, -long, -short), v(0, long, -short), v(0, long, short), v(0, -long, short))
  push(v(-short, 0, -long), v(short, 0, -long), v(short, 0, long), v(-short, 0, long))
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

const FORM_BUILDERS: Record<BackdropMoteFormKey, () => BackdropMoteForm> = {
  // The round dot. Twenty faces already give a rounder outline than a UV sphere of five times the
  // triangles, because a UV sphere spends most of them crowding the poles — where a one-pixel dot
  // has none to spare.
  grain: () => ({
    geometry: new THREE.IcosahedronGeometry(MOTE_RADIUS, VALUES.rendering.starFieldMoteDetail),
    doubleSided: false,
    additive: false,
  }),

  // A ball rather than a dot: one subdivision past the grain, which is what it takes for a silhouette
  // to read as ROUND once a mote is drawn large enough to have a silhouette at all. Four times the
  // grain's triangles, so it belongs to the fields that place few motes.
  orb: () => ({
    geometry: new THREE.IcosahedronGeometry(MOTE_RADIUS, VALUES.rendering.starFieldMoteDetail + 1),
    doubleSided: false,
    additive: false,
  }),

  // A cube: hard corners, and at this size a square dot. The field reads as printed rather than lit.
  pixel: () => ({
    geometry: new THREE.BoxGeometry(MOTE_RADIUS * 1.2, MOTE_RADIUS * 1.2, MOTE_RADIUS * 1.2),
    doubleSided: false,
    additive: false,
  }),

  // Four faces, no two parallel — the cheapest form with a visibly angular silhouette. Each mote
  // catches the light on one facet at a time, so the field glints as the camera moves.
  shard: () => ({
    geometry: new THREE.TetrahedronGeometry(MOTE_RADIUS),
    doubleSided: false,
    additive: false,
  }),

  // A vertical spike: long on y, thin on the other two. A sky of falling slivers.
  needle: () => ({
    geometry: new THREE.BoxGeometry(
      MOTE_RADIUS * FILAMENT_WIDTH,
      MOTE_RADIUS * ELONGATION,
      MOTE_RADIUS * FILAMENT_WIDTH,
    ),
    doubleSided: false,
    additive: false,
  }),

  // The same sliver laid flat — long on x, so every mote is a horizontal dash. The anamorphic
  // reading of a star: light stretched along one axis the way a wide lens stretches it.
  streak: () => ({
    geometry: new THREE.BoxGeometry(
      MOTE_RADIUS * ELONGATION,
      MOTE_RADIUS * FILAMENT_WIDTH,
      MOTE_RADIUS * FILAMENT_WIDTH,
    ),
    doubleSided: false,
    additive: false,
  }),

  // Three crossed quads: a diffraction spike, the shape a bright star takes through a real aperture.
  // Six triangles for a form that has arms.
  jack: () => ({ geometry: jackGeometry(), doubleSided: true, additive: true }),

  // A single flat fleck. Two triangles — the cheapest mote there is — and the field flickers as the
  // flecks turn edge-on, which is most of what makes it look alive.
  plate: () => ({
    geometry: new THREE.PlaneGeometry(MOTE_RADIUS * 1.8, MOTE_RADIUS * 1.8),
    doubleSided: true,
    additive: true,
  }),

  // A ring with a hole: an out-of-focus point light, the way a lens renders one it cannot resolve.
  // The tube is a triangle in cross-section (three radial segments) because at a few pixels across
  // only the hole is legible, and the hole costs nothing.
  bokeh: () => ({
    geometry: new THREE.TorusGeometry(MOTE_RADIUS * 0.72, MOTE_RADIUS * 0.3, 3, 9),
    doubleSided: true,
    additive: true,
  }),
}

/** Build one mote form. A fresh geometry per call — an instanced layer disposes what it was handed. */
export function createBackdropMoteForm(key: BackdropMoteFormKey): BackdropMoteForm {
  return (FORM_BUILDERS[key] ?? FORM_BUILDERS.grain)()
}

/** How many triangles one mote of this form draws — the number a field's cost is counted in. */
export function backdropMoteFormTriangles(key: BackdropMoteFormKey): number {
  const { geometry } = createBackdropMoteForm(key)
  const index = geometry.getIndex()
  const triangles = (index ? index.count : geometry.getAttribute('position').count) / 3
  geometry.dispose()
  return triangles
}

export interface BackdropMote {
  /** Stable id (kebab-case). */
  readonly key: string
  /** Display name. */
  readonly label: string
  /** One line on what one particle becomes. */
  readonly blurb: string
  /** The geometry it is drawn as. */
  readonly form: BackdropMoteFormKey
  /** Multiplies the world size every mote is drawn at. */
  readonly size: number
  /** The colour its brightness is spent on. */
  readonly tone: BackdropToneKey
}

/**
 * The motes a backdrop can be built from — the first of the two pickers.
 *
 * The catalogue spreads across all three of a mote's properties at once, because that is how the eye
 * reads them: a row is a large violet ring or a tiny grey speck, never "form 4 at size 1.8". Sizes stay
 * inside roughly a quarter to two and a half, which is the range where a mote still reads as a mote —
 * below it the field is invisible, above it the particles start competing with the universe's own stars.
 */
export const BACKDROP_MOTES = [
  {
    key: 'pinprick',
    label: 'Pinprick',
    blurb:
      'The plain distant star: a small cool-white dot, and the field every other row is read against.',
    form: 'grain',
    size: 1,
    tone: 'starlight',
  },
  {
    key: 'orb',
    label: 'Orb',
    blurb: 'A round white ball, big enough that the roundness itself is the look.',
    form: 'orb',
    size: 2,
    tone: 'starlight',
  },
  {
    key: 'ash-speck',
    label: 'Ash Speck',
    blurb: 'Tiny and grey — present, and spending almost nothing on being seen.',
    form: 'grain',
    size: 0.7,
    tone: 'ash',
  },
  {
    key: 'ice-spark',
    label: 'Ice Spark',
    blurb: 'A hard cold-white point, the crispest dot in the set.',
    form: 'grain',
    size: 0.9,
    tone: 'ice',
  },
  {
    key: 'ember-dust',
    label: 'Ember Dust',
    blurb: 'Warm amber dust — air between the viewer and the light rather than vacuum.',
    form: 'grain',
    size: 1,
    tone: 'ember',
  },
  {
    key: 'galaxy-dust',
    label: 'Galaxy Dust',
    blurb: 'Dust that warms toward the centre and cools at the rim, so distance reads as colour.',
    form: 'grain',
    size: 0.8,
    tone: 'duotone',
  },
  {
    key: 'rose-mote',
    label: 'Rose Mote',
    blurb: 'A soft pink dot: decorative on purpose, borrowing nothing from an astronomy photo.',
    form: 'grain',
    size: 1.2,
    tone: 'rose',
  },
  {
    key: 'pixel',
    label: 'Pixel',
    blurb: 'A square dot, each in its own hue — the field reads as printed rather than lit.',
    form: 'pixel',
    size: 1,
    tone: 'spectrum',
  },
  {
    key: 'ember-chip',
    label: 'Ember Chip',
    blurb: 'A small warm shard catching the light on one facet at a time.',
    form: 'shard',
    size: 0.8,
    tone: 'ember',
  },
  {
    key: 'prism-shard',
    label: 'Prism Shard',
    blurb: 'The same angular chip, each one its own colour — the field glints as the camera moves.',
    form: 'shard',
    size: 1.1,
    tone: 'spectrum',
  },
  {
    key: 'ice-needle',
    label: 'Ice Needle',
    blurb: 'A long cold sliver standing on end — a sky caught mid-shower.',
    form: 'needle',
    size: 2,
    tone: 'ice',
  },
  {
    key: 'wide-streak',
    label: 'Wide Streak',
    blurb: 'Light stretched sideways and drawn long, the way a wide lens stretches a star.',
    form: 'streak',
    size: 2.2,
    tone: 'starlight',
  },
  {
    key: 'diffraction',
    label: 'Diffraction',
    blurb: 'A large crossed sparkle — a star seen through a real aperture, arms and all.',
    form: 'jack',
    size: 1.6,
    tone: 'starlight',
  },
  {
    key: 'violet-sparkle',
    label: 'Violet Sparkle',
    blurb: 'The same crossed arms in cool violet, drawn larger still.',
    form: 'jack',
    size: 2.2,
    tone: 'violet',
  },
  {
    key: 'snow-fleck',
    label: 'Snow Fleck',
    blurb: 'A flat cold fleck that flickers as it turns edge-on.',
    form: 'plate',
    size: 0.9,
    tone: 'ice',
  },
  {
    key: 'ember-bokeh',
    label: 'Ember Bokeh',
    blurb: 'A warm out-of-focus ring — a point light a lens could not resolve.',
    form: 'bokeh',
    size: 1.2,
    tone: 'ember',
  },
  {
    key: 'violet-bokeh',
    label: 'Violet Bokeh',
    blurb: 'The same ring, wider and violet, hollow enough to see the field through it.',
    form: 'bokeh',
    size: 1.8,
    tone: 'violet',
  },
] as const satisfies readonly BackdropMote[]

export type BackdropMoteKey = (typeof BACKDROP_MOTES)[number]['key']

/** The mote an undecorated universe wears. */
export const DEFAULT_BACKDROP_MOTE: BackdropMoteKey = 'pinprick'

/** Resolve a mote key. An unknown or retired key falls back to the DEFAULT by name, not to whatever
 *  sits first in the catalogue, so reordering the rows cannot change what a stale key renders as. */
export function resolveBackdropMote(key: string): (typeof BACKDROP_MOTES)[number] {
  return (
    BACKDROP_MOTES.find((mote) => mote.key === key) ??
    BACKDROP_MOTES.find((mote) => mote.key === DEFAULT_BACKDROP_MOTE) ??
    BACKDROP_MOTES[0]
  )
}

/** How many triangles one mote of this row draws. */
export function backdropMoteTriangles(mote: BackdropMote): number {
  return backdropMoteFormTriangles(mote.form)
}
