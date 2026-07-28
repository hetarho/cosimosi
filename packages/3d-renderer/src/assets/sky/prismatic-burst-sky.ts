import { clamp, cos, float, length, min, sin, smoothstep, vec3, vec4 } from 'three/tsl'

import { asFloatNode, asVec3Node } from '../../tsl'
import { skyDir } from './sky-domain.ts'
import { emotionField } from './sky-emotion.ts'
import { skyFinish } from './sky-finish.ts'
import {
  floatAcc,
  skyFrontAngle,
  skySeconds,
  spin,
  valueNoise,
  vec3Acc,
  type SkyNodeArgs,
} from './sky-node.ts'

// PrismaticBurst — rays of light fired outward through a bent interference pattern.
//
// domain   the surface direction, volume-marched per fragment — each pixel walks its own ray, so the
//          burst wraps the scene with nothing projected and nothing to gather
// field    a bent interference pattern sampled along the march, accumulating energy where it fires
// emotion  the territory blend, so a ray carries the feeling of the region it crosses
// finish   an outward falloff, then the headroom
//
// WEAK FEELINGS KEEP THEIR HUE. The rays were coloured by sampling the ramp at the AZIMUTH — a thin
// sector for a low-weighted feeling, which a sparse ray pattern then mostly missed, so a faint feeling
// was not merely small on screen, it was absent from it. (The ramp made that worse by mixing low-weight
// colours toward the night; that is fixed at the source in `emotion-gradient`.) A territory is a region
// of the sphere rather than a wedge of a ramp coordinate, so every feeling gets rays through it, and
// its colour there is its own at full chroma.

const PI = Math.PI
const STEPS = 16
const AMP = 0.3
const JITTER = 0.05
const INTENSITY = 1.6
/** How much of the far side the territory blend washes, so the back is not dead black. */
const AMBIENT = 0.09

/** Three summed sines that twist the march coordinates. */
function bendAngle(q: unknown, t: unknown) {
  const qv = asVec3Node(q)
  const tt = asFloatNode(t)
  return sin(qv.x.mul(0.55).add(tt.mul(0.6)))
    .mul(0.8)
    .add(sin(qv.y.mul(0.5).sub(tt.mul(0.5))).mul(0.7))
    .add(sin(qv.z.mul(0.6).add(tt.mul(0.7))).mul(0.6))
}

export function prismaticBurstSkyNode({ gradient, time, count, weights, headroom }: SkyNodeArgs) {
  const t = skySeconds(time, 1)
  const dir = skyDir()
  const n = valueNoise(dir.xy.mul(60)) // per-pixel step jitter

  // The self-animating rotation applied to the march's xz each step.
  const cc = cos(t.mul(0.2).add(vec4(0, 33, 11, 0)))

  // A ray takes the colour of the territory it crosses. Sharp enough that the sectors read as distinct
  // coloured fans rather than one wash, soft enough that they do not show a hard edge mid-ray.
  const emotion = emotionField({ gradient, count, weights, dir, sharpness: 2.2 })
  const emo = emotion.color.mul(2)

  let col = vec3Acc()
  let marchT = floatAcc(0.01)
  for (let i = 0; i < STEPS; i++) {
    const P = vec3(dir.x.mul(marchT), dir.y.mul(marchT), dir.z.mul(marchT).sub(2))
    const rad = length(P)
    let Pl = P.mul(float(10).div(rad.max(1e-6)))
    Pl = vec3(cc.x.mul(Pl.x).add(cc.z.mul(Pl.z)), Pl.y, cc.y.mul(Pl.x).add(cc.w.mul(Pl.z)))

    const stepLen = min(rad.sub(0.3), n.mul(JITTER)).add(0.1)
    const grow = smoothstep(float(0.35), float(3), marchT)
    const a1 = grow.mul(AMP).mul(bendAngle(Pl.mul(0.6), t))
    const a2 = grow.mul(AMP * 0.5).mul(bendAngle(Pl.zyx.mul(0.5).add(3.1), t.mul(0.9)))

    // Bend the coordinates through two rotations, then read the interference pattern.
    const xz = spin(Pl.xz, a1)
    const xy = spin(vec3(xz.x, Pl.y, xz.y).xy, a2)
    const Pb = vec3(xy.x, xy.y, xz.y)
    const ray = smoothstep(
      float(0.5),
      float(0.7),
      sin(Pb.x.add(cos(Pb.y).mul(cos(Pb.z)))).mul(sin(Pb.z.add(sin(Pb.y).mul(cos(Pb.x.add(t)))))),
    )

    const base = emo.mul(float(0.05).div(stepLen.add(0.4))).mul(smoothstep(float(5), float(0), rad))
    col = col.add(base.mul(ray))
    marchT = marchT.add(stepLen)
  }

  // Outward falloff over the seamless front angle, so the rays stream out rather than sitting on a disc.
  // Monotonic by construction: any re-brightened mid band reads as a hard concentric ring in front.
  const r = skyFrontAngle().div(PI)
  const s = r
    .mul(r)
    .mul(r)
    .mul(r.mul(r.mul(6).sub(15)).add(10))
  const lit = col.mul(clamp(s, float(0), float(1))).mul(INTENSITY)

  // The far side, kept to the rear third so it never forms a ring, with a whisper of noise so it is not
  // a flat plate.
  const ambient = emotion.color
    .mul(smoothstep(float(0.55), float(1), r))
    .mul(float(AMBIENT).add(n.mul(0.04)))
  return skyFinish(lit.add(ambient), { contrast: 1.02, grain: 0.02, headroom })
}
