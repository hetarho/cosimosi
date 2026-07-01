// Composes the shader-art toolkit into a skin's background — the "mix layers into art"
// step, but kept minimal at the foundation (the rich artistic mixing is later product
// work). One TSL source → WGSL (web + native) + GLSL (fallback). Assign to
// scene.backgroundNode on the renderer side.
import { color, mix, screenUV, vec3, float } from 'three/tsl'
import { fbm01 } from '../shader-art/noise'
import { domainWarp } from '../shader-art/field'
import type { UniverseSkin } from './presets.ts'

export function nebulaBackgroundNode(skin: UniverseSkin) {
  const uv = screenUV.mul(skin.pattern.freq)
  // domain-warp the sampling coords (field) then fbm for nebula density (noise) — two
  // toolkit layers composed; density contrast from the skin.
  const warped = domainWarp(vec3(uv.x, uv.y, float(0)), { amount: skin.pattern.warp, octaves: 3 })
  const density = fbm01(warped, { octaves: 4 }).pow(float(skin.pattern.detail))
  const base = mix(color(skin.palette[0]), color(skin.palette[1]), screenUV.y)
  return mix(base, color(skin.palette[2]), density)
}
