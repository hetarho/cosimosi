// Nebula background: a domain-warped fbm density blended over a vertical palette gradient
// — the toolkit's noise+field layers composed into a look. One TSL source → WGSL (web +
// native) + GLSL (fallback). Assigned to scene.backgroundNode by the Background layer.
import { color, mix, screenUV, vec3, float } from 'three/tsl'
import { fbm01 } from '../../shader-art/noise'
import { domainWarp } from '../../shader-art/field'

export interface NebulaProps {
  /** Base clear color, linear RGB 0..1. Carried by the preset; not yet wired to the renderer. */
  readonly clear: readonly [number, number, number]
  /** Nebula hues (hex): [base, mid, highlight] the background composes between. */
  readonly palette: readonly [number, number, number]
  /** Toolkit tuning: domain-warp amount, base frequency, density contrast. */
  readonly pattern: { readonly warp: number; readonly freq: number; readonly detail: number }
}

export function nebulaBackgroundNode(props: NebulaProps) {
  const uv = screenUV.mul(props.pattern.freq)
  // domain-warp the sampling coords (field) then fbm for nebula density (noise) — two
  // toolkit layers composed; density contrast from the props.
  const warped = domainWarp(vec3(uv.x, uv.y, float(0)), { amount: props.pattern.warp, octaves: 3 })
  const density = fbm01(warped, { octaves: 4 }).pow(float(props.pattern.detail))
  const base = mix(color(props.palette[0]), color(props.palette[1]), screenUV.y)
  return mix(base, color(props.palette[2]), density)
}
