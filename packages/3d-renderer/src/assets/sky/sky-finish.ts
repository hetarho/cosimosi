import { abs, clamp, float, fract, max, min, mix, smoothstep, vec3 } from 'three/tsl'

import { asFloatNode, asVec3Node } from '../../tsl.ts'
import { filmGrain } from './sky-node.ts'

// FINISH — the last of the four axes a sky recipe composes (domain · field · emotion · finish): what
// turns a scalar field into light.
//
// One rule runs through all of it. A feeling's strength is spent on the SIZE of a mark — a band's
// width, a ring's thickness, a mote's radius — and never on its opacity. A faint feeling drawn at low
// alpha does not read as faint; it reads as absent, and then as flickering when it crosses the
// threshold of visibility. Drawn thin at full colour, it reads as exactly what it is: a small amount
// of something you can still name.
//
// The exposure helpers exist because the sky is not composited alone. Stars, the nebula field and the
// bloom pass ADD their light on top of whatever the sky already is, and addition over an already-bright
// surface passes 1 in every channel at once — which is white. So a sky states the headroom it leaves
// for that light, and keeps itself under it.

/** A band of a given WIDTH around the iso-levels of a field: 1 on a line, 0 between them. Width is in
 *  the same units as the field, so a recipe spends a feeling's weight on how thick its line is. */
export function skyBandLine(value: unknown, levels = 7, width = 0.08) {
  const scaled = asFloatNode(value).mul(levels)
  const distance = abs(fract(scaled).sub(0.5)).mul(2)
  const half = Math.max(width, 1e-3)
  return smoothstep(float(1), float(1 - half), distance)
}

/** A ring at `radius` with a given WIDTH, measured in the same units as `distance` (an angle, for a
 *  ring drawn around an anchor). Falls to nothing at both edges, so a thin ring is thin rather than
 *  faint. */
export function skyRing(distance: unknown, radius: unknown, width = 0.1) {
  const offset = abs(asFloatNode(distance).sub(asFloatNode(radius)))
  const half = float(Math.max(width, 1e-3)).mul(0.5)
  return smoothstep(half, half.mul(0.15), offset)
}

/** Snap a field to `steps` levels — the finish behind pixel/cell looks. Quantizing the FIELD keeps the
 *  colour continuous, so a step boundary is a change of shade rather than a change of hue. */
export function skyQuantize(value: unknown, steps = 8) {
  const n = Math.max(1, Math.round(steps))
  const v = asFloatNode(value).clamp(0, 1).mul(n)
  return v.sub(fract(v)).div(n)
}

/**
 * Map a feeling's share to a mark's SIZE, between a floor that stays visible and a ceiling that stays
 * inside its territory. The floor is why the faintest feeling still draws something; the ceiling is why
 * the strongest does not swallow the sky.
 */
export function markSize(share: number, { min: low = 0.25, max: high = 1 } = {}): number {
  const clamped = Math.max(0, Math.min(1, share))
  return low + (high - low) * clamped
}

/**
 * Hold a colour under the ceiling a sky is allowed to reach, leaving the rest of the range for the
 * light that is added on top of it — stars, the nebula field, and the bloom pass.
 *
 * It is a soft roll-off, not a clamp: the brightest regions compress toward the ceiling instead of
 * flattening onto it, so a wide bright recipe keeps its internal structure rather than turning into
 * one even sheet at the top of its range.
 */
export function skyHeadroom(color: unknown, ceiling: number) {
  const cap = Math.max(0.05, Math.min(1, ceiling))
  const c = asVec3Node(color).max(vec3(0, 0, 0))
  // Reinhard-style roll-off scaled to the ceiling: linear while dim, asymptotic to `cap` while bright.
  return c.div(c.div(cap).add(1))
}

/** The finish shared across the recipes: gentle contrast, a whisper of grain so flats never band, and
 *  the sky's headroom. Everything a recipe returns should pass through this. */
export function skyFinish(color: unknown, { contrast = 1.1, grain = 0.04, headroom = 1 } = {}) {
  const c = asVec3Node(color)
  const contrasted = c.sub(0.5).mul(contrast).add(0.5).add(filmGrain(grain))
  const held = headroom < 1 ? skyHeadroom(contrasted, headroom) : contrasted
  return clamp(held, float(0), float(1))
}

/** Blend two colours by a 0..1 mask — the recipe-level way to lay one structure over another without
 *  adding luminance the headroom then has to claw back. */
export function skyOver(under: unknown, over: unknown, mask: unknown) {
  return mix(asVec3Node(under), asVec3Node(over), asFloatNode(mask).clamp(0, 1))
}

/** Keep the bare night visible wherever a recipe's structure is absent: a sky is a place with things
 *  in it, not a filled surface. `coverage` is how much of the frame the structure may claim. */
export function skyVoid(color: unknown, structure: unknown, coverage = 1) {
  const amount = min(max(asFloatNode(structure), float(0)), float(1)).mul(coverage)
  return asVec3Node(color).mul(amount)
}
