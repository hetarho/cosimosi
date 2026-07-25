import type { ColorToken } from '../tokens.ts'

/**
 * The background seam — presentation state only.
 *
 * It selects a non-domain background descriptor and nothing else. It is deliberately isolated from
 * the product: it imports no domain or cache code and exposes no way to write emotion, engram
 * strength, recall state, or graph layout. Domain → visual mapping (e.g. emotion → color) belongs
 * to the rendering projection, never here. The store is platform-pure, so web and React Native
 * drive the same seam through `useBackground`.
 *
 * The colour theme is NOT here. A theme is static data (`palette.ts` → generated CSS vars +
 * `data-theme`), resolved once at the composition boundary — routing it through a runtime store
 * would give the codebase a second, drifting answer to "which theme is active".
 */

/** A non-domain background descriptor. Future universe-background params attach here, behind this same seam — never as domain state. */
export type BackgroundTone = 'cosmos' | 'plain'

export interface BackgroundState {
  tone: BackgroundTone
  /** Optional accent drawn from the token palette; presentation only. */
  accent?: ColorToken
}

const defaultState: BackgroundState = { tone: 'cosmos' }

let state: BackgroundState = defaultState
const listeners = new Set<() => void>()

function emit(): void {
  for (const notify of listeners) notify()
}

/** The current presentation state. Pairs with `useSyncExternalStore`. */
export function getBackgroundState(): BackgroundState {
  return state
}

/** Set the (non-domain) background descriptor. */
export function setBackground(background: BackgroundState): void {
  state = background
  emit()
}

/** Reset the seam to its default. */
export function resetBackground(): void {
  if (state === defaultState) return
  state = defaultState
  emit()
}

/** Subscribe to presentation-state changes; returns an unsubscribe. */
export function subscribeBackground(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
