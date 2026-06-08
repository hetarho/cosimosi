import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { UniverseCanvas, UniverseGrain, useCameraMode } from '@/widgets/universe-canvas'
import { MemoryForm } from '@/features/record-memory'
import { MemoryPanel, useRecallStore } from '@/features/recall'
import { getUniverse, useMemoryStore } from '@/entities/memory'

// The universe shell (spec 10, extended by 11): full-screen <UniverseCanvas/> (renders
// the stars from the memory store) + 2D HUD overlays (compose form, camera toggle,
// recall panel) OUTSIDE the R3F scene (Architecture §3.1). On mount we load the
// universe once via GetUniverse.
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

/** True when the user is typing in a field — keyboard nav must not hijack those keys. */
function isTypingTarget() {
  const el = document.activeElement as HTMLElement | null
  return (
    !!el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  )
}

/** Floating D-pad + keyboard for recall ("근접 항해") mode — fly through the universe.
 *  Press-and-hold (touch/mouse) or WASD/Arrow keys set the move axes in the store;
 *  NavController (inside the canvas) applies them each frame (x/y rotate the look, z
 *  thrusts forward/back). Hidden in nebula mode (there you zoom/orbit freely). */
function NavPad() {
  const mode = useCameraMode((s) => s.mode)
  const setMove = useCameraMode((s) => s.setMove)

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
      if (e.repeat || !(e.code in KEY_MOVE) || isTypingTarget()) return
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

  if (mode !== 'recall') return null

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

  // Mobile: bottom-center, lifted above the compose trigger (bottom-4). Desktop (sm+):
  // left-center, out of the way of the top/bottom HUD.
  return (
    <div className="absolute bottom-24 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 sm:top-1/2 sm:bottom-auto sm:left-4 sm:translate-x-0 sm:-translate-y-1/2">
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

export function HomePage() {
  const mode = useCameraMode((s) => s.mode)
  const toggle = useCameraMode((s) => s.toggle)
  const starCount = useMemoryStore((s) => s.stars.length)
  const loadedRef = useRef(false)
  // Mobile-only: the compose form is hidden by default (keep the universe unobstructed)
  // and expands into a full-width bottom sheet. On desktop (sm+) it stays a persistent
  // top-left panel, so this flag is ignored there.
  const [composeOpen, setComposeOpen] = useState(false)

  useEffect(() => {
    if (loadedRef.current) return // guard StrictMode double-invoke / re-renders (2.1)
    loadedRef.current = true
    void getUniverse().catch((e) => {
      console.error('[universe] GetUniverse failed', e)
    })
  }, [])

  // Flush any pending co-recall reinforcement when the tab is hidden/closed (1.3). The
  // model store is DOM-free (1.9); the window listeners live here in the page layer.
  // visibilitychange(hidden) fires more reliably than beforeunload (esp. on mobile),
  // and the transport uses keepalive so the request survives teardown.
  useEffect(() => {
    const flush = () => {
      void useRecallStore.getState().flush()
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])

  return (
    <div className="fixed inset-0" data-lenis-prevent>
      <UniverseCanvas />
      {/* Film grain over the canvas (DOM overlay, not the bloom pipeline) — sits above the
          canvas but before the HUD, and is pointer-events:none, so HUD stays interactive. */}
      <UniverseGrain />

      {/* HUD: 2D DOM overlays outside the canvas */}

      {/* Compose — desktop (sm+): persistent top-left panel. */}
      <div className="absolute top-4 left-4 z-20 hidden w-80 sm:block">
        <MemoryForm />
      </div>

      {/* Compose — mobile (<sm): hidden by default; a full-width trigger expands it into
          a full-width bottom sheet so it doesn't cover the universe while exploring. */}
      <div className="sm:hidden">
        {composeOpen ? (
          <div className="absolute inset-x-2 bottom-2 z-30">
            <button
              type="button"
              onClick={() => setComposeOpen(false)}
              aria-label="닫기"
              className="absolute top-3 right-3 z-10 rounded-md px-2 text-white/50 transition hover:text-white/90"
            >
              ✕
            </button>
            <MemoryForm />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="absolute inset-x-4 bottom-4 z-20 rounded-xl border border-white/10 bg-indigo-500/80 px-4 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-indigo-500"
          >
            ✦ 새 일기 — 별 띄우기
          </button>
        )}
      </div>
      <NavPad />

      <div className="absolute right-4 bottom-4 z-10">
        <MemoryPanel />
      </div>
      {/* top-16: clear the global 로그아웃 pill (SessionGate, top-4 right-4) so these
          page controls don't sit hidden underneath it. */}
      <div className="absolute top-16 right-4 z-10 flex gap-2">
        <Link
          to="/dormant"
          className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/80 backdrop-blur transition hover:bg-white/20"
        >
          잠든 별
        </Link>
        <button
          type="button"
          onClick={toggle}
          className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/80 backdrop-blur transition hover:bg-white/20"
        >
          카메라: {mode === 'nebula' ? '성운(전체 조망)' : '회상(근접 항해)'}
        </button>
      </div>

      {starCount === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-12 z-10 text-center">
          <p className="text-sm text-white/55">
            아직 별이 없어요. 첫 일기를 적어 첫 별을 띄워보세요.
          </p>
        </div>
      )}
    </div>
  )
}
