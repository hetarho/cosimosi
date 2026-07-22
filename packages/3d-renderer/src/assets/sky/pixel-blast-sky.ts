import { clamp, float, floor, fract, length, sin, smoothstep, vec3 } from 'three/tsl'

import { sampleRamp, skyStereo, skySeconds, type SkyNodeArgs } from './sky-node.ts'

// PixelBlast — a sphere-adapted approximation. The react-bits original is a postprocessing pipeline
// (a liquid-distortion FBO fed by a touch texture) that cannot live in one sky node. What carries
// over is its LOOK: a grid of pixel dots pulsing in blast rings that expand from the center. It
// reads on the SEAMLESS stereographic chart — dots facing the viewer, blast rings expanding from
// the view center, the far field faded to black so the chart's one singularity (behind) never
// shows. Dots are colored from the emotion ramp by radius. Reads well across a few emotions.

const RES = 60

export function pixelBlastSkyNode({ gradient, time }: SkyNodeArgs) {
  const t = skySeconds(time, 1)
  const p = skyStereo()

  // dot-grid: quantized cell center for the ring radius, local offset for the round dot mask
  const cell = floor(p.mul(RES)).add(0.5).div(RES)
  const dist = length(cell)
  const local = fract(p.mul(RES)).sub(0.5)
  const dot = smoothstep(float(0.5), float(0.2), length(local))

  // expanding blast rings, faded toward the back
  const wave = sin(dist.mul(18).sub(t.mul(3)))
  const fade = smoothstep(float(4), float(0.4), dist)

  // Ring THICKNESS tracks emotion INTENSITY. The ramp already gives each emotion a band whose width
  // is its weight and whose colour deepens with its rank (see emotion-gradient); we read that band's
  // brightness back out as luminance and widen the lit ring for it — so a strong feeling paints a
  // thick bright ring and a faint one a thin sliver, rather than every ring the same width.
  const col = sampleRamp(gradient, fract(dist.add(t.mul(0.05))))
  const lum = col.x.add(col.y).add(col.z).div(3)
  const pulse = smoothstep(float(0.9).sub(lum.mul(0.65)), float(1), wave)
  return clamp(col.mul(dot).mul(pulse).mul(fade), float(0), vec3(1))
}
