import { create } from 'zustand'
import type { CameraMode } from '@/shared/lib/r3f'

// Widget state lives in model/ (Architecture §2.7). nebula = zoom-limited overview,
// recall = free close-up navigation; CameraRig reads `mode` to gate OrbitControls.
interface CameraModeState {
  mode: CameraMode
  setMode: (mode: CameraMode) => void
  toggle: () => void
}

export const useCameraMode = create<CameraModeState>((set) => ({
  mode: 'nebula',
  setMode: (mode) => set({ mode }),
  toggle: () => set((s) => ({ mode: s.mode === 'nebula' ? 'recall' : 'nebula' })),
}))
