import type { Transport } from '@connectrpc/connect'

import { decorate } from '@cosimosi/api-client'

import { ornamentSelectionRows, type OrnamentSelection } from './ornament.ts'
import type { OrnamentIDsByKind } from './ornament-preview-store.ts'

// The one durable write in the whole epic. It carries the previewed ids and nothing else — no total,
// no ownership claim, no ornament attribute — so the client cannot influence what it is charged.

export interface DecorateResult {
  /** The confirmed selection as the SERVER returned it: what the store promotes, never the request. */
  readonly selection: readonly OrnamentSelection[]
  readonly spentTwinkle: number
}

/**
 * Save a preview. `scopeKey` is the authenticated identity the save was started under; a response
 * that arrives after the user has changed resolves to null rather than committing one account's
 * choice into another's universe.
 */
export async function requestDecorate(
  transport: Transport,
  previewed: OrnamentIDsByKind,
  scopeKey: string | null,
  currentScopeKey: () => string | null,
): Promise<DecorateResult | null> {
  const response = await decorate(transport, {
    backgroundOrnamentId: previewed.BACKGROUND,
    starShaderOrnamentId: previewed.STAR_SHADER,
  })
  if (scopeKey === null || currentScopeKey() !== scopeKey) return null
  return {
    selection: ornamentSelectionRows(response.selection),
    spentTwinkle: Number(response.spentTwinkle),
  }
}
