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
  /** Bumped ONLY by a user mode TOGGLE (the camera button), so the canvas can snap the
   *  camera to that mode's signature pose: recall → dead centre of the universe; nebula →
   *  pulled back outside the star shell for an overview. setMode (used by the fly-to path)
   *  does NOT bump it, so flying to a star is never hijacked by a recentre. */
  resetNonce: number
  /** True while a mode-transition flight is in progress (ModeTransitionController). The
   *  orbit-distance + ship-boundary clamps are relaxed during it so the camera can fly
   *  through the otherwise-forbidden zone; restored on arrival. */
  transitioning: boolean
  /** True while a bottom sheet (compose form / recall panel) covers the lower screen.
   *  On mobile the canvas shifts its view offset so the stars sit in the upper third
   *  instead of hiding behind the sheet (ViewOffsetController). Set by the page HUD. */
  sheetOpen: boolean
  setMode: (mode: CameraMode) => void
  toggle: () => void
  focusStar: (id: string | null) => void
  setMove: (m: Partial<{ x: number; y: number; z: number }>) => void
  setTransitioning: (transitioning: boolean) => void
  setSheetOpen: (sheetOpen: boolean) => void
}

const NO_MOVE = { x: 0, y: 0, z: 0 }

export const useCameraMode = create<CameraModeState>((set) => ({
  mode: 'nebula',
  focusStarId: null,
  move: { ...NO_MOVE },
  resetNonce: 0,
  transitioning: false,
  sheetOpen: false,
  // Leaving recall stops any held movement so it can't get stuck (e.g. pointerup lost
  // when the mode flips out from under the D-pad).
  setMode: (mode) => set({ mode, move: { ...NO_MOVE } }),
  toggle: () =>
    set((s) => ({
      mode: s.mode === 'nebula' ? 'recall' : 'nebula',
      move: { ...NO_MOVE },
      resetNonce: s.resetNonce + 1,
    })),
  focusStar: (focusStarId) => set({ focusStarId }),
  setMove: (m) => set((s) => ({ move: { ...s.move, ...m } })),
  setTransitioning: (transitioning) => set({ transitioning }),
  setSheetOpen: (sheetOpen) => set({ sheetOpen }),
}))
