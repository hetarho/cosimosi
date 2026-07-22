import { clamp, cos, exp, float, fract, smoothstep, vec3 } from 'three/tsl'

import { sampleRamp, skyDir, skyLongitude, skySeconds, type SkyNodeArgs } from './sky-node.ts'

// Lightfall — a sphere-adapted approximation. The react-bits original raymarches falling light
// streaks through a screen-space scene (too screen-bound and heavy for a sphere). What carries over
// is its LOOK: thin vertical rays of light falling, each its own color. Mapped SEAMLESSLY — each
// streak is a MERIDIAN (a fixed longitude), its column brightness a periodic function of longitude
// (`1 - cos(Δlon)`), so there is no wrap seam; the brightness scrolls DOWNWARD along latitude. Rays
// converge at the poles like light streaming from above. Reads best across a few emotions.

const STREAKS = 6
const SPEED = 0.6
// Softer, dimmer than a literal port so the night behind reads through: a small column exponent
// spreads each ray into a soft glow band (not a hard line), and DIM pulls the whole fall down.
const COLUMN_SOFTNESS = 8 // was 14 — lower = wider, softer-edged rays
const DIM = 0.5

/** A stable meridian (longitude, −π..π) for streak `i`, spread evenly around the sphere. */
function streakLon(i: number): number {
  return (i / STREAKS) * Math.PI * 2 - Math.PI
}

export function lightfallSkyNode({ gradient, time }: SkyNodeArgs) {
  const dir = skyDir()
  const t = skySeconds(time, SPEED)
  const lon = skyLongitude()

  // a faint emotion glow so empty sky keeps depth
  let col = sampleRamp(gradient, float(0.5)).mul(0.03)

  // Taper the meridian streaks toward the TOP pole (+Y). A streak is a full pole-to-pole line, and at
  // a pole every meridian crowds into one point: at the bottom that reads as light pooling (natural,
  // kept), but at the top it was a harsh wheel-hub of converging lines. Fade the lines out up top so
  // they dissolve rather than meet at a hard point.
  const topTaper = smoothstep(float(0.95), float(0.35), dir.y)

  for (let i = 0; i < STREAKS; i++) {
    // periodic angular distance to the streak's meridian → a seamless SOFT column (not a hard line)
    const column = exp(
      float(1)
        .sub(cos(lon.sub(streakLon(i))))
        .mul(-COLUMN_SOFTNESS),
    )
    // brightness scrolling downward along latitude
    const fall = fract(
      dir.y
        .mul(1.5)
        .add(t.mul(0.4))
        .add(i * 0.37),
    )
    const glow = fall.mul(fall).mul(0.9).add(0.15)
    col = col.add(
      sampleRamp(gradient, i / (STREAKS - 1)).mul(column.mul(glow).mul(topTaper).mul(DIM)),
    )
  }

  // The luminous source the light falls FROM: a soft halo capping the top pole where the streaks
  // dissolved, so the top reads as a glowing origin instead of a hard line-hub.
  const topGlow = smoothstep(float(0.55), float(1), dir.y)
  col = col.add(sampleRamp(gradient, float(0.5)).mul(topGlow.mul(topGlow).mul(0.16)))

  return clamp(col, float(0), vec3(1))
}
