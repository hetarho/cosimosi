import { create } from 'zustand'
import type { CameraMode } from '@/shared/lib/r3f'

// Widget state lives in model/ (Architecture §2.7). nebula = zoom-limited overview,
// recall = free close-up navigation; CameraRig reads `mode` to gate OrbitControls.
// focusStarId (12) is a fly-to request: the dormant page sets it before routing to
// /universe, and the canvas's FlyToController lerps the camera to that star, then
// clears it (back to null) on arrival.
interface CameraModeState {
  mode: CameraMode
  focusStarId: string | null
  setMode: (mode: CameraMode) => void
  toggle: () => void
  focusStar: (id: string | null) => void
}

export const useCameraMode = create<CameraModeState>((set) => ({
  mode: 'nebula',
  focusStarId: null,
  setMode: (mode) => set({ mode }),
  toggle: () => set((s) => ({ mode: s.mode === 'nebula' ? 'recall' : 'nebula' })),
  focusStar: (focusStarId) => set({ focusStarId }),
}))
