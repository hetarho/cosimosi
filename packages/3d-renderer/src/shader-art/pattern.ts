// Pattern shapers — carve noise/distance into [0,1] structure/masks. They add no color:
// color is the consumer's job (the toolkit makes "form", the consumer paints emotion onto
// it). All pure node in/out.
import { float, abs, pow, floor, fract, clamp } from 'three/tsl'
import { asFloatNode } from '../tsl'

/** Cell boundary lines ([0,1]) from Worley f1·f2 — crystal/cell membranes. Higher sharpness = thinner lines. */
export function cellEdge(f1: unknown, f2: unknown, sharpness = 8) {
  const edge = asFloatNode(f2).sub(asFloatNode(f1)) // 0 at the boundary, grows toward cell interior
  return pow(clamp(float(1).sub(edge.mul(sharpness)), float(0), float(1)), float(2))
}

/** Quantize a [0,1] value into `steps` bands — stepped tone / contour layers (topo map). */
export function contourSteps(value: unknown, steps = 7) {
  return floor(asFloatNode(value).mul(steps)).div(steps)
}

/** Isolines ([0,1]) — thin lines that brighten only as the value crosses level boundaries. Higher sharpness = thinner. */
export function isoLine(value: unknown, levels = 7, sharpness = 6) {
  const f = fract(asFloatNode(value).mul(levels)) // 0..1 sawtooth per level
  const d = abs(f.sub(0.5)).mul(2) // 1 at level boundaries, 0 mid-level
  return pow(clamp(d, float(0), float(1)), float(sharpness))
}
