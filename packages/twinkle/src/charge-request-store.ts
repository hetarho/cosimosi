import { create } from 'zustand'

// A shortfall in a spend cost display opens the stardust charge sheet ([G3]): the
// decoupled request seam (§3.2) between the spend flows (recall / gist-view, which
// compose the cost display) and widgets/stardust (which owns the charge-sheet machine),
// so neither widget imports the other — the recall-target-store precedent. The overlay
// consumes the request and clears it; a shortfall is never a dead end.
export interface ChargeRequestState {
  requested: boolean
  request: () => void
  clear: () => void
}

export const useChargeRequestStore = create<ChargeRequestState>()((set) => ({
  requested: false,
  request: () => set({ requested: true }),
  clear: () => set({ requested: false }),
}))
