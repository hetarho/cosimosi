import { create } from 'zustand'

// A shortfall in a spend cost display opens the earn guide ([G3]): the decoupled request seam (§3.2)
// between the spend flows (recall / gist-view, which compose the cost display) and widgets/stardust
// (which hosts the guide), so neither widget imports the other — the recall-target-store precedent.
// The overlay consumes the request and clears it; a shortfall is never a dead end, and since v2 has no
// purchase path the far side of it is an explanation rather than a transaction.
export interface EarnRequestState {
  requested: boolean
  request: () => void
  clear: () => void
}

export const useEarnRequestStore = create<EarnRequestState>()((set) => ({
  requested: false,
  request: () => set({ requested: true }),
  clear: () => set({ requested: false }),
}))
