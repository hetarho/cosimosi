import { normalize, sin, vec3 } from 'three/tsl'

import { gnoise } from '../../shader-art/noise'
import { skyDir, skyDrift } from './sky-domain.ts'
import { emotionField } from './sky-emotion.ts'
import { skyFinish } from './sky-finish.ts'
import { skySeconds, type SkyNodeArgs } from './sky-node.ts'

// Grainient — a warped, grain-lit marble, and the sky a universe opens on.
//
// domain   the surface direction, folded by a noise swirl and three sine warps
// field    gnoise, once, driving the fold
// emotion  the territory blend read at the WARPED direction — the marble carries the feelings, rather
//          than the feelings being painted on top of a marble that ignores them
// finish   contrast + grain, under the sky's headroom
//
// The fold is what makes it a marble rather than a set of zones: handed several feelings it drags their
// territories through one another until the borders are gone. One feeling is a single colour washed over
// everything, which is the quietest this sky can be and the right thing for a universe to open on.

export function grainientSkyNode({ gradient, time, count, weights, headroom }: SkyNodeArgs) {
  const t = skySeconds(time, 0.25)
  const p = skyDrift(skyDir().mul(1.8), t, [0, 0, 0.4])

  // The signature organic turn: one noise sample bends the sample frame, three sines fold it.
  const swirl = gnoise(p)
  const warped = vec3(
    p.x.add(sin(p.y.mul(3).add(t)).mul(0.25)).add(swirl.mul(0.4)),
    p.y.add(sin(p.z.mul(3.5).add(t)).mul(0.3)).add(swirl.mul(0.3)),
    p.z.add(sin(p.x.mul(2.5).sub(t)).mul(0.25)),
  )

  // A low sharpness lets territories bleed into one another instead of showing an edge.
  const emotion = emotionField({
    gradient,
    count,
    weights,
    dir: normalize(warped),
    sharpness: 1.1,
  })

  return skyFinish(emotion.color, { contrast: 1.15, grain: 0.05, headroom })
}
