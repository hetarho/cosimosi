import { create } from 'zustand'

// The FE mirror of the one universe clock ([T6]): day-granular ISO date strings end to end
// (matching UniverseSnapshot.universeTime / EpisodicMemory.createdUniverseTime), null = an empty
// universe whose clock is not yet born ([T5]). Data store (§3.2), populated from the GetUniverse
// read by entities/universe-clock — never advanced client-side; the server clock is authoritative.
export interface UniverseClock {
  readonly currentUniverseTime: string | null
}

export interface UniverseClockState extends UniverseClock {
  setCurrent: (universeTime: string) => void
  clear: () => void
}

export const useUniverseClockStore = create<UniverseClockState>()((set) => ({
  currentUniverseTime: null,
  setCurrent: (universeTime) => set({ currentUniverseTime: universeTime }),
  clear: () => set({ currentUniverseTime: null }),
}))
