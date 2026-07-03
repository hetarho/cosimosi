import { create } from 'zustand'

export interface LatentConsumedState {
  /** Latent-star instance indices that have awakened — no longer drawn as latent. */
  consumed: ReadonlySet<number>
  /** Mark one or more latent stars consumed by the awaken feature (immutable update). */
  consume: (indices: readonly number[]) => void
  /** Drop all marks (e.g. on sign-out, when the field is regenerated). */
  reset: () => void
}

// Data store (§3.2): the field's "consumed" marks — the one piece of latent-star state shared
// across slices. `features/awaken-neuron` writes it when a gray point awakens; the field ui
// reads it to stop drawing that point. Positions themselves are derived (generated once from
// the seed) and flow as props, not state.
export const useLatentConsumedStore = create<LatentConsumedState>()((set) => ({
  consumed: new Set<number>(),
  consume: (indices) =>
    set((state) => {
      if (indices.length === 0) return state
      const next = new Set(state.consumed)
      for (const index of indices) next.add(index)
      return { consumed: next }
    }),
  reset: () => set({ consumed: new Set<number>() }),
}))
