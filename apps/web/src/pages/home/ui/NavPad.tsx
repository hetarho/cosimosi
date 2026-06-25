import { useCallback, useEffect, useMemo, type PointerEvent as ReactPointerEvent } from 'react'
import { useSelector } from '@xstate/react'
import { navigationActor, selectHeadingMode, isTourCameraLocked } from '@/widgets/universe-canvas'
import { focusActor, selectIsStarFocus } from '@/entities/memory'
import { isTypingTarget } from '../lib/keyboard'

/** Maps keyboard codes → a move axis + value. WASD/Arrows so multiple keys chord
 *  naturally (forward + turn at once) — the single-pointer mouse can't. x = yaw, y =
 *  pitch (look), z = forward/back. */
const KEY_MOVE: Record<string, ['x' | 'y' | 'z', number]> = {
  KeyW: ['z', 1],
  KeyS: ['z', -1],
  KeyA: ['x', -1],
  KeyD: ['x', 1],
  ArrowUp: ['y', 1],
  ArrowDown: ['y', -1],
  ArrowLeft: ['x', -1],
  ArrowRight: ['x', 1],
}

/** Floating D-pad + keyboard for recall ("근접 항해") mode — fly through the universe.
 *  Press-and-hold (touch/mouse) or WASD/Arrow keys set the move axes in the store;
 *  NavController (inside the canvas) applies them each frame (x/y rotate the look, z
 *  thrusts forward/back). Hidden in nebula mode (there you zoom/orbit freely) and whenever a
 *  HUD surface (sidebar/explorer) is up or the HUD is hidden (change 09 — passed as `suppressed`). */
export function NavPad({ suppressed }: { suppressed: boolean }) {
  const mode = useSelector(navigationActor, selectHeadingMode)
  // D-pad 입력 → 항행 머신 SET_MOVE(부분 병합). 안정 참조(useCallback)로 아래 effect 의존성 안전.
  const setMove = useCallback(
    (m: Partial<{ x: number; y: number; z: number }>) =>
      navigationActor.send({ type: 'SET_MOVE', move: m }),
    [],
  )
  // On mobile the recall panel (bottom sheet) overlaps the bottom-center D-pad — hide the pad
  // there while a star's info is open (desktop keeps it: the pad is left, the panel is right). (focus 머신)
  const infoOpen = useSelector(focusActor, selectIsStarFocus)
  // change 08(A7): 터치 지원 기기에서는 D-pad를 기본 조작 표면으로 고정 노출하지 않는다 — 캔버스 제스처
  // (한 손가락 look·두 손가락 전후진)가 주 입력이다. 데스크톱(비터치)은 키보드 + 버튼 fallback 유지.
  // 키보드 effect는 아래에서 항상 돈다(이 분기는 *렌더*만 끈다 — 데스크톱 키보드는 보존).
  const isTouch = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
    [],
  )

  // Keyboard: track the set of held keys and recompute move from it, so chords work and
  // releasing one key of an axis correctly falls back to the other still-held one. Active
  // only in recall; clears movement on cleanup so nothing stays stuck on mode switch.
  useEffect(() => {
    if (mode !== 'recall') return
    const held = new Set<string>()
    const recompute = () => {
      let x = 0
      let y = 0
      let z = 0
      for (const code of held) {
        const [axis, v] = KEY_MOVE[code]
        if (axis === 'x') x = v
        else if (axis === 'y') y = v
        else z = v
      }
      setMove({ x, y, z })
    }
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || !(e.code in KEY_MOVE) || isTypingTarget() || isTourCameraLocked()) return // 튜토리얼 lock 중 키보드 항해 stand down(A9)
      e.preventDefault()
      held.add(e.code)
      recompute()
    }
    const onUp = (e: KeyboardEvent) => {
      if (!held.delete(e.code)) return
      recompute()
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      setMove({ x: 0, y: 0, z: 0 })
    }
  }, [mode, setMove])

  // 표면이 떠 pad가 `hidden`이 되면 누르고 있던 버튼의 pointerup이 영영 안 와 move가 멈춰버린다
  // (시트 뒤에서 우주가 계속 전진/회전) — 표면이 열리는 순간 이동을 0으로 정지시킨다.
  useEffect(() => {
    if (suppressed) setMove({ x: 0, y: 0, z: 0 })
  }, [suppressed, setMove])

  // 근접 모드가 아니거나(원거리/전환) 터치 기기면 D-pad를 렌더하지 않는다. 위 키보드 effect는 이미 돌아
  // 데스크톱 키보드 항행은 유지된다(A7). 터치는 캔버스 제스처(CloseGestureController)가 주 입력.
  if (mode !== 'recall' || isTouch) return null

  const btn =
    'flex h-11 w-11 touch-none items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white/80 backdrop-blur transition select-none hover:bg-white/20 active:bg-indigo-500/70'

  // Press → set the axis; any release/leave/cancel → stop. Covers mouse and touch.
  const hold = (axis: 'x' | 'y' | 'z', v: number) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      e.preventDefault()
      setMove({ [axis]: v })
    },
    onPointerUp: () => setMove({ [axis]: 0 }),
    onPointerLeave: () => setMove({ [axis]: 0 }),
    onPointerCancel: () => setMove({ [axis]: 0 }),
  })

  // Mobile: thrust hugs the LEFT edge, look-pad the RIGHT (justify-between) so each thumb owns
  // one side — the "전진하며 시선 회전" chord works one-handed and the center stays clear to see
  // stars (spec 31 4a). Desktop (sm+): both groups sit together at left-center, out of the HUD.
  // bottom lifts above the home-indicator (safe-area) and the compose trigger.
  const visibility = suppressed ? 'hidden' : infoOpen ? 'hidden sm:flex' : 'flex'
  return (
    <div
      className={`absolute inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-20 ${visibility} items-end justify-between sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-4 sm:-translate-y-1/2 sm:items-center sm:justify-start sm:gap-3`}
    >
      {/* forward / back thrust along the look direction (keys: W / S) */}
      <div className="flex flex-col gap-1.5">
        <button type="button" aria-label="전진" title="전진 (W)" className={`${btn} text-xs`} {...hold('z', 1)}>
          전진
        </button>
        <button type="button" aria-label="후진" title="후진 (S)" className={`${btn} text-xs`} {...hold('z', -1)}>
          후진
        </button>
      </div>
      {/* look rotation — position fixed, only the aim turns (keys: A/D yaw, ↑/↓ pitch) */}
      <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
        <button type="button" aria-label="시선 위로" title="시선 위로 (↑)" className={`${btn} col-start-2 row-start-1 text-lg`} {...hold('y', 1)}>
          ↑
        </button>
        <button type="button" aria-label="왼쪽 회전" title="왼쪽 회전 (A / ←)" className={`${btn} col-start-1 row-start-2 text-lg`} {...hold('x', -1)}>
          ←
        </button>
        <button type="button" aria-label="오른쪽 회전" title="오른쪽 회전 (D / →)" className={`${btn} col-start-3 row-start-2 text-lg`} {...hold('x', 1)}>
          →
        </button>
        <button type="button" aria-label="시선 아래로" title="시선 아래로 (↓)" className={`${btn} col-start-2 row-start-3 text-lg`} {...hold('y', -1)}>
          ↓
        </button>
      </div>
    </div>
  )
}
