import { create } from 'zustand'

// One camera request survives a route change. An archive arrival also selects its memory so the
// detail panel can expose the rest of that diary's members. The scene consumes the request only
// once its node exists; coordinates and renderer types never enter this channel.
export interface PendingFlyTargetState {
  readonly nodeId: string | null
  readonly select: boolean
  request: (nodeId: string, select?: boolean) => void
  clear: () => void
}

export const usePendingFlyTargetStore = create<PendingFlyTargetState>()((set) => ({
  nodeId: null,
  select: false,
  request: (nodeId, select = false) => set({ nodeId, select }),
  clear: () => set({ nodeId: null, select: false }),
}))
