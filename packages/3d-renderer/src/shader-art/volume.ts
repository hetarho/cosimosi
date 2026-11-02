import { float, vec3 } from 'three/tsl'

import { asFloatNode, asVec3Node } from '../tsl.ts'
import { fbm01, gnoise } from './noise.ts'

/** A continuous gas density in world space: broad billows with finer, folded filaments. */
export function cloudVolumeDensity(place: unknown) {
  const p = asVec3Node(place)
  const broad = fbm01(p.mul(0.78), { octaves: 2 })
  const folded = fbm01(p.mul(2.1).add(vec3(broad.mul(1.3), broad.mul(0.7), broad.mul(1.7))), {
    octaves: 2,
  })
  const billow = broad.smoothstep(float(0.28), float(0.72))
  const filament = float(1).sub(folded.mul(2).sub(1).abs()).pow(5)
  return billow.mul(0.72).add(filament.mul(0.28))
}

/** Five bounded depth samples, shared by sky and local gas. The samples integrate occlusion and
 * directional scattering, rather than turning a flat glow's opacity down. No colour is authored here. */
export function volumeScattering(origin: unknown, direction: unknown, extent: unknown) {
  const start = asVec3Node(origin)
  const ray = asVec3Node(direction)
  const span = asFloatNode(extent)
  let radiance = asFloatNode(0).add(0)
  let transmission = asFloatNode(1).add(0)
  for (let step = 0; step < 5; step++) {
    const place = start.add(ray.mul(span.mul((step + 0.5) / 5)))
    const density = cloudVolumeDensity(place)
    const facingLight = gnoise(place.add(vec3(-0.65, 0.4, 0.8)))
      .mul(0.5)
      .add(0.5)
    const light = density.sub(facingLight).max(0).mul(2.4).add(0.72)
    const extinction = density.mul(0.24)
    radiance = radiance.add(transmission.mul(extinction).mul(light))
    transmission = transmission.mul(float(1).sub(extinction))
  }
  return radiance.mul(2.4)
}
