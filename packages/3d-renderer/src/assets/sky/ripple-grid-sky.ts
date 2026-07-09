import { abs, clamp, exp, float, length, pow, sin, smoothstep } from 'three/tsl'

import { sampleRamp, skyStereo, skySeconds, type SkyNodeArgs } from './sky-node.ts'

// RippleGrid — faithful to react-bits' RippleGrid (a radial ripple displaces a grid of glowing
// lines, faded by distance and a vignette) mapped SEAMLESSLY onto the sphere via the stereographic
// chart: the grid faces the viewer, its one singularity sits behind — and the distance fade darkens
// that far region to black, so it never shows. We keep the exact grid math (the sin→abs→smoothstep
// mask, the four stacked exp glow terms, the ripple displacement) and colour the surviving line
// energy from the emotion ramp along the radius, so concentric zones carry different emotions.

const PI = Math.PI
const RIPPLE_INTENSITY = 0.06
const GRID_SIZE = 10
const GRID_THICKNESS = 15
const FADE_DISTANCE = 1.5
const VIGNETTE_STRENGTH = 2
const GLOW = 0.12

export function rippleGridSkyNode({ gradient, time }: SkyNodeArgs) {
  const p = skyStereo()
  const t = skySeconds(time)
  const dist = length(p)

  // radial ripple pushes the grid coordinates outward in a travelling wave
  const wave = sin(t.sub(dist).mul(PI))
  const rip = p.add(p.mul(wave).mul(RIPPLE_INTENSITY))

  // the grid line mask: distance to the nearest grid line, softened
  const a = sin(rip.mul(GRID_SIZE * 0.5 * PI).sub(PI / 2))
  const b = abs(a)
  const sb = smoothstep(float(0), float(0.5), b)

  // four stacked exponential falloffs — the source's layered line glow (x line pulses with time)
  let energy = exp(sb.x.mul(-GRID_THICKNESS).mul(sin(t.mul(PI)).mul(0.5).add(0.8)))
  energy = energy.add(exp(sb.y.mul(-GRID_THICKNESS)))
  energy = energy.add(exp(sin(sb.x).mul(-GRID_THICKNESS / 4)).mul(0.5))
  energy = energy.add(exp(sb.y.mul(-GRID_THICKNESS / 3)).mul(0.5))
  energy = energy.add(exp(sb.x.mul(-GRID_THICKNESS * 0.5)).mul(GLOW))
  energy = energy.add(exp(sb.y.mul(-GRID_THICKNESS * 0.5)).mul(GLOW))

  // distance fade + vignette — both darken the far field (behind the viewer) to black
  const fade = exp(clamp(pow(dist, FADE_DISTANCE), float(0), float(1)).mul(-2))
  const vig = clamp(
    float(1).sub(pow(clamp(dist.mul(0.6), float(0), float(1)), VIGNETTE_STRENGTH)),
    float(0),
    float(1),
  )

  // colour the line energy from the palette along the radius
  const emo = sampleRamp(gradient, clamp(dist.mul(0.5), float(0), float(1)))
  return clamp(emo.mul(energy).mul(fade).mul(vig), float(0), float(1))
}
