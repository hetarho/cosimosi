import { clamp, cos, float, fract, sin, vec3 } from 'three/tsl'

import { floatAcc, sampleRamp, skyStereo, skySeconds, type SkyNodeArgs } from './sky-node.ts'

// Iridescence — faithful to react-bits' Iridescence: an 8-tap feedback integrator (`a`,`d` fold
// into each other through cos/sin) turns a plain UV into a rolling oil-slick shimmer. The source
// multiplies that shimmer by a single fixed color; we keep the whole integrator verbatim and swap
// only the color source — the feedback phase `a+d` samples the emotion ramp. It reads on the
// SEAMLESS stereographic chart (no wrap seam; its one singularity sits behind the viewer), so the
// sheen rolls through the palette across the sphere and more emotions cut more color zones.

const SPEED = 0.6

export function iridescenceSkyNode({ gradient, time }: SkyNodeArgs) {
  const p = skyStereo()
  const t = skySeconds(time, SPEED)

  // the react-bits feedback loop, unrolled: each pass bends the next through the last
  let a = floatAcc()
  let d = t.mul(-0.5)
  for (let i = 0; i < 8; i++) {
    a = a.add(cos(float(i).sub(d).sub(a.mul(p.x))))
    d = d.add(sin(p.y.mul(i).add(a)))
  }
  d = d.add(t.mul(0.5))

  // the source's per-channel cosine field → a scalar shimmer (its brightness structure)
  const cx = cos(p.x.mul(d)).mul(0.6).add(0.4)
  const cy = cos(p.y.mul(a)).mul(0.6).add(0.4)
  const cz = cos(a.add(d)).mul(0.5).add(0.5)
  const shimmer = cx.add(cy).add(cz).div(3)

  // color from the palette, indexed by the rolling feedback phase
  const phase = fract(a.add(d).mul(0.15))
  const base = sampleRamp(gradient, phase)
  return clamp(base.mul(shimmer.mul(0.7).add(0.5)), float(0), vec3(1))
}
