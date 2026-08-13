import * as THREE from 'three/webgpu'

import { VALUES } from '@cosimosi/config'

// MOTE — the second of the four axes a backdrop theme composes (scatter · mote · life · tone).
//
// A mote is the geometry ONE decorative particle is drawn as, instanced across the whole field. Two
// facts shape every form here.
//
// The first is size: a mote covers a handful of pixels, so tessellation buys nothing but the
// silhouette. Every form is authored from the twenty flat faces of an icosahedron downward, and the
// rounder-looking ones cost the fewest triangles of any shape that reads as round at that size.
//
// The second is that these are meshes, not billboards. A form with a preferred direction — a needle,
// a streak, a plate — therefore shows its length only from the sides, and turns into a dot when the
// camera looks down its axis. That is a property of the look, not a defect to correct: the field is
// large and the camera slow, so a themed field reads as a sky of streaks with a few dots in it.

export type BackdropMoteKey =
  'grain' | 'pixel' | 'shard' | 'needle' | 'streak' | 'jack' | 'plate' | 'bokeh'

/** World radius of one mote before the per-instance distance scaling. */
export const MOTE_RADIUS = 0.18

/** How far a directional form reaches along its long axis, relative to a round one. Enough to read
 *  as a line rather than a smeared dot; past roughly this the field starts to read as rain. */
const ELONGATION = 2.6
/** The thin cross-section a directional form keeps, so its width never competes with its length. */
const FILAMENT_WIDTH = 0.32

export interface BackdropMote {
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

const MOTE_BUILDERS: Record<BackdropMoteKey, () => BackdropMote> = {
  // The round dot. Twenty faces already give a rounder outline than a UV sphere of five times the
  // triangles, because a UV sphere spends most of them crowding the poles — where a one-pixel dot
  // has none to spare.
  grain: () => ({
    geometry: new THREE.IcosahedronGeometry(MOTE_RADIUS, VALUES.rendering.starFieldMoteDetail),
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
export function createBackdropMote(key: BackdropMoteKey): BackdropMote {
  return (MOTE_BUILDERS[key] ?? MOTE_BUILDERS.grain)()
}

/** How many triangles one mote of this form draws — the number a field's cost is counted in. */
export function backdropMoteTriangles(key: BackdropMoteKey): number {
  const { geometry } = createBackdropMote(key)
  const index = geometry.getIndex()
  const triangles = (index ? index.count : geometry.getAttribute('position').count) / 3
  geometry.dispose()
  return triangles
}
