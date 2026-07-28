import { cos, exp, float, fract, smoothstep } from 'three/tsl'

import { skyDir, skyTangentFrame } from './sky-domain.ts'
import { emotionAnchors, emotionField } from './sky-emotion.ts'
import { markSize, skyFinish } from './sky-finish.ts'
import { skyLongitude, skySeconds, vec3Acc, type SkyNodeArgs } from './sky-node.ts'

// Lightfall — thin rays of light falling, each carrying a feeling.
//
// domain   meridians (a periodic function of longitude, so there is no wrap line), scrolling downward
//          along latitude
// field    an exponential column profile, so a ray is a soft glow band rather than a hard line
// emotion  one ray per feeling, at that feeling's own meridian, in that feeling's own colour, its
//          column WIDTH from that feeling's weight
// finish   under the headroom
//
// It carries one feeling by design: the light falls FROM somewhere, and one source reads as light while
// several read as a fence. Handed more, each gets its own meridian and its own width.
//
// A ray belongs to a feeling, not to an index: its meridian, its colour and its width all come from the
// emotion field. Spacing rays evenly around the sphere regardless of the feelings, or colouring them at
// `i / (STREAKS − 1)` — evenly along the ramp rather than at the bands — makes the count decide the look
// and leaves a ray carrying whichever hue its index landed on.

const SPEED = 0.6
/** Column tightness: lower spreads a ray into a wider, softer band. */
const COLUMN_MIN = 6
const COLUMN_MAX = 13
const DIM = 0.5
/** How much of the bare sky the territory blend fills behind the rays. */
const AMBIENT = 0.03

export function lightfallSkyNode({ gradient, time, count, weights, headroom }: SkyNodeArgs) {
  const dir = skyDir()
  const t = skySeconds(time, SPEED)
  const lon = skyLongitude()
  const emotion = emotionField({ gradient, count, weights, dir, sharpness: 1.5 })
  const anchors = emotionAnchors(Math.max(1, count))

  // Fade the rays out toward the top pole. A meridian is a full pole-to-pole line and every meridian
  // crowds into one point up there: at the bottom that reads as light pooling, which is kept, but at
  // the top it read as a wheel hub. The rays dissolve instead, and a halo caps where they went.
  const topTaper = smoothstep(float(0.95), float(0.35), dir.y)

  let col = vec3Acc()
  for (let i = 0; i < anchors.length; i++) {
    const share = emotion.weights[i] ?? 1 / anchors.length
    // The feeling's own meridian, taken from its anchor's tangent frame so rays and territories agree.
    const tangent = skyTangentFrame(anchors[i]).tangent
    const meridian = Math.atan2(tangent[2], tangent[0])
    // Weight buys WIDTH: a strong feeling falls as a broad column, a faint one as a thread.
    const tightness = COLUMN_MAX - (COLUMN_MAX - COLUMN_MIN) * markSize(share, { min: 0 })
    const column = exp(
      float(1)
        .sub(cos(lon.sub(meridian)))
        .mul(-tightness),
    )
    const fall = fract(
      dir.y
        .mul(1.5)
        .add(t.mul(0.4))
        .add(i * 0.37),
    )
    const glow = fall.mul(fall).mul(0.9).add(0.15)
    col = col.add(emotion.colorOf(i).mul(column.mul(glow).mul(topTaper).mul(DIM)))
  }

  // The luminous origin the light falls from, so the top reads as a source rather than a line hub.
  const topGlow = smoothstep(float(0.55), float(1), dir.y)
  const lit = col
    .add(emotion.color.mul(topGlow.mul(topGlow).mul(0.16)))
    .add(emotion.color.mul(AMBIENT))
  return skyFinish(lit, { contrast: 1.03, grain: 0.02, headroom })
}
