import { normalize, sin, vec3 } from 'three/tsl'

import { gnoise } from '../../shader-art/noise.ts'
import { volumeScattering } from '../../shader-art/volume.ts'
import { skyDir, skySpin, type SkyFrameSpin } from './sky-domain.ts'
import { emotionField } from './sky-emotion.ts'
import { skyFinish } from './sky-finish.ts'
import { skySeconds, type SkyNodeArgs } from './sky-node.ts'

/** How fast Grainient's own clock runs against the sky's seconds. */
const CLOCK = 0.25

/** The turn that carries Grainient's marble past the viewer, 0.15 radians per second of its clock. */
export const GRAINIENT_SPIN: SkyFrameSpin = { axis: [0.25, 1, 0.2], rate: 0.15 * CLOCK }

function grainientDirection(time: unknown) {
  const t = skySeconds(time, CLOCK)
  // The frame moves by ROTATION, because it feeds a normalize below: a translating frame accumulates
  // until every fragment normalizes to the drift axis and the marble dies to one value (skyDrift's
  // contract). The spin carries the marble past the viewer forever; the sines and the swirl churn it.
  const p = skySpin(skyDir(), skySeconds(time), GRAINIENT_SPIN.axis, GRAINIENT_SPIN.rate).mul(1.8)

  // The signature organic turn: one noise sample bends the sample frame, three sines fold it.
  const swirl = gnoise(p)
  const warped = vec3(
    p.x.add(sin(p.y.mul(3).add(t)).mul(0.25)).add(swirl.mul(0.4)),
    p.y.add(sin(p.z.mul(3.5).add(t)).mul(0.3)).add(swirl.mul(0.3)),
    p.z.add(sin(p.x.mul(2.5).sub(t)).mul(0.25)),
  )
  return normalize(warped)
}

/** The existing emotion territories viewed through a sampled gas volume. The palette, weights,
 * sphere and exposure ceiling stay the sky's; only the way its light scatters is different. */
export function grainientSkyNode({ gradient, time, count, weights, headroom }: SkyNodeArgs) {
  const direction = grainientDirection(time)
  const emotion = emotionField({ gradient, count, weights, dir: direction, sharpness: 1.1 })
  const origin = direction.mul(2.8).add(vec3(1.4, -0.8, 2.1))
  const volume = volumeScattering(origin, direction, 3.2)
  // Finish the colour before adding spatial illumination. Sending every bright density sample
  // through the channel-wise ceiling would push all three channels toward the same grey.
  const colour = skyFinish(emotion.color.mul(0.55), { contrast: 1.15, grain: 0.006, headroom })
  const illumination = volume.smoothstep(0.45, 1.25).pow(1.15).mul(1.85)
  return colour.mul(illumination)
}
