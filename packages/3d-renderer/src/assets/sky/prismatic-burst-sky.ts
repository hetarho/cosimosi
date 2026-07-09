import {
  clamp,
  cos,
  float,
  fract,
  length,
  min,
  mix,
  pow,
  sin,
  smoothstep,
  vec3,
  vec4,
} from 'three/tsl'

import { asFloatNode, asVec3Node } from '../../tsl'
import {
  floatAcc,
  sampleRamp,
  skyDir,
  skyFrontAngle,
  skySeconds,
  spin,
  valueNoise,
  vec3Acc,
  type SkyNodeArgs,
} from './sky-node.ts'

// PrismaticBurst — a faithful port of react-bits' PrismaticBurst (the one source that already
// samples a gradient texture), mapped SEAMLESSLY onto the sphere: each fragment volume-marches along
// its OWN 3D surface direction (`skyDir`) rather than a projected screen ray, so the burst wraps the
// scene with no seam and no pole. The march accumulates gradient-colored energy where a bent
// interference pattern fires; the marched color IS the emotion ramp along the ray. Step count is
// toned for the sphere. Rich at many emotions — the ramp is swept continuously.

const PI = Math.PI
const STEPS = 16
const AMP = 0.3
const JITTER = 0.05
const INTENSITY = 1.6

/** The source's `bendAngle` — three summed sines that twist the march coordinates. */
function bendAngle(q: unknown, t: unknown) {
  const qv = asVec3Node(q)
  const tt = asFloatNode(t)
  return sin(qv.x.mul(0.55).add(tt.mul(0.6)))
    .mul(0.8)
    .add(sin(qv.y.mul(0.5).sub(tt.mul(0.5))).mul(0.7))
    .add(sin(qv.z.mul(0.6).add(tt.mul(0.7))).mul(0.6))
}

export function prismaticBurstSkyNode({ gradient, time }: SkyNodeArgs) {
  const t = skySeconds(time, 1)
  const dir = skyDir() // per-fragment 3D ray — no screen projection, no seam
  const n = valueNoise(dir.xy.mul(60)) // per-pixel step jitter

  // the self-animating 2D rotation applied to the march's xz each step (source's `M2`)
  const cc = cos(t.mul(0.2).add(vec4(0, 33, 11, 0)))

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

    // bend the coordinates through two rotations, then read the interference pattern
    const xz = spin(Pl.xz, a1)
    const xy = spin(vec3(xz.x, Pl.y, xz.y).xy, a2)
    const Pb = vec3(xy.x, xy.y, xz.y)
    const ray = smoothstep(
      float(0.5),
      float(0.7),
      sin(Pb.x.add(cos(Pb.y).mul(cos(Pb.z)))).mul(sin(Pb.z.add(sin(Pb.y).mul(cos(Pb.x.add(t)))))),
    )

    const saw = fract(marchT.mul(0.25))
    const tRay = saw.mul(saw).mul(float(3).sub(saw.mul(2)))
    const spectral = sampleRamp(gradient, tRay).mul(2)
    const base = spectral
      .mul(float(0.05).div(stepLen.add(0.4)))
      .mul(smoothstep(float(5), float(0), rad))
    col = col.add(base.mul(ray))
    marchT = marchT.add(stepLen)
  }

  // the source's smootherstep edge fade over the seamless front-angle radius (darkens the core, so
  // rays stream outward); r ∈ [0,1] by construction, so the pow bases stay non-negative
  const r = skyFrontAngle().div(PI)
  const q = r
    .mul(r)
    .mul(r)
    .mul(r.mul(r.mul(6).sub(15)).add(10))
  let s = pow(q.mul(0.5), 1.5)
  s = mix(s, float(1).sub(pow(float(1).sub(s), 2)), 0.2)
  return clamp(col.mul(clamp(s, float(0), float(1))).mul(INTENSITY), float(0), float(1))
}
