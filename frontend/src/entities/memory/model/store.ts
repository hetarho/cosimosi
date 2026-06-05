// The single authoritative star store for rendering (spec 08). zustand holds
// StarNode[] — NOT coordinates: positions come from the force-sim Float32Array,
// subscribed by ref in the ui to avoid 60fps React re-renders (constitution §3,
// Architecture §2.7). Spec 10 extends this with addStar/replaceStar/removeStar for
// the optimistic record flow (this store stays the authority, keyed on StarNode).
import { create } from 'zustand'
import type { StarNode } from './types'

interface MemoryState {
  stars: StarNode[]
  selectedId: string | null
  setStars: (stars: StarNode[]) => void
  select: (id: string | null) => void
}

export const useMemoryStore = create<MemoryState>((set) => ({
  stars: [],
  selectedId: null,
  setStars: (stars) => set({ stars }),
  select: (selectedId) => set({ selectedId }),
}))
