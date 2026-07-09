import { abs, clamp, float, length, log, max, sin, vec2 } from 'three/tsl'

import { asVec2Node } from '../../tsl'
import { sampleRamp, skyStereo, skySeconds, spin, vec3Acc, type SkyNodeArgs } from './sky-node.ts'

// FloatingLines — faithful to react-bits' FloatingLines: a stack of glowing sine-wave lines, each a
// thin `0.0175 / |uv.y - wave|` filament, the whole field twisted by a log-spiral rotation. The
// source colors the stack by a fixed gradient array indexed per line; we sample the emotion ramp per
// line index instead — so each filament carries its own emotion and the count sets how many distinct
// line-colors thread the field. One emotion → one color of parallel waves; many → a woven spectrum.

const LINES = 6
const LINE_DISTANCE = 0.15
const SPIRAL = 0.3

/** One glowing sine-wave filament (the source's `wave`, mouse-bend dropped). */
function waveLine(p: unknown, offset: number, t: unknown) {
  const pv = asVec2Node(p)
  const amp = sin(
    float(t as never)
      .mul(0.2)
      .add(offset),
  ).mul(0.3)
  const y = sin(pv.x.add(offset).add(float(t as never).mul(0.1))).mul(amp)
  const m = pv.y.sub(y)
  return float(0.0175)
    .div(max(abs(m).add(0.01), float(1e-3)))
    .add(0.01)
}

export function floatingLinesSkyNode({ gradient, time }: SkyNodeArgs) {
  const b = skyStereo().mul(vec2(3, 2)) // seamless chart (singularity behind the viewer)
  const t = skySeconds(time, 1)
  const angle = log(length(b).add(1)).mul(SPIRAL)
  const ruv = spin(b, angle)

  let col = vec3Acc()
  for (let i = 0; i < LINES; i++) {
    const lineCol = sampleRamp(gradient, i / (LINES - 1))
    const p = ruv.add(vec2(LINE_DISTANCE * i, 0))
    col = col.add(lineCol.mul(waveLine(p, 2 + 0.15 * i, t)))
  }
  return clamp(col.mul(0.4), float(0), float(1))
}
