import { clamp, float, length, max, pow, vec2 } from 'three/tsl'

import { asVec2Node } from '../../tsl'
import { skyDir, skyLocal2D } from './sky-domain.ts'
import { emotionAnchors, emotionField, emotionRadius } from './sky-emotion.ts'
import { markSize, skyFinish } from './sky-finish.ts'
import { skySeconds, spin, valueNoise, vec3Acc, type SkyNodeArgs } from './sky-node.ts'

// EvilEye — a flaming ocular form, one per feeling, each looking out from its own place in the sky.
//
// domain   each eye reads its own tangent patch around its own anchor, so its polar churn is local and
//          nothing is projected through a shared chart
// field    value noise combed into radial flame tongues by a radius-dependent swirl
// emotion  one eye per feeling, at that feeling's anchor, in that feeling's own colour, sized by that
//          feeling's own weight
// finish   under the headroom
//
// Nothing about a single eye may depend on how many eyes there are. Three consequences, each of which
// is the reason the code reads the way it does:
//
//   POSITION comes from the lattice, never from a ring. Eyes spaced 2π/count around a circle read as one
//   arrangement rotating rather than as feelings each having a place of their own.
//
//   SIZE comes from an eye's own weight, never from the gap to its neighbours. A radius fitted to
//   neighbouring eyes means a feeling arriving shrinks every feeling already there.
//
//   COLOUR comes from the centre of that feeling's own ramp band, never from `i / (count − 1)`. Even
//   spacing along the ramp is not where the bands are: with thirteen unequal feelings several such
//   samples land inside the widest band, and the largest feeling's colour turns up on three eyes at once.
//
// The background is the territory blend, faint — not a single sample from the middle of the ramp, which
// would tint the empty sky with whichever feeling happens to sit there and make the void look like it
// belonged to one of the eyes.

const IRIS_WIDTH = 0.25
const GLOW_INTENSITY = 0.35
const INTENSITY = 1.5
/** An eye's angular radius, as a fraction of its feeling's own territory. */
const EYE_OF_TERRITORY = 0.62
/** Smallest and largest an eye may be, in radians of arc — a floor so a faint feeling still opens an
 *  eye, a ceiling so a lone feeling does not become the whole sky. */
const EYE_MIN = 0.18
const EYE_MAX = 0.62
/** How much of the bare sky the territory blend fills between the eyes. */
const AMBIENT = 0.03

/** The ocular form in a local frame `q` (|q| < 1 is the eye), returning a body scalar. The source's
 *  full-screen background glow is dropped: it would stack once per eye. */
function eyeBody(q: unknown, ft: ReturnType<typeof skySeconds>) {
  const qv = asVec2Node(q)
  const polarRadius = length(qv).mul(2)
  // Comb value noise into radial flame tongues by swirling the local coordinate with radius.
  const swirl = spin(qv, polarRadius.mul(2.2).sub(ft.mul(0.3)))
  const noiseA = valueNoise(swirl.mul(3.0).add(vec2(ft.mul(-0.1), 0)))
  const noiseB = valueNoise(swirl.mul(4.5).add(vec2(0, ft.mul(-0.2))))
  const noiseC = valueNoise(swirl.mul(2.2).add(vec2(ft.mul(-0.1), 1.7)))

  const mask = float(1).sub(length(qv))

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
  // Guard the fractional-power base: outside the eye `glow` goes negative and WGSL pow(neg, ·) is NaN.
  glow = glow.mul(glow).add(mask).mul(GLOW_INTENSITY)
  glow = clamp(glow, float(0), float(1)).mul(pow(max(float(1).sub(mask), float(0)), 2).mul(2.5))

  return clamp(max(rings.add(innerEye), glow).sub(pupil), float(0), float(3))
}

export function evilEyeSkyNode({ gradient, time, count, weights, headroom }: SkyNodeArgs) {
  const dir = skyDir()
  const ft = skySeconds(time, 1)
  const emotion = emotionField({ gradient, count, weights, dir, sharpness: 1.7 })
  const anchors = emotionAnchors(Math.max(1, count))

  let col = vec3Acc()
  for (let i = 0; i < anchors.length; i++) {
    const share = emotion.weights[i] ?? 1 / anchors.length
    // Size from this feeling's own territory, bounded — independent of how many feelings there are.
    const radius = Math.min(
      EYE_MAX,
      Math.max(EYE_MIN, emotionRadius(share) * EYE_OF_TERRITORY * markSize(share, { min: 0.5 })),
    )
    // The eye's own tangent patch. Its one degenerate point is the antipode — a hemisphere from the
    // eye it describes — so nothing gathers anywhere the eye is visible.
    const local = skyLocal2D(dir, anchors[i], 1 / radius)
    col = col.add(emotion.colorOf(i).mul(INTENSITY).mul(eyeBody(local, ft)))
  }

  return skyFinish(col.add(emotion.color.mul(AMBIENT)), {
    contrast: 1.03,
    grain: 0.02,
    headroom,
  })
}
