import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'
import * as Sentry from '@sentry/react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { errorMessage, reportUniverseData } from '@/shared/lib'
import { RendererUnavailableError } from '@/shared/lib/r3f'
import { primaryButtonCls } from '@/shared/ui'
import { UniverseCanvas, UniverseGrain, useCameraMode } from '@/widgets/universe-canvas'
import { MemoryForm } from '@/features/record-memory'
import { MemoryPanel, useRecallStore } from '@/features/recall'
import { AppearanceSwitcher } from '@/features/switch-appearance'
import { applyUniverse, universeQueryOptions, useMemoryStore } from '@/entities/memory'

// The universe shell (spec 10, extended by 11): full-screen <UniverseCanvas/> (renders
// the stars from the memory store) + 2D HUD overlays (compose form, camera toggle,
// recall panel) OUTSIDE the R3F scene (Architecture §3.1). The universe loads via the
// GetUniverse query (16) — loading/error/retry UI here, merge-sync into the stores.
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

/** 우주 영역 풀오버레이 에러 카드 chrome — 쿼리 실패(16)와 캔버스 크래시(17)가 공유. */
function UniverseErrorCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center">
      <div className="flex w-80 max-w-[85vw] flex-col gap-3 rounded-xl border border-white/10 bg-black/60 p-5 text-center backdrop-blur">
        {children}
      </div>
    </div>
  )
}

/** 캔버스 전용 폴백(17, 2.1/2.2) — Sentry FallbackRender 시그니처의 모듈 레벨 컴포넌트.
 *  (인라인 화살표를 fallback으로 주면 Sentry가 함수를 element type으로 써서 HomePage
 *  리렌더마다 폴백이 리마운트된다 — 재시도 버튼 포커스 유실.) 원인 구분: 렌더러 자체가
 *  불가한 기기(WebGPU·WebGL2 모두 실패 — 재시도 무의미, 안내만)와 일반 렌더 크래시
 *  (다시 시도 = 캔버스 리마운트). 어느 쪽이든 HUD(작성 폼)는 바운더리 밖이라 살아 있다. */
function CanvasErrorFallback({ error, resetError }: { error: unknown; resetError: () => void }) {
  const unavailable = error instanceof RendererUnavailableError
  return (
    <UniverseErrorCard>
      {unavailable ? (
        <>
          <p className="text-sm text-white/85">이 브라우저/기기에서는 우주를 그릴 수 없어요.</p>
          <p className="text-xs text-white/45">
            최신 Chrome·Edge·Safari로 열거나, 그래픽 가속이 켜져 있는지 확인해 주세요. 일기
            작성은 그대로 할 수 있어요 — 별은 안전하게 기록돼요.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-white/85">우주를 불러오지 못했어요.</p>
          <p className="text-xs break-all text-white/40">{errorMessage(error)}</p>
          <button type="button" onClick={resetError} className={primaryButtonCls}>
            다시 시도
          </button>
        </>
      )}
    </UniverseErrorCard>
  )
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
  // On mobile the recall panel (bottom sheet) overlaps the bottom-center D-pad — hide the pad
  // there while a star's info is open (desktop keeps it: the pad is left, the panel is right).
  const infoOpen = useMemoryStore((s) => s.selectedId != null)

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
    <div
      className={`absolute bottom-24 left-1/2 z-20 ${infoOpen ? 'hidden sm:flex' : 'flex'} -translate-x-1/2 items-center gap-3 sm:top-1/2 sm:bottom-auto sm:left-4 sm:translate-x-0 sm:-translate-y-1/2`}
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

export function HomePage() {
  const mode = useCameraMode((s) => s.mode)
  const toggle = useCameraMode((s) => s.toggle)
  const starCount = useMemoryStore((s) => s.stars.length)
  // Mobile-only: the compose form is hidden by default (keep the universe unobstructed)
  // and expands into a full-width bottom sheet. On desktop (sm+) it stays a persistent
  // top-left panel, so this flag is ignored there.
  const [composeOpen, setComposeOpen] = useState(false)

  // GetUniverse as a declarative query (16): staleTime 5m·gcTime 30m·focus refetch는
  // 옵션이 소유. 응답은 전체 교체가 아니라 병합으로 스토어에 반영(1.4) — 제출 중 temp 별,
  // 기존 별 슬롯/좌표, 로컬이 앞선 타임스탬프를 깨지 않는다.
  const universe = useQuery(universeQueryOptions())
  const { data: universeData } = universe
  useEffect(() => {
    if (universeData) {
      applyUniverse(universeData)
      // universe_loaded의 데이터 쪽(18, 3.3) — 렌더러 쪽(캔버스 onCreated)과 합류해
      // 1회만 전송된다. 본문 없는 카운트만.
      reportUniverseData({
        star_count: universeData.stars.length,
        synapse_count: universeData.synapses.length,
      })
    }
  }, [universeData])

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
    <div className="universe-page fixed inset-0" data-lenis-prevent>
      {/* 바운더리는 Canvas에만(17): R3F 트리의 throw·렌더러 init 실패(위젯이 state→render
          throw로 표면화)가 흰 화면이 되지 않게 폴백을 그리되, 형제인 HUD(작성 폼·패널)는
          살린다. resetError → 캔버스 리마운트. */}
      <Sentry.ErrorBoundary fallback={CanvasErrorFallback}>
        <UniverseCanvas />
      </Sentry.ErrorBoundary>
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

      {/* Star info — mobile: above the bottom compose button and height-capped so a long
          memory scrolls instead of reaching the top controls. Desktop: bottom-right (compose
          is a top-left panel, so no overlap). */}
      <div className="absolute right-4 bottom-20 z-10 max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain sm:bottom-4 sm:max-h-none sm:overflow-visible">
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

      {/* 테마·오브제 스위처 — 우상단 컨트롤 스택 아래(우하단은 MemoryPanel, 하단은 compose/NavPad와 겹침). */}
      <AppearanceSwitcher className="top-28 right-4" />

      {/* 우주 로딩 — 응답 전의 빈 캔버스를 "별이 없다"로 오인시키지 않는다(1.1). */}
      {universe.isPending && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p className="animate-pulse rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white/70 backdrop-blur">
            우주를 불러오는 중…
          </p>
        </div>
      )}

      {/* 첫 로드 실패 — 침묵 금지(1.2): 에러 카드 + 재시도. (데이터가 이미 있으면 백그라운드
          refetch 실패여도 마지막 우주를 그대로 두는 편이 낫다 — 카드로 가리지 않는다.) */}
      {universe.isError && universeData === undefined && (
        <UniverseErrorCard>
          <p className="text-sm text-white/85">우주를 불러오지 못했어요.</p>
          <p className="text-xs break-all text-white/40">{errorMessage(universe.error)}</p>
          <button
            type="button"
            onClick={() => void universe.refetch()}
            className={primaryButtonCls}
          >
            다시 시도
          </button>
        </UniverseErrorCard>
      )}

      {universe.isSuccess && starCount === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-12 z-10 text-center">
          <p className="text-sm text-white/55">
            아직 별이 없어요. 첫 일기를 적어 첫 별을 띄워보세요.
          </p>
        </div>
      )}
    </div>
  )
}
