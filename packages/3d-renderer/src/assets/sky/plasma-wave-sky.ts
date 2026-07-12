import {
  abs,
  atan,
  clamp,
  cos,
  cross,
  dot,
  exp,
  float,
  fract,
  normalize,
  sin,
  vec3,
} from 'three/tsl'

import { sampleRamp, skyDir, skySeconds, type SkyNodeArgs } from './sky-node.ts'

// PlasmaWave — an ADAPTED sky: react-bits' PlasmaWave is a screen-space SDF raymarch of two neon
// tubes running along one axis, which on a sphere sat all on one side and only ever showed its two
// fixed tube colours. Reworked into a genuinely volumetric neon tangle that wraps the whole scene:
// several tubes, each a small circle about its OWN tumbling 3D axis, sweep and wobble across the
// sphere so they weave here and there and cross one another (the bright plasma knots), and each
// tube is coloured CONTINUOUSLY from the emotion ramp along its length — so the whole palette rides
// the sky, richer the more emotions are present. Seamless (a pure function of the surface direction:
// the azimuth enters only through sin/cos and fract, the latitude through a dot).

const PI = Math.PI
const TUBES = 5

export function plasmaWaveSkyNode({ gradient, time }: SkyNodeArgs) {
  const u = skyDir()
  const t = skySeconds(time, 1)

  // faint emotion base so empty sky keeps depth
  let col = sampleRamp(gradient, float(0.5)).mul(0.04)

  for (let i = 0; i < TUBES; i++) {
    // A tumbling 3D axis — all three components animate at different rates, so the tube's plane keeps
    // reorienting and the tangle reads as volumetric rather than pinned to one side.
    const a = t.mul(0.12 + i * 0.017)
    const axis = normalize(
      vec3(
        sin(a.add(i * 1.7)),
        cos(a.mul(0.8).add(i * 2.3)).mul(0.9),
        sin(a.mul(1.3).add(i * 0.9)),
      ),
    )
    // A tangent frame about the axis. The tiny offset before normalize guards the measure-zero instant
    // the axis aligns with `ref` (cross → 0); where that happens the tube's brightness is ~0 anyway.
    const ref = vec3(0.31, 0.83, 0.46)
    const b1 = normalize(cross(axis, ref).add(vec3(1e-4, 0, 0)))
    const b2 = cross(axis, b1)

    // The tube is the small circle where the "latitude" about the axis matches a drifting target, so
    // the ring sweeps across the sphere over time (never quite to the poles, where it would vanish).
    const lat = dot(u, axis) // −1..1
    const target = sin(t.mul(0.5).add(i * 1.1)).mul(0.55)
    // Azimuth around the axis (0..2π along the ring): wobbles the ring into an organic coil and drives
    // the continuous colour. It enters only via sin/cos and fract, so its ±π branch cut leaves no seam.
    const az = atan(dot(u, b2), dot(u, b1))
    const wob = sin(az.mul(3).add(t.mul(1.1).add(i * 2.0)))
      .mul(0.06)
      .add(sin(az.mul(2).sub(t.mul(0.7))).mul(0.04))
    const dist = abs(lat.sub(target).add(wob))
    // A thin bright neon core plus a soft halo; where tubes cross, the additive sum knots up brighter.
    const glow = exp(dist.mul(-42)).add(exp(dist.mul(-7)).mul(0.4))
    // colour continuously from the palette along the tube (not two fixed hues)
    const hue = fract(
      az
        .mul(1 / (2 * PI))
        .add(0.5)
        .add(i * 0.13)
        .add(t.mul(0.02)),
    )
    col = col.add(sampleRamp(gradient, hue).mul(glow).mul(1.3))
  }

  return clamp(col, float(0), vec3(1))
}
