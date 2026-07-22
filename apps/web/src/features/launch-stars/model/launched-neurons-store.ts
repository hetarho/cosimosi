import { create } from 'zustand'

// The launch → awaken seam (§3.2 data, module-level so it survives the write sheet unmounting):
// LaunchStars returns `new_neuron_ids` (genuinely-created neurons); the write flow announces them
// here and the always-mounted universe canvas reads them and feeds features/awaken-neuron ([25]
// owns the animation). Idempotency is the awaken registry's job — this only carries the latest set.
export interface LaunchedNeuronsState {
  newNeuronIds: readonly string[]
  announce: (ids: readonly string[]) => void
  reset: () => void
}

export const useLaunchedNeuronsStore = create<LaunchedNeuronsState>()((set) => ({
  newNeuronIds: [],
  announce: (ids) => set({ newNeuronIds: ids }),
  reset: () => set({ newNeuronIds: [] }),
}))
