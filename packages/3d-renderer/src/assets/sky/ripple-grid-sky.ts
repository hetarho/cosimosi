import { abs, clamp, exp, float, length, pow, sin, smoothstep, vec3 } from 'three/tsl'

import type { Texture } from 'three/webgpu'

import { asVec2Node } from '../../tsl'
import { sampleRamp, skyDir, skySeconds, type SkyNodeArgs } from './sky-node.ts'

// RippleGrid — faithful to react-bits' RippleGrid (a radial ripple displaces a grid of glowing
// lines, faded by distance and a vignette). Mapped onto the sphere via TWO stereographic charts —
// one projected from behind the viewer (the front hemisphere) and one from in front (the back
// hemisphere) — so the grid wraps the WHOLE sky and looking the other way shows grid, not black.
// Each chart's own distance-fade darkens its far pole (which the OTHER chart covers), so neither
// singular pole ever pinches and the two tile the sphere. We keep the exact grid math (sin→abs→
// smoothstep mask, four stacked exp glow terms, ripple displacement) and colour the surviving line
// energy from the emotion ramp along the radius, so concentric zones carry different emotions.

const PI = Math.PI
const RIPPLE_INTENSITY = 0.06
const GRID_SIZE = 20 // 2× the source density — a tighter mesh
const GRID_THICKNESS = 15
const FADE_DISTANCE = 1.5
const VIGNETTE_STRENGTH = 2
const GLOW = 0.12

/** The full RippleGrid contribution for one stereographic chart coordinate `p`. */
function gridChart(p: unknown, gradient: Texture, t: ReturnType<typeof skySeconds>) {
  const pv = asVec2Node(p)
  const dist = length(pv)

  // radial ripple pushes the grid coordinates outward in a travelling wave
  const wave = sin(t.sub(dist).mul(PI))
  const rip = pv.add(pv.mul(wave).mul(RIPPLE_INTENSITY))

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

  // distance fade + vignette — both darken this chart's far field (its singular pole) to black
  const fade = exp(clamp(pow(dist, FADE_DISTANCE), float(0), float(1)).mul(-2))
  const vig = clamp(
    float(1).sub(pow(clamp(dist.mul(0.6), float(0), float(1)), VIGNETTE_STRENGTH)),
    float(0),
    float(1),
  )

  // colour the line energy from the palette along the radius
  const emo = sampleRamp(gradient, clamp(dist.mul(0.5), float(0), float(1)))
  return emo.mul(energy).mul(fade).mul(vig)
}

export function rippleGridSkyNode({ gradient, time }: SkyNodeArgs) {
  const t = skySeconds(time, 0.4) // slower travel than the source
  const d = skyDir()

  // Front hemisphere (view centre −Z): stereographic projection from the +Z pole behind the viewer.
  const front = d.xy.div(float(1).sub(d.z).max(1e-3))
  // Back hemisphere: projection from the −Z pole in front. Its singular pole is the front centre,
  // which the front chart already fills — so summing the two draws grid on BOTH sides.
  const back = d.xy.div(float(1).add(d.z).max(1e-3))

  const col = gridChart(front, gradient, t).add(gridChart(back, gradient, t))
  return clamp(col, float(0), vec3(1))
}
