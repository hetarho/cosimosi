// The single authoritative star store for rendering. zustand holds StarNode[] —
// NOT coordinates: positions come from the force-sim Float32Array, subscribed by ref
// in the ui to avoid 60fps React re-renders (constitution §3, Architecture §2.7).
// addStar/replaceStar/removeStar drive the optimistic record flow (this store stays
// the authority, keyed on StarNode).
import { create } from 'zustand'
import type { StarNode } from './types'

interface MemoryState {
  stars: StarNode[]
  selectedId: string | null
  setStars: (stars: StarNode[]) => void
  select: (id: string | null) => void
  // ── optimistic record flow (StarNode-based) ──
  /** Append a new star (e.g. an optimistic temp star); index = its slot. */
  addStar: (node: StarNode) => void
  /** Swap a temp star for the server-confirmed one, keeping its slot index. */
  replaceStar: (tempId: string, node: StarNode) => void
  /** Roll back a temp star only (id starts with `temp-`); server stars are never
   *  removed (constitution §2). */
  removeStar: (tempId: string) => void
}

export const useMemoryStore = create<MemoryState>((set) => ({
  stars: [],
  selectedId: null,
  setStars: (stars) => set({ stars }),
  select: (selectedId) => set({ selectedId }),
  addStar: (node) => set((s) => ({ stars: [...s.stars, { ...node, index: s.stars.length }] })),
  replaceStar: (tempId, node) =>
    set((s) => {
      // If the temp star is gone (e.g. a GetUniverse refetch ran mid-submit), APPEND
      // the confirmed star rather than dropping it — never lose a saved memory.
      if (!s.stars.some((st) => st.id === tempId)) {
        return { stars: [...s.stars, { ...node, index: s.stars.length }] }
      }
      return { stars: s.stars.map((st) => (st.id === tempId ? { ...node, index: st.index } : st)) }
    }),
  removeStar: (tempId) =>
    set((s) => {
      if (!tempId.startsWith('temp-')) return s // never remove server stars (constitution §2)
      // Re-index so index stays == array slot (filter leaves a gap otherwise).
      const stars = s.stars
        .filter((st) => st.id !== tempId)
        .map((st, i) => (st.index === i ? st : { ...st, index: i }))
      return { stars }
    }),
}))
