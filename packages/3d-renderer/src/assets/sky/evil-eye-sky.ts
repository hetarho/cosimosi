import { atan, clamp, float, fract, length, max, pow, vec2 } from 'three/tsl'

import {
  sampleRamp,
  skyStereo,
  skySeconds,
  spin,
  valueNoise,
  type SkyNodeArgs,
} from './sky-node.ts'

// EvilEye — faithful to react-bits' EvilEye: a polar-mapped flaming ocular form — two flame rings,
// an inner-eye body, an elliptical pupil, and an outer glow — churned by noise sampled in polar
// space. The source samples a baked noise texture and tints with a fixed eye color; we swap the
// texture for procedural value noise and colour the flame from the emotion ramp around the iris. The
// eye reads on the SEAMLESS stereographic chart — it faces the viewer, its one singularity tucked
// behind — so there is no wrap seam. Best on a single dominant emotion (an eye is one form), a
// second hue tinting the rim.

const NOISE_SCALE = 1.0
const IRIS_WIDTH = 0.25
const GLOW_INTENSITY = 0.35
const INTENSITY = 1.5

export function evilEyeSkyNode({ gradient, time }: SkyNodeArgs) {
  // Smaller zoom pulls the whole eye into the central view: the source's uScale 0.8 spread the eye
  // edge to ~77° off-centre (it overran the screen), so it never read as an eye. 0.25 lands the eye
  // (and its glow) inside a comfortable field of view. All features are defined via length(p)/p, so
  // this just resizes the eye uniformly — the proportions are unchanged.
  const p = skyStereo(0.25)
  const ft = skySeconds(time, 1)

  const polarRadius = length(p).mul(2)
  // Seamless flame churn. The source sampled noise in polar (radius, angle) space, but a raw angle
  // from atan carries a branch cut → a hard radial seam where the flame "doesn't line up". Instead
  // swirl the CONTINUOUS stereo coordinate by a radius-dependent angle: value-noise combs into radial
  // flame tongues (the polar look) while staying a continuous function of direction, so no seam.
  const swirl = spin(p, polarRadius.mul(2.2).sub(ft.mul(0.3)))
  const noiseA = valueNoise(swirl.mul(3.0 * NOISE_SCALE).add(vec2(ft.mul(-0.1), 0)))
  const noiseB = valueNoise(swirl.mul(4.5 * NOISE_SCALE).add(vec2(0, ft.mul(-0.2))))
  const noiseC = valueNoise(swirl.mul(2.2 * NOISE_SCALE).add(vec2(ft.mul(-0.1), 1.7)))

  const mask = float(1).sub(length(p)) // distanceMask

  let inner = clamp(mask.sub(0.7).div(IRIS_WIDTH).mul(-1), float(0), float(1))
  inner = inner.mul(mask).sub(0.2).div(0.28).add(noiseA.sub(0.5)).mul(1.3)
  inner = clamp(inner, float(0), float(1))

  let outer = clamp(mask.sub(0.5).div(0.2).mul(-1), float(0), float(1))
  outer = outer.mul(mask).sub(0.1).div(0.38).add(noiseC.sub(0.5)).mul(1.3)
  outer = clamp(outer, float(0), float(1))

  const rings = inner.add(outer)
  const innerEye = mask.sub(0.2).mul(noiseB.mul(2))

  let pupil = float(1)
    .sub(length(p.mul(vec2(9, 2.3))))
    .mul(0.6)
  pupil = clamp(pupil, float(0), float(1)).div(0.35)

  let glow = clamp(
    float(1)
      .sub(length(p.mul(vec2(0.5, 1.5))))
      .add(0.5),
    float(0),
    float(1),
  )
  glow = glow.add(noiseC.sub(0.5))
  // Guard the fractional-power base and square via multiply: outside the eye `glow + mask` and
  // `glow` both go negative, and WGSL `pow(negative, …)` is NaN (it would black out the corners).
  const bgGlow = pow(max(glow.add(mask), float(0)), 0.5).mul(0.15)
  glow = glow.mul(glow).add(mask).mul(GLOW_INTENSITY)
  glow = clamp(glow, float(0), float(1)).mul(pow(float(1).sub(mask), 2).mul(2.5))

  const body = clamp(max(rings.add(innerEye), glow.add(bgGlow)).sub(pupil), float(0), float(3))

  // colour the flame from the palette around the iris; a faint core tone fills the pupil
  const hue = fract(
    atan(p.y, p.x)
      .mul(1 / (2 * Math.PI))
      .add(0.5)
      .add(polarRadius.mul(0.08)),
  )
  const flame = sampleRamp(gradient, hue).mul(INTENSITY).mul(body)
  const core = sampleRamp(gradient, float(0.5)).mul(0.02)
  return clamp(flame.add(core), float(0), float(1))
}
