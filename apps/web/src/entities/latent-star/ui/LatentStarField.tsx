import { VALUES } from '@cosimosi/config'
import { LatentField } from '@cosimosi/3d-renderer'

import { LATENT_STAR_COLOR, LATENT_STAR_DRIFT } from '../config/constants.ts'
import { useLatentConsumedStore } from '../model/latent-consumed-store.ts'
import type { LatentField as LatentFieldData } from '../model/latent-field.ts'

export interface LatentStarFieldProps {
  readonly field: LatentFieldData
}

// The gray latent-neuron background layer (visual entity, §3.1/§3.4): it projects NOTHING from
// the domain mirror — it is ambiance. The field data is generated once (model/) and passed in;
// this component only binds it to the renderer's background layer through @cosimosi/3d-renderer
// (never `three`). Consumed points (awakened by features/awaken-neuron) drop out via the store.
export function LatentStarField({ field }: LatentStarFieldProps) {
  const consumed = useLatentConsumedStore((state) => state.consumed)
  return (
    <LatentField
      positions={field.positions}
      count={field.count}
      size={VALUES.rendering.latentStarSize}
      color={LATENT_STAR_COLOR}
      drift={LATENT_STAR_DRIFT}
      consumed={consumed}
    />
  )
}
