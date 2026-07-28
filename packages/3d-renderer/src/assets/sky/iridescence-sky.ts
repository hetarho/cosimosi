import { cos, float, sin, vec3 } from 'three/tsl'

import { fbm01 } from '../../shader-art/noise'
import { skyDir, skyDrift } from './sky-domain.ts'
import { emotionField } from './sky-emotion.ts'
import { skyFinish } from './sky-finish.ts'
import { floatAcc, skySeconds, type SkyNodeArgs } from './sky-node.ts'

// Iridescence — an oil-slick sheen rolling across the sky.
//
// domain   the surface direction, and only the direction
// field    a feedback integrator whose two terms fold into one another; the fold is what makes the
//          sheen roll rather than merely shift
// emotion  the territory blend, so the sheen rolls THROUGH the feelings present
// finish   contrast + grain under the headroom
//
// NO CHART. The integrator wants two coordinates, and the tempting way to get them is to project the
// sphere onto a plane. That is precisely what cannot be done here: a chart has to gather the sphere
// somewhere, and the gather is visible as a pinch — a sheet of paper drawn to a corner — with the
// integrator's frequency diverging into it. Compressing the chart into a disk softens the gather
// without removing it. So the two coordinates are two ORTHOGONAL scalar fields sampled on the direction
// itself: fbm on the sphere has nothing to gather, and the fold is the effect, so the look is intact.

const SPEED = 0.6
const TAPS = 8
const FIELD_SCALE = 1.35

export function iridescenceSkyNode({ gradient, time, count, weights, headroom }: SkyNodeArgs) {
  const dir = skyDir()
  const t = skySeconds(time, SPEED)

  // Two independent fields on the sphere stand in for the chart's two axes. Centred on zero so the
  // integrator swings both ways, exactly as it did over a signed plane.
  const drifted = skyDrift(dir.mul(FIELD_SCALE), t.mul(0.05), [0, 0, 1])
  const px = fbm01(drifted).sub(0.5).mul(4)
  const py = fbm01(drifted.add(vec3(11.3, 4.7, 2.1)))
    .sub(0.5)
    .mul(4)

  // The feedback loop, unrolled: each pass bends the next through the last.
  let a = floatAcc()
  let d = t.mul(-0.5)
  for (let i = 0; i < TAPS; i++) {
    a = a.add(cos(float(i).sub(d).sub(a.mul(px))))
    d = d.add(sin(py.mul(i).add(a)))
  }
  d = d.add(t.mul(0.5))

  // The per-channel cosine field, read as one scalar — the sheen's brightness structure.
  const cx = cos(px.mul(d)).mul(0.6).add(0.4)
  const cy = cos(py.mul(a)).mul(0.6).add(0.4)
  const cz = cos(a.add(d)).mul(0.5).add(0.5)
  const shimmer = cx.add(cy).add(cz).div(3)

  const emotion = emotionField({ gradient, count, weights, dir, sharpness: 1.3 })
  return skyFinish(emotion.color.mul(shimmer.mul(0.7).add(0.5)), {
    contrast: 1.06,
    grain: 0.03,
    headroom,
  })
}
