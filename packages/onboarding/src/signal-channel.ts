import { create } from 'zustand'

import type { OnboardingSignal } from './anchors.ts'

export interface OnboardingSignalReport {
  readonly signal: OnboardingSignal
  /**
   * Strictly increasing across the whole session. Two identical signals in a row are then two
   * distinguishable channel writes, so a subscriber comparing values rather than references still
   * sees the second one.
   */
  readonly nonce: number
}

export interface OnboardingSignalState {
  /** A one-slot channel, not a queue: the run host consumes and clears. */
  readonly pending: OnboardingSignalReport | null
  report: (signal: OnboardingSignal) => void
  clear: () => void
}

let nonce = 0

export const useOnboardingSignalStore = create<OnboardingSignalState>()((set) => ({
  pending: null,
  report: (signal) => set({ pending: { signal, nonce: ++nonce } }),
  clear: () => set({ pending: null }),
}))

/**
 * How the shipped writing flow tells the world what it just did, without learning that a tour exists.
 *
 * **The signature is the guard**: it takes one id and returns nothing, so a reporting site cannot
 * learn whether a run is active, cannot read a step index, and cannot branch on either. With no run
 * active the write is inert — the host consumes it and the engine, having no matching step, treats it
 * as "not progress" — and the engine's index echo makes a stale or duplicated report a no-op.
 */
export function reportSequenceSignal(signal: OnboardingSignal): void {
  useOnboardingSignalStore.getState().report(signal)
}
