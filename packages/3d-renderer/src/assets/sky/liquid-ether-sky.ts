import { float, pow, smoothstep, vec3 } from 'three/tsl'

import { domainWarp } from '../../shader-art/field'
import { fbm01 } from '../../shader-art/noise'
import { skyDir, skySpin } from './sky-domain.ts'
import { emotionField } from './sky-emotion.ts'
import { skyFinish, skyVoid } from './sky-finish.ts'
import { skySeconds, type SkyNodeArgs } from './sky-node.ts'

// LiquidEther — dye smeared through slow water, marbling. The look is a fluid sim's; the structure
// here is a time-advected domain warp, which wraps the whole sphere and needs no render targets.
//
// domain   the surface direction, advected by an fbm domain warp — the "velocity field"
// field    two fbm samples of the warped frame: the dye's body and its swirl
// emotion  territories read at the WARPED direction, so the flow drags the feelings apart and folds
//          them into one another
// finish   the night gated back in, then contrast + grain under the headroom
//
// THE BLACK STAYS BLACK. The dye is a thing floating IN the void, not a coat of paint over it: where
// the fluid is thin the bare night shows through untouched, and it is the fluid's own density that
// decides where that is. A second feeling arriving divides the clouds — it does not fill in the gaps
// between them, which is what made two emotions read as an invasion of the dark rather than as more
// dye in the same water.

/** Below this density the fluid has not reached, and the night is left alone. */
const DYE_ONSET = 0.34
/** Above this it is fully dye. Between the two, an edge you can see the night through. */
const DYE_FULL = 0.78

export function liquidEtherSkyNode({ gradient, time, count, weights, headroom }: SkyNodeArgs) {
  const t = skySeconds(time, 0.08)

  // Advect the sample frame by an fbm domain warp — the velocity field that smears the dye. The dye
  // flows by translation (fbm eats unbounded coordinates forever), but the frame the territories are
  // read at must not (skyDrift's contract: normalize of a translating frame collapses to the drift
  // axis). So the drift is subtracted back out below before the normalize — the territories keep the
  // warp the flow computed, on a base frame that only ever spins.
  const spun = skySpin(skyDir(), t, [0.25, 1, 0.2], 0.1).mul(2.4)
  const drift = vec3(0, 0, 1).mul(t)
  const warped = domainWarp(spun.add(drift), {
    amount: 1.2,
    octaves: 4,
  })
  const anchored = warped.sub(drift)

  // The dye's own density. This is what carves the clouds out of the void, so it must NOT come from
  // the emotions: adding a feeling has to divide the fluid, never thicken it.
  const body = fbm01(warped.mul(0.5))
  const swirl = fbm01(warped.add(vec3(3.1, 1.7, 0)))
  const density = body.mul(0.7).add(swirl.mul(0.3))
  const presence = smoothstep(float(DYE_ONSET), float(DYE_FULL), density)

  // The feelings divide the dye. Read at the warped direction so a territory is carried by the flow;
  // a middling sharpness keeps two colours as two visible bodies of dye rather than one grey mix.
  const emotion = emotionField({
    gradient,
    count,
    weights,
    dir: anchored.normalize(),
    sharpness: 1.8,
  })

  const sheen = pow(fbm01(warped.mul(2)), 3).mul(0.4)
  const dye = emotion.color.add(emotion.color.mul(sheen))
  return skyFinish(skyVoid(dye, presence), { contrast: 1.08, grain: 0.02, headroom })
}
