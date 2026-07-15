import { create } from 'zustand'

// The camera hand-off from a cross-route action to the universe canvas (§3.2 data): a diary
// jump reinforces stars, then navigates back to the universe and asks the camera to glide to
// one of them. The canvas widget lives on a separate route, so the request cannot be sent to
// its navigation actor directly — it is parked here (module-level, survives the route change)
// and the canvas consumes it on mount, sending FLY once the node exists in the graph, then
// clearing it. The value is a node id the universe navigation understands (an episodic star's
// id is its own node id). A one-slot request, not a queue.
export interface PendingFlyTargetState {
  readonly nodeId: string | null
  request: (nodeId: string) => void
  clear: () => void
}

export const usePendingFlyTargetStore = create<PendingFlyTargetState>()((set) => ({
  nodeId: null,
  request: (nodeId) => set({ nodeId }),
  clear: () => set({ nodeId: null }),
}))
