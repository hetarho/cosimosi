import { create } from 'zustand'

interface HoveredMemoryState {
  /** Instance slot the pointer is over, or null when it is over none of them. */
  readonly index: number | null
  setIndex: (index: number | null) => void
}

/**
 * Which `EpisodicMemory` the pointer is over — web-only presentation state (there is no hover on
 * touch, so the mobile widget has no counterpart).
 *
 * It lives in a store rather than in the composing host's `useState` because the host renders the
 * whole scene tree: every graph memo, every instance-channel projection and every layer's props are
 * computed in that one component, so a `setState` there on each pointer-move re-runs all of it to
 * change one line of text. Only the glimpse label subscribes here.
 *
 * The instance index, not the memory id, is what arrives from the pick — it resolves against the
 * same `useEpisodicMemoryStore` slots the instances were indexed by, and resolving it where it is
 * read keeps the handler a stable module-level function with no dependency on the id list.
 */
export const useHoveredMemoryStore = create<HoveredMemoryState>()((set) => ({
  index: null,
  setIndex: (index) => set((state) => (state.index === index ? state : { index })),
}))

/** Stable across renders by construction, so the scene layer's `onHover` prop never changes. */
export function setHoveredMemoryIndex(index: number | null): void {
  useHoveredMemoryStore.getState().setIndex(index)
}
