import type { ColorToken } from '../tokens.ts'

/**
 * The theme / background seam — presentation state only.
 *
 * This store selects visual tokens and a background style. It is deliberately
 * isolated from the product: it imports no domain or cache code and exposes no way
 * to write emotion, engram strength, recall state, or graph layout (plan/09 A7).
 * Domain → visual mapping (e.g. emotion → color) belongs to the rendering
 * projection in a later product unit, never here. The store is platform-pure, so
 * web and React Native drive the same seam through `useTheme`.
 */

export type ThemeName = 'dark' | 'light'

/** A non-domain background descriptor. Future universe-background params attach here, behind this same seam — never as domain state. */
export type BackgroundTone = 'cosmos' | 'plain'

export interface BackgroundState {
  tone: BackgroundTone
  /** Optional accent drawn from the token palette; presentation only. */
  accent?: ColorToken
}

export interface ThemeState {
  theme: ThemeName
  background: BackgroundState
}

const defaultState: ThemeState = {
  theme: 'dark',
  background: { tone: 'cosmos' },
}

let state: ThemeState = defaultState
const listeners = new Set<() => void>()

function emit(): void {
  for (const notify of listeners) notify()
}

/** The current presentation state. Pairs with `useSyncExternalStore`. */
export function getThemeState(): ThemeState {
  return state
}

/** Select the active theme. */
export function setTheme(theme: ThemeName): void {
  if (theme === state.theme) return
  state = { ...state, theme }
  emit()
}

/** Set the (non-domain) background descriptor. */
export function setBackground(background: BackgroundState): void {
  state = { ...state, background }
  emit()
}

/** Reset the seam to its defaults. */
export function resetTheme(): void {
  if (state === defaultState) return
  state = defaultState
  emit()
}

/** Subscribe to presentation-state changes; returns an unsubscribe. */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
