import { clamp, cos, exp, float, fract, vec3 } from 'three/tsl'

import { sampleRamp, skyDir, skyLongitude, skySeconds, type SkyNodeArgs } from './sky-node.ts'

// Lightfall — a sphere-adapted approximation. The react-bits original raymarches falling light
// streaks through a screen-space scene (too screen-bound and heavy for a sphere). What carries over
// is its LOOK: thin vertical rays of light falling, each its own color. Mapped SEAMLESSLY — each
// streak is a MERIDIAN (a fixed longitude), its column brightness a periodic function of longitude
// (`1 - cos(Δlon)`), so there is no wrap seam; the brightness scrolls DOWNWARD along latitude. Rays
// converge at the poles like light streaming from above. Reads best across a few emotions.

const STREAKS = 6
const SPEED = 0.6

/** A stable meridian (longitude, −π..π) for streak `i`, spread evenly around the sphere. */
function streakLon(i: number): number {
  return (i / STREAKS) * Math.PI * 2 - Math.PI
}

export function lightfallSkyNode({ gradient, time }: SkyNodeArgs) {
  const dir = skyDir()
  const t = skySeconds(time, SPEED)
  const lon = skyLongitude()

  // a faint emotion glow so empty sky keeps depth
  let col = sampleRamp(gradient, float(0.5)).mul(0.05)

  for (let i = 0; i < STREAKS; i++) {
    // periodic angular distance to the streak's meridian → a seamless thin column
    const column = exp(
      float(1)
        .sub(cos(lon.sub(streakLon(i))))
        .mul(-14),
    )
    // brightness scrolling downward along latitude
    const fall = fract(
      dir.y
        .mul(1.5)
        .add(t.mul(0.4))
        .add(i * 0.37),
    )
    const glow = fall.mul(fall).mul(1.6).add(0.25)
    col = col.add(sampleRamp(gradient, i / (STREAKS - 1)).mul(column.mul(glow)))
  }

  return clamp(col, float(0), vec3(1))
}
