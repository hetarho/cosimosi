// Gradient background: a plain two-stop vertical sky (no noise) — the minimal second
// background type. Its props shape differs from nebula's, so the registry proves that each
// type carries its own props. One TSL source → WGSL (web + native) + GLSL (fallback).
import { color, mix, screenUV } from 'three/tsl'

export interface GradientProps {
  /** Top-of-screen hue (hex). */
  readonly top: number
  /** Bottom-of-screen hue (hex). */
  readonly bottom: number
}

export function gradientBackgroundNode(props: GradientProps) {
  // screenUV.y is 0 at the bottom, 1 at the top.
  return mix(color(props.bottom), color(props.top), screenUV.y)
}
