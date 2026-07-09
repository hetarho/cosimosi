import { clamp, dot, float, fract, max, pow, sin, texture, uv, vec2, vec3 } from 'three/tsl'
import type { Texture } from 'three/webgpu'

import { gnoise } from '../../shader-art/noise'
import { rotate2 } from '../../shader-art/field'

// Grainient — faithful to react-bits' Grainient shader (a warped, noise-rotated multi-color
// gradient under fine film grain). We keep its exact structure — noise-driven rotation of the
// sample frame, the two sine warps, the grain + contrast finish — and only swap the source of
// COLOR: instead of three fixed hex props, the warped diagonal coordinate samples the emotion
// palette ramp (`emotion-gradient.ts`). So more emotions → more color zones in the same look.
//
// Adaptation for the sphere medium: the original rotates by `rotationAmount≈500` over a flat
// quad; on an equirect sphere UV that reads as chaos, so the rotation is toned to a gentle
// organic swirl. Everything else tracks the source.

export interface GrainientSkyArgs {
  /** The emotion palette ramp (see buildEmotionGradientTexture). */
  readonly gradient: Texture
  /** Seconds-elapsed uniform node (host-controlled; frozen under reduced motion). */
  readonly time: unknown
}

export function grainientSkyNode({ gradient, time }: GrainientSkyArgs) {
  const t = float(time as never).mul(0.25) // timeSpeed

  // sphere equirect uv → centered, zoomed sample frame (react-bits: tuv = uv-0.5, /zoom)
  const suv = uv()
  const centered = suv.sub(0.5).div(0.9)

  // noise-driven rotation of the frame (the shader's signature organic turn)
  const degree = gnoise(vec3(t.mul(0.1), centered.x.mul(centered.y), float(0)).mul(2.0))
  const swirl = rotate2(centered, degree.mul(2.5).add(t.mul(0.05)))

  // two sine warps fold the frame into flowing marbled veins
  const warpTime = t.mul(2.0)
  const wx = swirl.x.add(sin(swirl.y.mul(5.0).add(warpTime)).mul(0.06))
  const wy = swirl.y.add(sin(wx.mul(7.5).add(warpTime)).mul(0.1))

  // warped diagonal coordinate → sample the emotion palette ramp
  const g = clamp(wx.mul(0.6).add(wy.mul(0.5)).mul(0.5).add(0.5), float(0), float(1))
  const base = texture(gradient, vec2(g, 0.5)).rgb

  // fine film grain (react-bits: fract(sin(dot)*k)), low amplitude so it reads as texture
  const grain = fract(sin(dot(suv.mul(300.0), vec2(12.9898, 78.233))).mul(43758.5453))
  const grained = base.add(grain.sub(0.5).mul(0.05))

  // gentle contrast + deepen so it stays a premium, non-blinding cosmic tone
  const contrasted = grained.sub(0.5).mul(1.15).add(0.5)
  return clamp(pow(max(contrasted, float(0)), vec3(1.1)), float(0), float(1))
}
