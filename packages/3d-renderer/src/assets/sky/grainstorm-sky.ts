import { float, normalize, sin, smoothstep, vec3 } from 'three/tsl'

import { gnoise } from '../../shader-art/noise'
import { skyCloud, skyDir, skyDrift } from './sky-domain.ts'
import { emotionField } from './sky-emotion.ts'
import { skyFinish, skyVoid } from './sky-finish.ts'
import { filmGrain, skySeconds, type SkyNodeArgs } from './sky-node.ts'

// Grainstorm — the same marble as Grainient, printed instead of lit: the grain is the surface, not a
// whisper over it, and the colour is pushed until it survives the grain.
//
// domain   the surface direction, folded the same way Grainient folds it
// field    gnoise driving the fold, plus a second grain layer at a much coarser scale
// emotion  territories read at the warped direction, harder-edged than Grainient's
// finish   heavy grain, lifted saturation, strong contrast
//
// Grain and colour have to move together, which is the whole reason this is a recipe of its own rather
// than a parameter on Grainient. Grain is high-frequency luminance noise: laid over a soft gradient it
// eats the very thing that makes the gradient readable, and the sky turns to television static with a
// hint of hue. So the colour is deliberately harder here — territories with visible boundaries, chroma
// pushed away from the midpoint — and the grain is coarse enough to read as tooth rather than noise.
// Grainient stays the quiet one; this is the one you notice. Its depth gate is TIGHTER than
// Grainient's: heavy grain over a wide fill reads as television static, so the printed marble holds
// less of the sky and leaves more of the night for the grain to sit against.

/** Grain amplitude in the finish — an order above Grainient's whisper. */
const GRAIN = 0.16
/** A second, coarser grain layer: tooth rather than static. */
const TOOTH_SCALE = 0.055
const TOOTH_AMOUNT = 0.13
/** How far colour is pushed from its midpoint, so hue survives the grain sitting on top of it. */
const CONTRAST = 1.42
/** Territories read harder than Grainient's, so the grain has edges to sit against. */
const SHARPNESS = 2.4
/** Where the printed marble thins to nothing, and where it is fully itself. */
const PRINT_FLOOR = 0.24
const PRINT_FULL = 0.9

export function grainstormSkyNode({ gradient, time, count, weights, headroom }: SkyNodeArgs) {
  const t = skySeconds(time, 0.25)
  const p = skyDrift(skyDir().mul(1.8), t, [0, 0, 0.4])

  const swirl = gnoise(p)
  const warped = vec3(
    p.x.add(sin(p.y.mul(3).add(t)).mul(0.25)).add(swirl.mul(0.4)),
    p.y.add(sin(p.z.mul(3.5).add(t)).mul(0.3)).add(swirl.mul(0.3)),
    p.z.add(sin(p.x.mul(2.5).sub(t)).mul(0.25)),
  )

  const direction = normalize(warped)
  const emotion = emotionField({
    gradient,
    count,
    weights,
    dir: direction,
    sharpness: SHARPNESS,
  })

  // The marble's own depth, off the same folded direction — the ink only lands where the fold is thick.
  const coverage = smoothstep(float(PRINT_FLOOR), float(PRINT_FULL), skyCloud(direction, 1.15, 3))

  // The coarse layer. Sampled off the same warped frame as the colour, so the tooth belongs to the
  // marble and travels with it instead of sitting on the glass in front of it.
  const tooth = gnoise(warped.mul(TOOTH_SCALE)).mul(TOOTH_AMOUNT)
  const printed = skyVoid(emotion.color.add(tooth), coverage).add(filmGrain(GRAIN * 0.5))

  return skyFinish(printed, { contrast: CONTRAST, grain: GRAIN, headroom })
}
