import { float, normalize, sin, smoothstep, vec3 } from 'three/tsl'

import { gnoise } from '../../shader-art/noise'
import { skyCloud, skyDir, skyDrift } from './sky-domain.ts'
import { emotionField } from './sky-emotion.ts'
import { skyFinish, skyVoid } from './sky-finish.ts'
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
//
// THE NIGHT HAS TO SHOW THROUGH. A sky is a place with things in it, not a filled surface, and the fold
// alone cannot supply that: it moves the coordinate a colour is read at, so on its own it changes hue
// without ever going dark — hand it a single feeling and every pixel resolves to the same value, which
// is an opaque sheet the colour of that feeling. Uniform translucency does not rescue it either, because
// tinting the whole frame equally is still a filled surface. So the fold's own depth gates how much sky
// the wash claims, and the troughs fall back toward the bare night with the stars in front of them.

/** Where the wash thins to almost nothing, and where it is fully itself. Kept apart so the marble reads
 *  as light and dark rather than as one sheet, at any emotion count. */
const WASH_FLOOR = 0.12
const WASH_FULL = 0.86

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
  const direction = normalize(warped)

  // A low sharpness lets territories bleed into one another instead of showing an edge.
  const emotion = emotionField({
    gradient,
    count,
    weights,
    dir: direction,
    sharpness: 1.1,
  })

  // The marble's own depth, sampled off the folded direction so the light and the colour belong to the
  // same swirl rather than being two patterns laid over each other.
  const depth = skyCloud(direction, 1.15, 3)
  const coverage = smoothstep(float(WASH_FLOOR), float(WASH_FULL), depth)

  return skyFinish(skyVoid(emotion.color, coverage), {
    contrast: 1.15,
    grain: 0.05,
    headroom,
  })
}
