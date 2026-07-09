// Color & finish — the last stage that paints light/tint onto structure. Pure node in/out.
import { vec3, float, pow, clamp, dot, abs, sin, mx_hsvtorgb } from 'three/tsl'
import { asFloatNode, asVec3Node } from '../tsl'

/** Fresnel — approaches 1 where view and normal graze (edges). Atmospheric rim / core glow. Higher power = thinner rim. */
export function fresnel(viewDir: unknown, normal: unknown, power = 3) {
  const f = float(1).sub(abs(dot(asVec3Node(viewDir), asVec3Node(normal))))
  return pow(clamp(f, float(0), float(1)), float(power))
}

export interface IridescentOptions {
  /** Center hue (0..1 HSV) — the reference hue to tune against the mood color. */
  baseHue?: number
  /** How far the hue slides — larger sweeps a wider rainbow. */
  range?: number
  /** Saturation. */
  sat?: number
  /** Value. */
  val?: number
}

/** Thin-film (oil-slick) tint — hue slides with phase (view angle/time, etc.). A pearly sheen oscillating around baseHue. */
export function iridescent(
  phase: unknown,
  { baseHue = 0.6, range = 0.25, sat = 0.6, val = 1 }: IridescentOptions = {},
) {
  const hue = float(baseHue).add(sin(asFloatNode(phase)).mul(range))
  return asVec3Node(mx_hsvtorgb(vec3(hue, float(sat), float(val))))
}
