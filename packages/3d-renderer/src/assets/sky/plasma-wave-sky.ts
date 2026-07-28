import { abs, atan, cos, dot, exp, normalize, sin, vec3 } from 'three/tsl'

import { skyDir, skyTangentFrame } from './sky-domain.ts'
import { emotionAnchors, emotionField } from './sky-emotion.ts'
import { markSize, skyFinish } from './sky-finish.ts'
import { skySeconds, vec3Acc, type SkyNodeArgs } from './sky-node.ts'

// PlasmaWave — a tangle of neon tubes weaving through the sky, knotting bright where they cross.
//
// domain   each tube is the small circle where the latitude about its OWN tumbling axis matches a
//          drifting target; the azimuth enters only through sin/cos, so nothing seams
// field    an exponential core plus a soft halo, which is what makes a crossing knot rather than merely
//          overlap
// emotion  one tube per feeling, on that feeling's own axis, in that feeling's own colour, its core
//          WIDTH from that feeling's weight
// finish   under the headroom
//
// One tube per feeling, not a fixed handful: a count that changes nothing is a sky that does not carry
// the universe it hangs in. Each tube takes its colour from its own ramp band rather than from a rolling
// phase, which would hand it whichever hue the phase happened to land on. And a faint feeling's tube is
// THIN rather than dim — the only way it reads as faint instead of as gone.

/** Core tightness of a tube: higher is a thinner, sharper filament. */
const CORE_TIGHT_MAX = 58
const CORE_TIGHT_MIN = 30
/** How much of the bare sky the territory blend fills behind the tangle. */
const AMBIENT = 0.04

export function plasmaWaveSkyNode({ gradient, time, count, weights, headroom }: SkyNodeArgs) {
  const u = skyDir()
  const t = skySeconds(time, 1)
  const emotion = emotionField({ gradient, count, weights, dir: u, sharpness: 1.5 })
  const anchors = emotionAnchors(Math.max(1, count))

  let col = vec3Acc()
  for (let i = 0; i < anchors.length; i++) {
    const share = emotion.weights[i] ?? 1 / anchors.length

    // A tumbling axis seeded from this feeling's anchor: it stays the feeling's own tube, but its plane
    // keeps reorienting so the tangle reads as volumetric rather than pinned to one side.
    const a = t.mul(0.12 + i * 0.017)
    const seed = anchors[i]
    const axis = normalize(
      vec3(
        sin(a.add(i * 1.7))
          .mul(0.5)
          .add(seed[0]),
        cos(a.mul(0.8).add(i * 2.3))
          .mul(0.45)
          .add(seed[1]),
        sin(a.mul(1.3).add(i * 0.9))
          .mul(0.5)
          .add(seed[2]),
      ),
    )
    const frame = skyTangentFrame(seed)
    const b1 = vec3(frame.tangent[0], frame.tangent[1], frame.tangent[2])
    const b2 = vec3(frame.bitangent[0], frame.bitangent[1], frame.bitangent[2])

    // The tube is the small circle where latitude about the axis matches a drifting target, so the ring
    // sweeps across the sphere over time — never quite to the poles, where it would vanish.
    const lat = dot(u, axis)
    const target = sin(t.mul(0.5).add(i * 1.1)).mul(0.55)
    // Azimuth about the axis: wobbles the ring into an organic coil. Enters only via sin, so its ±π
    // branch cut leaves no seam.
    const az = atan(dot(u, b2), dot(u, b1))
    const wob = sin(az.mul(3).add(t.mul(1.1).add(i * 2.0)))
      .mul(0.06)
      .add(sin(az.mul(2).sub(t.mul(0.7))).mul(0.04))
    const dist = abs(lat.sub(target).add(wob))

    // Weight buys WIDTH: a strong feeling is a fat neon cord, a faint one a thread.
    const tight = CORE_TIGHT_MAX - (CORE_TIGHT_MAX - CORE_TIGHT_MIN) * markSize(share, { min: 0 })
    const glow = exp(dist.mul(-tight)).add(exp(dist.mul(-7)).mul(0.4))
    col = col.add(emotion.colorOf(i).mul(glow).mul(1.3))
  }

  return skyFinish(col.add(emotion.color.mul(AMBIENT)), {
    contrast: 1.03,
    grain: 0.02,
    headroom,
  })
}
