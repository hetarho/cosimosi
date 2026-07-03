import { VALUES } from '@cosimosi/config'

// The cell-star (neuron) projection is deliberately minimal: a seedless point with a constant
// size and — by design — NO color channel and NO seed-form. A neuron carries information, not
// emotion, so emotion never reaches it [V5][I3]; its position comes from the force-sim, drawn
// at the fed coordinate and never stored or reverse-projected [I5]. The degree/connectivity
// fact stays reserved for a later subtle degree-driven size.
export interface CellStarChannels {
  /** Constant world radius; the same for every cell-star. */
  readonly size: number
}

export function cellStarChannels(): CellStarChannels {
  return { size: VALUES.rendering.cellStarPointSize }
}
