import { clamp, float, length, max, pow, vec2, vec3 } from 'three/tsl'

import { asVec2Node } from '../../tsl'
import {
  sampleRamp,
  skyStereo,
  skySeconds,
  spin,
  valueNoise,
  vec3Acc,
  type SkyNodeArgs,
} from './sky-node.ts'

// EvilEye — react-bits' EvilEye (a polar-mapped flaming ocular form: two flame rings, an inner-eye
// body, an elliptical pupil, an outer glow, all churned by polar-space noise) rebuilt as ONE EYE PER
// EMOTION. Each eye is the source's ocular form in its OWN local frame, and the eyes sit EVENLY SPACED
// around a ring — the angular step is 2π/count (2 eyes → 180° apart, 3 → 120°, …) so no two crowd
// together — over the seamless stereographic chart (facing the viewer, singularity tucked behind). A
// single emotion sits centred. Each eye's RADIUS is its emotion's intensity (the primary opens widest,
// faint feelings smaller), and each is coloured from its own emotion's ramp band.

const IRIS_WIDTH = 0.25
const GLOW_INTENSITY = 0.35
const INTENSITY = 1.5
const ORBIT = 1.5 // radius of the ring the eyes sit on (0 → a single centred eye)
const EYE_BASE = 1.1 // radius of the primary eye (a lone eye, or the largest on the ring)
const EYE_FLOOR = 0.35 // smallest eye as a fraction of the fitted max, so faint emotions still read
const FIELD = 3.3 // usable stereo half-extent — keeps the ring of eyes inside the view

/** The source's ocular form evaluated in a local frame `q` (|q|<1 is the eye), returning a body
 *  scalar. The background-glow term is dropped here — it was a single full-screen fill in the source
 *  and would stack once per eye; a single faint core is added by the caller instead. */
function eyeBody(q: unknown, ft: ReturnType<typeof skySeconds>) {
  const qv = asVec2Node(q)
  const polarRadius = length(qv).mul(2)
  // Seamless flame churn: swirl the continuous local coordinate by a radius-dependent angle so
  // value-noise combs into radial flame tongues (the polar look) with no branch-cut seam.
  const swirl = spin(qv, polarRadius.mul(2.2).sub(ft.mul(0.3)))
  const noiseA = valueNoise(swirl.mul(3.0).add(vec2(ft.mul(-0.1), 0)))
  const noiseB = valueNoise(swirl.mul(4.5).add(vec2(0, ft.mul(-0.2))))
  const noiseC = valueNoise(swirl.mul(2.2).add(vec2(ft.mul(-0.1), 1.7)))

  const mask = float(1).sub(length(qv)) // distanceMask

  let inner = clamp(mask.sub(0.7).div(IRIS_WIDTH).mul(-1), float(0), float(1))
  inner = inner.mul(mask).sub(0.2).div(0.28).add(noiseA.sub(0.5)).mul(1.3)
  inner = clamp(inner, float(0), float(1))

  let outer = clamp(mask.sub(0.5).div(0.2).mul(-1), float(0), float(1))
  outer = outer.mul(mask).sub(0.1).div(0.38).add(noiseC.sub(0.5)).mul(1.3)
  outer = clamp(outer, float(0), float(1))

  const rings = inner.add(outer)
  const innerEye = mask.sub(0.2).mul(noiseB.mul(2))

  let pupil = float(1)
    .sub(length(qv.mul(vec2(9, 2.3))))
    .mul(0.6)
  pupil = clamp(pupil, float(0), float(1)).div(0.35)

  let glow = clamp(
    float(1)
      .sub(length(qv.mul(vec2(0.5, 1.5))))
      .add(0.5),
    float(0),
    float(1),
  )
  glow = glow.add(noiseC.sub(0.5))
  // Guard the fractional-power base: outside the eye `glow` goes negative and WGSL pow(neg,·) is NaN.
  glow = glow.mul(glow).add(mask).mul(GLOW_INTENSITY)
  glow = clamp(glow, float(0), float(1)).mul(pow(max(float(1).sub(mask), float(0)), 2).mul(2.5))

  return clamp(max(rings.add(innerEye), glow).sub(pupil), float(0), float(3))
}

export function evilEyeSkyNode({ gradient, time, count, weights }: SkyNodeArgs) {
  const eyes = Math.max(1, count)
  // A wider field than the single-eye port so several eyes fit across the front hemisphere.
  const p = skyStereo(0.25)
  const ft = skySeconds(time, 1)
  const topWeight = weights.reduce((m, w) => Math.max(m, w), 0) || 1

  // Place the eyes on a ring. The largest eye radius that still fits is bounded by the angular gap to
  // its neighbours (adjacent centres are 2·ORBIT·sin(π/eyes) apart) and by the visible field, so eyes
  // shrink to stay separated as the count climbs.
  const orbit = eyes === 1 ? 0 : ORBIT
  const spacingLimit = eyes === 1 ? EYE_BASE : orbit * Math.sin(Math.PI / eyes) * 0.85
  const rmax = Math.min(EYE_BASE, spacingLimit, FIELD - orbit)

  let col = vec3Acc()
  for (let i = 0; i < eyes; i++) {
    const angle = (2 * Math.PI * i) / eyes // evenly spaced around the ring
    const cx = orbit * Math.cos(angle)
    const cy = orbit * Math.sin(angle)
    // eye radius ∝ emotion intensity (with a floor so faint emotions still show as small eyes)
    const w = weights[i] ?? 1 / eyes
    const rad = rmax * (EYE_FLOOR + (1 - EYE_FLOOR) * (w / topWeight))
    const local = p.sub(vec2(cx, cy)).div(rad)

    const body = eyeBody(local, ft)
    const eyeColor = sampleRamp(gradient, eyes > 1 ? i / (eyes - 1) : 0.5)
    col = col.add(eyeColor.mul(INTENSITY).mul(body))
  }

  // one faint palette core so the field isn't pure black between the eyes
  const core = sampleRamp(gradient, float(0.5)).mul(0.02)
  return clamp(col.add(core), float(0), vec3(1))
}
