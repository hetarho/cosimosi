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
  /** Navigation intent for recall mode. x/y = look ROTATION (position fixed): x = turn
   *  left(-1)/right(+1) (yaw), y = look down(-1)/up(+1) (pitch). z = translate
   *  back(-1)/forward(+1) along the look direction (position moves). The HUD D-pad sets
   *  this on press/release; an in-canvas controller (NavController) applies it each frame. */
  move: { x: number; y: number; z: number }
  setMode: (mode: CameraMode) => void
  toggle: () => void
  focusStar: (id: string | null) => void
  setMove: (m: Partial<{ x: number; y: number; z: number }>) => void
}

const NO_MOVE = { x: 0, y: 0, z: 0 }

export const useCameraMode = create<CameraModeState>((set) => ({
  mode: 'nebula',
  focusStarId: null,
  move: { ...NO_MOVE },
  // Leaving recall stops any held movement so it can't get stuck (e.g. pointerup lost
  // when the mode flips out from under the D-pad).
  setMode: (mode) => set({ mode, move: { ...NO_MOVE } }),
  toggle: () =>
    set((s) => ({ mode: s.mode === 'nebula' ? 'recall' : 'nebula', move: { ...NO_MOVE } })),
  focusStar: (focusStarId) => set({ focusStarId }),
  setMove: (m) => set((s) => ({ move: { ...s.move, ...m } })),
}))
