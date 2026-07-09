import { clamp, cos, dot, float, length, max, min, sin, sqrt, vec2, vec3 } from 'three/tsl'

import { floatAcc, sampleRamp, skyDir, skySeconds, type SkyNodeArgs } from './sky-node.ts'

// PlasmaWave — react-bits' PlasmaWave (a short SDF raymarch through two sine/cosine-wobbling neon
// tubes) mapped SEAMLESSLY onto the sphere: each fragment marches along its OWN 3D surface direction
// (`skyDir`) instead of a projected screen ray, so the plasma is a genuine 3D body wrapping the
// scene with no seam and no pole. The two tube colors are drawn from the emotion ramp — richest at
// two or three emotions.

const PI = Math.PI
const STEPS = 16
const LT = 0.3

export function plasmaWaveSkyNode({ gradient, time }: SkyNodeArgs) {
  const t = skySeconds(time, 1).mul(PI)
  const t1 = t.mul(0.7)
  const t2 = t.mul(0.9)
  const tS1 = t.mul(0.05)
  const tS2 = t.mul(0.05)

  const o = vec3(0, 0, -7)
  const u = skyDir() // per-fragment 3D ray — no screen projection, no seam

  let d = floatAcc()
  let s = floatAcc(1)
  let kx = floatAcc()
  let ky = floatAcc()
  for (let i = 0; i < STEPS; i++) {
    const p = o.add(u.mul(d))
    const px = p.x.sub(15)
    const wob1 = float(1).add(sin(t1.add(px.mul(0.8))).mul(0.1))
    const wob2 = float(0.5).add(cos(t2.add(px.mul(1.1))).mul(0.1))
    const px2 = px.add(PI / 2)
    const sinOff = sin(vec2(px, px2).add(tS1)).mul(wob1)
    const cosOff = cos(vec2(px, px2).add(tS2)).mul(wob2)
    const yz = vec2(p.y, p.z)
    const pxLt = px.add(LT)
    kx = max(pxLt, length(yz.sub(sinOff)).sub(LT))
    ky = max(pxLt, length(yz.sub(cosOff)).sub(LT))
    s = min(s, min(kx, ky))
    d = d.add(s.mul(0.7))
  }

  // The source breaks the march once it hits a surface, keeping `d` monotonic ≥ 0; we unroll a
  // fixed step count instead, so `s` (and thus `d`) can dip negative — guard before the sqrt
  // (WGSL `sqrt(negative)` is NaN, which would black out the tubes).
  const sqrtD = sqrt(max(d, float(0)))
  const scalar = cos(d.mul(PI * 2)).sub(s.mul(sqrtD))
  let raw = max(vec3(scalar.sub(kx), scalar.sub(ky), scalar), vec3(0))
  raw = vec3(raw.x, raw.y.add(0.1), raw.z.add(0.1))
  raw = raw.mul(0.4).add(vec3(raw.z, raw.x, raw.y).mul(0.6)).add(raw.mul(raw))
  const lum = dot(raw, vec3(0.299, 0.587, 0.114))

  const w1 = max(float(0), float(1).sub(kx.mul(2)))
  const w2 = max(float(0), float(1).sub(ky.mul(2)))
  const wt = w1.add(w2).add(0.001)
  const c1 = sampleRamp(gradient, float(0.25))
  const c2 = sampleRamp(gradient, float(0.8))
  const c = c1.mul(w1).add(c2.mul(w2)).div(wt).mul(lum).mul(3.5)
  return clamp(c, float(0), float(1))
}
