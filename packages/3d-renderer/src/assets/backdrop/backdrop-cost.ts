import type { BackdropField } from './backdrop-fields.ts'
import type { BackdropMote } from './backdrop-motes.ts'

import { backdropMoteCount } from './backdrop-fields.ts'
import { backdropMoteTriangles } from './backdrop-motes.ts'

// COST — the one fact that belongs to a PAIR rather than to either catalogue.
//
// A backdrop is a mote poured into a field, and neither half can promise what the pair will spend: the
// field decides how many motes there are, the mote decides how many triangles one of them is, and only
// their product is a number. Size is not in it — a mote is scaled per instance, so drawing it larger
// costs nothing extra.

/**
 * The fixed triangle cost a backdrop should stay under, at the web instance count.
 *
 * The backdrop is the scene's largest FIXED vertex cost: paid on every surface that mounts a universe,
 * every frame, whether or not a single memory exists, and invisible to any budget that starts from what
 * a memory renders. The shipped pair is checked against this; the review bench combines the catalogues
 * freely and reports the number instead, because the costliest form in the densest field is a real
 * question and seeing what it would cost is how the answer arrives.
 */
export const BACKDROP_TRIANGLE_CEILING = 128_000

/** The fixed triangle cost of a pair — how many motes the field places, times one mote of that form. */
export function backdropTriangleCost(
  mote: BackdropMote,
  field: BackdropField,
  count: number,
): number {
  return backdropMoteCount(field, count) * backdropMoteTriangles(mote)
}
