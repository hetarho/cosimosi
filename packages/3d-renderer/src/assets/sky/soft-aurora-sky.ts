import { abs, clamp, exp, float, max, vec3 } from 'three/tsl'

import { fbm01, gnoise } from '../../shader-art/noise'
import { sampleRamp, skyDir, skySeconds, type SkyNodeArgs } from './sky-node.ts'

// SoftAurora — react-bits' SoftAurora (layered noise ribbons flared by an exponential ridge) mapped
// SEAMLESSLY onto the sphere: the ribbons hang by LATITUDE (the surface direction's y), which is
// continuous around the sphere, and the warp + color come from 3D noise on the surface direction —
// so no wrap seam, no pole pinch. Each curtain draws its color from the emotion ramp; the count sets
// how many bands of feeling the aurora sweeps through.

const SCALE = 1.6
const SPREAD = 1.1
const BRIGHTNESS = 1.05

/** One aurora ribbon: a latitude band warped by 3D noise and flared by an exponential ridge. */
function ribbon(dir: ReturnType<typeof skyDir>, t: unknown, center: number) {
  const n = gnoise(dir.mul(SCALE).add(vec3(0, 0, t as never)))
  const band = dir.y.mul(2.2).sub(center)
  return max(
    exp(
      float(1)
        .sub(abs(n.add(band)).mul(1.1))
        .mul(SPREAD),
    ),
    float(0),
  ).mul(0.3)
}

export function softAuroraSkyNode({ gradient, time }: SkyNodeArgs) {
  const dir = skyDir()
  const t = skySeconds(time, 0.24)

  // two curtains at different heights, each drawing a drifting slice of the palette from 3D noise
  const c1 = sampleRamp(gradient, fbm01(dir.mul(0.8).add(vec3(0, 0, t.mul(0.3)))))
  const c2 = sampleRamp(gradient, fbm01(dir.mul(0.8).add(vec3(4.1, 1.7, t.mul(0.2)))))
  const col = c1.mul(ribbon(dir, t, 0.35)).add(c2.mul(ribbon(dir, t.add(1.7), -0.15)))

  return clamp(col.mul(BRIGHTNESS), float(0), float(1))
}
