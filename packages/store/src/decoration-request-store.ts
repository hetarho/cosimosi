import { create } from 'zustand'

// The open channel between the HUD affordance and the decoration panel (§3.2): a widget may not
// import a widget, so the page's affordance records the request here and the panel subscribes. A
// one-slot signal, not a queue — asking twice is asking once.
export interface DecorationRequestState {
  readonly requested: boolean
  request: () => void
  clear: () => void
}

export const useDecorationRequestStore = create<DecorationRequestState>()((set) => ({
  requested: false,
  request: () => set({ requested: true }),
  clear: () => set({ requested: false }),
}))
