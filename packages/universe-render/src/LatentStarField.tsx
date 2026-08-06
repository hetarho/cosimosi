import { VALUES } from '@cosimosi/config'
import { LatentField } from '@cosimosi/3d-renderer'

import { LATENT_STAR_COLOR, LATENT_STAR_DRIFT } from './latent-constants.ts'
import { useLatentConsumedStore, type LatentField as LatentFieldData } from '@cosimosi/universe'

export interface LatentStarFieldProps {
  readonly field: LatentFieldData
  /** Freezes the dust's drift and per-mote breath to a static frame. */
  readonly reducedMotion?: boolean
  /**
   * Multiplies the mote radius. The universe wears 1; a design bench reads the dust at arm's length,
   * where a mote tuned for its own distance falls under a pixel and the look cannot be scored.
   */
  readonly sizeScale?: number
  /**
   * Which motes are already awake. Omit in the universe — the live store owns that. A bench passes
   * its own set, because consumption indexes into the field it happened on: the universe's indices
   * would blank arbitrary motes of a different field.
   */
  readonly consumed?: ReadonlySet<number> | null
  /**
   * Sphere segments per mote. Omitted, the field takes the web tessellation — the mobile shell
   * passes `rendering.latent_star_segments_mobile` alongside its own instance count (§3.5).
   */
  readonly segments?: number
}

// The gray latent-neuron background layer (visual entity, §3.1/§3.4): it projects NOTHING from
// the domain mirror — it is ambiance. The field data is generated once (model/) and passed in;
// this component only binds it to the renderer's background layer through @cosimosi/3d-renderer
// (never `three`). Consumed points (awakened by features/awaken-neuron) drop out via the store.
export function LatentStarField({
  field,
  reducedMotion = false,
  sizeScale = 1,
  consumed,
  segments,
}: LatentStarFieldProps) {
  const liveConsumed = useLatentConsumedStore((state) => state.consumed)
  return (
    <LatentField
      positions={field.positions}
      count={field.count}
      size={VALUES.rendering.latentStarSize * sizeScale}
      color={LATENT_STAR_COLOR}
      drift={LATENT_STAR_DRIFT}
      consumed={consumed === undefined ? liveConsumed : consumed}
      reducedMotion={reducedMotion}
      segments={segments}
    />
  )
}
