import { create } from 'zustand'

export interface AwakenRegistryState {
  /** Neuron ids that have already awakened once. */
  claimed: ReadonlySet<string>
  /** Mark ids as awakened (immutable update). */
  claim: (ids: readonly string[]) => void
  /** Drop all marks (e.g. on sign-out). */
  reset: () => void
}

// Data store (§3.2): the "already awakened" neuron-id set. It lives module-level, NOT in a
// component ref, so the awaken is idempotent across remounts — a feature remount (or a StrictMode
// double-mount) holding the same `new_neuron_ids` never awakens/consumes the same neuron twice.
export const useAwakenRegistryStore = create<AwakenRegistryState>()((set) => ({
  claimed: new Set<string>(),
  claim: (ids) =>
    set((state) => {
      if (ids.length === 0) return state
      const next = new Set(state.claimed)
      for (const id of ids) next.add(id)
      return { claimed: next }
    }),
  reset: () => set({ claimed: new Set<string>() }),
}))
