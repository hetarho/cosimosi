// Sky background: the void BEHIND the enclosing emotion sky-sphere. The sphere itself is a real
// body (the SkySphere layer) that the canvas host mounts when a skin declares this type — the
// background node only clears to the bare night the sphere's translucent effects blend over, so
// the palette reads against the same base the gradient ramp fades into. The `effect` prop rides
// on the spec for the host to hand to the SkySphere; the node itself doesn't use it.
import { color } from 'three/tsl'

import type { SkyEffectKey } from '../sky/sky-effects.ts'

export interface SkyProps {
  /** Which emotion-sky effect the sphere wears (consumed by the host, not this node). */
  readonly effect: SkyEffectKey
  /** The bare-night void behind the sphere (hex) — matches the emotion ramp's night base. */
  readonly night: number
}

export function skyBackgroundNode(props: SkyProps) {
  return color(props.night)
}
