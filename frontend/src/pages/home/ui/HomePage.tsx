import { useCallback, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useSelector } from '@xstate/react'
import * as Sentry from '@sentry/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { errorMessage, reportUniverseData } from '@/shared/lib'
import {
  isDemoMode,
  getDemoPersona,
  demoOverlayData,
  demoFragmentText,
  demoRecall,
  useDemoOverlay,
} from '@/shared/lib/demo'
import { RendererUnavailableError } from '@/shared/lib/r3f'
import { Backdrop, MorningDiffNote, OverlayHost, primaryButtonCls } from '@/shared/ui'
import {
  UniverseCanvas,
  UniverseGrain,
  UniverseOverlay,
  OverlayComparePanel,
  navigationActor,
  selectHeadingMode,
  useViewport,
  type Bridge,
} from '@/widgets/universe-canvas'
import { DemoSimPanel } from '@/widgets/demo-sim'
import { toSynapseEdge } from '@/entities/synapse'
import { MemoryForm } from '@/features/record-memory'
import { MemoryPanel, recallFlushActor } from '@/features/recall'
import { EvolutionPanel, useEvolutionStore } from '@/features/evolution'
import { DiaryCard, DiarySheet } from '@/features/diary-list'
import { DormantSheet } from '@/features/dormant-search'
import { useShellStore } from '@/features/universe'
import { AppearanceSwitcher } from '@/features/switch-appearance'
import { ShareUniverseButton } from '@/features/share-universe'
import { SendStarModal, StarGiftsButton } from '@/features/send-star'
import {
  applyUniverse,
  mapStar,
  universeQueryOptions,
  useMemoryStore,
  focusActor,
  selectHighlightedRecordId,
  selectIsStarFocus,
  selectIsFocused,
} from '@/entities/memory'
import { applySettings, settingsQueryOptions } from '@/entities/appearance'

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

// Morning diff (spec 27, acceptance 6.1): the nightly consolidation runs once a night,
// so the first universe open of a new local day IS "공고화 이후 처음" — show the note once.
// localStorage day-stamp gates it to one show per day (no server signal needed; star
// coordinates/consolidation state never ride proto — 헌법3). claim returns true exactly
// once per local day and persists immediately, so a re-render / refetch can't re-fire it.
const MORNING_DIFF_KEY = 'cosimosi:morning-diff:lastShown'
function claimMorningDiffForToday(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local tz
    if (window.localStorage.getItem(MORNING_DIFF_KEY) === today) return false
    window.localStorage.setItem(MORNING_DIFF_KEY, today)
    return true
  } catch {
    return false // private mode / disabled storage — just skip the note
  }
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
  // A shell overlay (dormant/diary) covers the lower screen on mobile and the left on desktop —
  // hide the pad entirely while one is open so it isn't buried under the sheet/panel (spec 31).
  const panelOpen = useShellStore((s) => s.panel != null)

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

  // 패널이 열려 pad가 `hidden`이 되면 누르고 있던 버튼의 pointerup이 영영 안 와 move가 멈춰버린다
  // (시트 뒤에서 우주가 계속 전진/회전) — 패널이 열리는 순간 이동을 0으로 정지시킨다.
  useEffect(() => {
    if (panelOpen) setMove({ x: 0, y: 0, z: 0 })
  }, [panelOpen, setMove])

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

  // Mobile: thrust hugs the LEFT edge, look-pad the RIGHT (justify-between) so each thumb owns
  // one side — the "전진하며 시선 회전" chord works one-handed and the center stays clear to see
  // stars (spec 31 4a). Desktop (sm+): both groups sit together at left-center, out of the HUD.
  // bottom lifts above the home-indicator (safe-area) and the compose trigger.
  const visibility = panelOpen ? 'hidden' : infoOpen ? 'hidden sm:flex' : 'flex'
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

export function HomePage() {
  const mode = useSelector(navigationActor, selectHeadingMode)
  const starCount = useMemoryStore((s) => s.stars.length)

  // 겹쳐보기(spec 37) 데모 — DemoSimPanel의 토글이 켜면 두 페르소나 우주를 한 씬에 띄운다(서버 없이
  // (b) 겹침 공간 시연). 활성 페르소나가 mine, 다른 페르소나가 theirs, crossResonances가 그 사이 다리를
  // 파생한다. proto → StarNode/SynapseEdge로 매핑(겹침 위젯은 PROPS 구동). 활성 페르소나가 바뀌면 재계산.
  const demoOverlayOn = useDemoOverlay((s) => s.on)
  const demoPersona = isDemoMode() ? getDemoPersona() : null
  const demoOverlaySides = useMemo(() => {
    if (!demoOverlayOn || !isDemoMode()) return null
    const d = demoOverlayData()
    return {
      mine: { stars: d.mine.stars.map((s, i) => mapStar(s, i)), edges: d.mine.synapses.map(toSynapseEdge) },
      theirs: { stars: d.theirs.stars.map((s, i) => mapStar(s, i)), edges: d.theirs.synapses.map(toSynapseEdge) },
      bridges: d.bridges.map((b): Bridge => ({ myId: b.aId, theirId: b.bId })),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 활성 페르소나(값) 변경 시 재시뮬
  }, [demoOverlayOn, demoPersona])
  const demoOverlayReady = demoOverlaySides != null
  // 겹쳐보기 진입/이탈을 navigation 머신에 반영(overlay 상태 = 쓰기 게이트·전용 카메라).
  useEffect(() => {
    if (!demoOverlayReady) return
    navigationActor.send({ type: 'ENTER_OVERLAY' })
    return () => {
      navigationActor.send({ type: 'EXIT_OVERLAY' })
      focusActor.send({ type: 'DISMISS' })
    }
  }, [demoOverlayReady])
  // ?sim=<id> — 랜딩 카드 "이 카드 체험하기"가 넘긴 시뮬 포커스(spec 19, 라우트가 검증).
  // ?panel=dormant|diary — 우주 셸 위 탐색/리스트 오버레이 딥링크(spec 31).
  // ?fly=<memoryId> — 별 수락(spec 36) 후 내 우주로 돌아오며 새 별로 fly-to할 대상.
  const { sim, panel: urlPanel, fly } = useSearch({ from: '/universe' })
  const navigate = useNavigate({ from: '/universe' })

  // 별 보내기 모달(spec 36) — 회상 패널의 "이 별 보내기"가 memoryId를 넘겨 연다. 데모엔 서버가 없어 끈다.
  const [sendMemoryId, setSendMemoryId] = useState<string | null>(null)

  // 우주 셸 패널 상태(spec 31) — 영속 캔버스 위에 어떤 탐색/리스트 오버레이가 떠 있는지의 단일
  // 출처. 탐색은 라우트가 아니라 패널 상태다 — `?panel=`로만 딥링크/뒤로가기를 동기화하고 캔버스는
  // 절대 언마운트하지 않는다(1.5/1.6).
  const panel = useShellStore((s) => s.panel)
  const peek = useShellStore((s) => s.peek)
  const openPanel = useShellStore((s) => s.openPanel)
  const closePanel = useShellStore((s) => s.closePanel)
  const setPeek = useShellStore((s) => s.setPeek)

  // 포커스 상태(focus 머신, spec 39) — 별 회상 선택 / 일기 조망. 은은한 딤으로 "집중 중"을 알리고,
  // 빈 우주를 탭하면(캔버스 onPointerMissed → focus DISMISS) 해제·복귀한다(spec 31). highlightedRecordId는
  // 일기 카드 렌더 + diary-close 이펙트에, focused는 포커스 딤에 쓴다.
  const highlightedRecordId = useSelector(focusActor, selectHighlightedRecordId)
  const focused = useSelector(focusActor, selectIsFocused)

  // URL이 딥링크 가능한 패널(dormant/diary)의 단일 출처다 — 한 개의 거울 이펙트만 `?panel=`을
  // 셸 스토어에 반영하고, UI의 열기/닫기는 navigate만 한다. 가드는 렌더 클로저의 stale `panel`이
  // 아니라 `getState()`(현재값)로 비교해 ① 두 이펙트가 stale 스냅샷으로 레이스하지 않고(딥링크가
  // `?panel=`을 스스로 지우거나 뒤로가기를 삼키지 않게) ② 항목 선택 시 setPeek(true)가 보존되게
  // 한다(openPanel은 peek를 리셋하므로 패널이 실제로 바뀔 때만 호출). 변천사는 URL 딥링크 대상이
  // 아니다(별 id 필요 — features/evolution이 자체 스토어로 연다).
  useEffect(() => {
    const next = urlPanel ?? null
    if (useShellStore.getState().panel === next) return
    if (next === null) closePanel()
    else openPanel(next)
  }, [urlPanel, openPanel, closePanel])

  // 일기 조망 중 강조가 풀리면 일기 패널도 닫아 완전히 복귀한다(배경 탭=onPointerMissed→wayfinding.clear,
  // 또는 근접 진입 시 NearFarHighlightGuard.clear). "배경 누르면 돌아오기"의 일기 쪽 마무리(spec 31).
  useEffect(() => {
    if (panel === 'diary' && peek && highlightedRecordId == null) {
      void navigate({ search: (prev) => ({ ...prev, panel: undefined }), replace: true })
    }
  }, [panel, peek, highlightedRecordId, navigate])

  // 리스트/탐색 패널 열기 — 뒤로가기로 닫히도록 history에 push한다. 새 목록은 깨끗이 시작하도록
  // 직전 일기 강조를 해제하고(시각 전용 — records/memories 불변), 같은 패널 재진입이면 peek를 펼친다.
  function showPanel(p: 'dormant' | 'diary') {
    focusActor.send({ type: 'DISMISS' }) // 새 목록은 깨끗이 — 직전 포커스(별/일기) 해제
    setPeek(false)
    void navigate({ search: (prev) => ({ ...prev, panel: p }) })
  }
  // 일기를 고르면 그 일기(record_id) 별들을 조망 프레이밍+강조하고(focus 머신 diary) 시트는 peek로
  // 잦아든다 — 뒤 우주에서 frame-all fly-to(28). 시각 전용(records/memories 불변, 헌법1·2).
  function frameDiary(recordId: string) {
    focusActor.send({ type: 'SELECT_DIARY', recordId })
    setPeek(true)
  }
  // 잠든 별을 고르면 그 별로 fly-to(항행 FLY_TO_STAR) + 시트는 peek로 — 우주를 떠나지 않는다(1.2).
  // 포커스(별)는 fly-to 도착 시 FlyToController가 SELECT_STAR로 연다.
  function focusDormant(memoryId: string) {
    navigationActor.send({ type: 'FLY_TO_STAR', id: memoryId })
    setPeek(true)
  }
  // 패널 닫기 = 포커스 해제(focus DISMISS) + `?panel=` 제거. replace로 history를 더럽히지 않아(닫기
  // 직후 뒤로가기가 패널을 되살리지 않음) 거울 이펙트가 스토어를 닫는다.
  function closeShellPanel() {
    focusActor.send({ type: 'DISMISS' })
    void navigate({ search: (prev) => ({ ...prev, panel: undefined }), replace: true })
  }
  // Mobile-only: the compose form is hidden by default (keep the universe unobstructed)
  // and expands into a full-width bottom sheet. On desktop (sm+) it stays a persistent
  // top-left panel, so this flag is ignored there.
  const [composeOpen, setComposeOpen] = useState(false)

  // 페이지 HUD의 하단 시트(작성 폼·기억 실험실)가 열려 있는 동안 캔버스에 알린다 —
  // 모바일에선 별들이 화면 중앙에 있어 시트에 가려지므로, 캔버스가 view offset+줌아웃으로
  // 우주를 화면 위 1/3 지점에 띄운다(ViewOffsetController; sm 미만에서만이라 데스크톱은
  // 무변화). 회상 패널(선택된 별)은 컨트롤러가 memory store에서 직접 구독한다.
  const [demoSheetOpen, setDemoSheetOpen] = useState(false)
  // Morning diff (6.1) — live universe only; demo's "밤 보내기" owns its own note.
  const [morningDiff, setMorningDiff] = useState(false)
  const setSheetOpen = useViewport((s) => s.setSheetOpen)
  useEffect(() => {
    // compose는 탐색 오버레이가 열리면 숨으므로(panel != null) view-offset도 그 *실제 표시 여부*를
    // 따라야 한다 — 안 그러면 패널을 열어 둔 채 우주가 위로 밀리고 줌된 상태로 남는다(셸 시트 뒤 오정렬).
    setSheetOpen((composeOpen && panel == null) || demoSheetOpen)
    return () => setSheetOpen(false)
  }, [composeOpen, panel, demoSheetOpen, setSheetOpen])

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

  // 개인 시각 설정(spec 30): 인증된 우주에서 GetSettings로 appearance store를 시드한다(서버
  // 오버라이드를 기본값 위에 머지). 데모는 빈 응답 → 기본값. 미인증 랜딩은 이 페이지를 안 그린다.
  const { data: settingsData } = useQuery(settingsQueryOptions())
  useEffect(() => {
    if (settingsData) applySettings(settingsData)
  }, [settingsData])

  // First universe open of a new local day → the morning-diff note once (6.1). Gated to a
  // non-empty live universe (a brand-new user with no stars sees nothing to "정리"). The
  // claim+show is deferred to a rAF (so the setState isn't synchronous in the effect) and
  // the claim runs INSIDE it — a re-render that cancels the frame never burns the day-stamp.
  useEffect(() => {
    if (isDemoMode() || !universe.isSuccess || starCount === 0) return
    const id = requestAnimationFrame(() => {
      if (claimMorningDiffForToday()) setMorningDiff(true)
    })
    return () => cancelAnimationFrame(id)
  }, [universe.isSuccess, starCount])

  // 별 수락(spec 36) 후 내 우주로 돌아오며 새 별로 fly-to. 새 별은 GetUniverse refetch로 도착하므로
  // (수락이 우주 캐시를 무효화함) 스토어에 실릴 때까지 기다렸다 한 번만 날아가고 ?fly를 지운다(?sim·
  // 모닝디프와 같은 일회성 패턴). 도착 시 FlyToController가 그 별을 회상 포커스로 연다.
  useEffect(() => {
    if (!fly) return
    if (!useMemoryStore.getState().stars.some((s) => s.id === fly)) return // 아직 안 실림 — refetch 대기
    navigationActor.send({ type: 'FLY_TO_STAR', id: fly })
    void navigate({ search: (prev) => ({ ...prev, fly: undefined }), replace: true })
  }, [fly, starCount, navigate])

  // Flush any pending co-recall reinforcement when the tab is hidden/closed (1.3). The
  // model store is DOM-free (1.9); the window listeners live here in the page layer.
  // visibilitychange(hidden) fires more reliably than beforeunload (esp. on mobile),
  // and the transport uses keepalive so the request survives teardown.
  useEffect(() => {
    const flush = () => {
      recallFlushActor.send({ type: 'FLUSH' })
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

  // Esc → 포커스 해제(별 회상·일기 조망)로 복귀(배경 탭과 동일). 구버전은 일기 조망의 Esc를
  // OverlayHost가 처리했는데 일기 카드가 호스트 밖으로 나오며 사라졌다 — 여기서 되살린다. 리스트가
  // 펼쳐져 있으면(panel!=null && !peek) OverlayHost의 Esc가 목록 닫기를 맡으므로 양보한다(이중 처리 방지).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isTypingTarget()) return
      const shell = useShellStore.getState()
      if (shell.panel != null && !shell.peek) return
      if (focusActor.getSnapshot().matches('idle')) return
      focusActor.send({ type: 'DISMISS' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 겹쳐보기(spec 37) 데모 — 두 페르소나 우주 + 빛의 다리만 띄우는 전용 뷰(단일 우주 HUD와 분리해
  // 충돌 방지). 다리를 누르면 비교 패널이 두 기억을 나란히 보여준다. "겹쳐보기 끄기"로 복귀.
  if (demoOverlaySides) {
    return (
      <div className="universe-page fixed inset-0" data-lenis-prevent>
        <Sentry.ErrorBoundary fallback={CanvasErrorFallback}>
          <UniverseOverlay
            mine={demoOverlaySides.mine}
            theirs={demoOverlaySides.theirs}
            bridges={demoOverlaySides.bridges}
          />
        </Sentry.ErrorBoundary>
        <UniverseGrain />
        {focused && <Backdrop className="z-10" />}
        <OverlayComparePanel
          myStars={demoOverlaySides.mine.stars}
          theirStars={demoOverlaySides.theirs.stars}
          // 데모는 내 별 텍스트를 페르소나 일기에서 직접 보여준다(내 우주라 비공개 이슈 없음).
          resolveMyText={(id) => demoFragmentText(id) || demoRecall(id)?.body}
        />
        <div className="pointer-events-none absolute inset-x-0 top-[calc(1rem+env(safe-area-inset-top))] z-30 flex flex-col items-center gap-1 px-4 text-center">
          <h1 className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 text-sm font-medium text-white/85 backdrop-blur">
            두 우주 겹쳐보기
          </h1>
          <p className="text-[11px] text-white/40">공명한 별이 빛의 다리로 이어져요 — 다리를 눌러 비교해보세요</p>
        </div>
        <div className="absolute right-[calc(1rem+env(safe-area-inset-right))] top-[calc(1rem+env(safe-area-inset-top))] z-30">
          <button
            type="button"
            onClick={() => useDemoOverlay.getState().setOn(false)}
            className="rounded-full border border-white/15 bg-black/55 px-4 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition-colors hover:bg-black/70"
          >
            겹쳐보기 끄기
          </button>
        </div>
      </div>
    )
  }

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

      {/* 포커스 딤(spec 31) — 별 회상·일기 조망 중 은은히 어둡혀 집중을 알린다. pointer-events-none이라
          별 탭·드래그는 그대로 캔버스로 통과하고, 빈 곳 탭은 캔버스 onPointerMissed가 해제로 받는다. */}
      {focused && <Backdrop className="z-10" />}

      {/* HUD: 2D DOM overlays outside the canvas */}

      {/* 야간 공고화 morning diff(spec 27, 6.1) — 하루 첫 접속 1회. 데모는 자체 "밤 보내기"가 띄운다. */}
      {!isDemoMode() && (
        <MorningDiffNote show={morningDiff} onDismiss={() => setMorningDiff(false)} />
      )}

      {/* Compose — 데모에선 숨김: 본문 입력 대신 시뮬 패널의 "별 띄우기"(감정·날짜 드롭다운,
          내용은 미리 쓴 일기)가 기록 컨트롤러를 담당한다(spec 19). */}
      {!isDemoMode() && (
        <>
          {/* Compose — desktop (sm+): persistent top-left panel. */}
          <div className="absolute top-4 left-4 z-20 hidden w-80 sm:block">
            <MemoryForm />
          </div>

          {/* Compose — mobile (<sm): hidden by default; a full-width trigger expands it into
              a full-width bottom sheet. 탐색 오버레이(dormant/diary)가 열려 있으면 숨긴다 — 같은
              하단 모서리의 peek 손잡이와 충돌하지 않게(spec 31). safe-area로 홈 인디케이터 위로 올린다. */}
          {panel == null && (
            <div className="sm:hidden">
              {composeOpen ? (
                <div className="absolute inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-30">
                  <button
                    type="button"
                    onClick={() => setComposeOpen(false)}
                    aria-label="닫기"
                    className="absolute top-2 right-2 z-10 grid h-9 w-9 place-items-center rounded-md text-white/50 transition hover:text-white/90"
                  >
                    ✕
                  </button>
                  <MemoryForm />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setComposeOpen(true)}
                  className="absolute inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 rounded-xl border border-white/10 bg-indigo-500/80 px-4 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-indigo-500"
                >
                  ✦ 새 일기 — 별 띄우기
                </button>
              )}
            </div>
          )}
        </>
      )}
      <NavPad />

      {/* Star info — mobile: above the bottom compose button and height-capped so a long
          memory scrolls instead of reaching the top controls. Desktop: bottom-right (compose
          is a top-left panel, so no overlap). */}
      <div className="absolute right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 max-h-[calc(100dvh-12rem)] overflow-y-auto overscroll-contain sm:bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:max-h-[calc(100dvh-2rem)] sm:overflow-y-auto">
        <MemoryPanel
          onOpenEvolution={(id) => useEvolutionStore.getState().open(id)}
          // "이 별 보내기"(spec 36) — 데모엔 서버가 없어 진입점을 숨긴다(onSendStar 미전달).
          onSendStar={isDemoMode() ? undefined : (id) => setSendMemoryId(id)}
          // "이 일기의 다른 별들 보기"(spec 28·39): 일기 목록 클릭(SELECT_DIARY)과 동일한 SEE_DIARY_STARS를
          // 보낸다 — 둘 다 focus 머신의 diary 상태로 수렴해 같은 일기 카드 + 조망을 보인다(구버전은 한쪽만
          // 동작하던 불일치). 일기 목록이 열려 있었다면 peek로 잦아들게 해 프레이밍된 별을 가리지 않는다.
          onSeeDiaryStars={(recordId) => {
            focusActor.send({ type: 'SEE_DIARY_STARS', recordId })
            if (panel === 'diary') setPeek(true)
          }}
        />
      </div>
      {/* 변천사 타임랩스(24) — 우주 위 중앙 오버레이(31 셸 도입 전까지 페이지 합성). 우주 캔버스는
          뒤에 영속하고, 회상 패널의 "변천사 보기"가 useEvolutionStore.open으로 연다. */}
      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4">
        <EvolutionPanel />
      </div>
      {/* top-16(+safe): clear the global 로그아웃 pill (SessionGate, top-4 right-4) so these
          page controls don't sit hidden underneath it. z-30 so they stay tappable above the
          NavPad/compose HUD (z-20) and never get buried (spec 31). */}
      <div className="absolute top-[calc(4rem+env(safe-area-inset-top))] right-4 z-30 flex gap-2">
        {/* 원본 일기로 별 찾기(spec 28) — 우주 위 오버레이로 일기 목록을 연다(라우트 이동 없음, 31 셸). */}
        <button
          type="button"
          onClick={() => showPanel('diary')}
          className="rounded-md bg-white/10 px-3 py-2 text-sm text-white/80 backdrop-blur transition hover:bg-white/20"
        >
          일기
        </button>
        {/* 잠든 별 탐색(spec 12) — 별도 라우트가 아니라 셸 위 오버레이를 연다(spec 31). */}
        <button
          type="button"
          onClick={() => showPanel('dormant')}
          className="rounded-md bg-white/10 px-3 py-2 text-sm text-white/80 backdrop-blur transition hover:bg-white/20"
        >
          잠든 별
        </button>
        {/* 우주 공개(spec 35) — 풍경만 공개하는 URL 토글·표시명·복사·회전 모달. 데모에선 숨김(자체 처리). */}
        <ShareUniverseButton />
        {/* 주고받은 별(spec 36) — 보낸/받은 목록 + 대기 중 보낸 별 취소. 데모에선 숨김. */}
        <StarGiftsButton />
        <button
          type="button"
          onClick={() => navigationActor.send({ type: 'TOGGLE_MODE' })}
          className="rounded-md bg-white/10 px-3 py-2 text-sm text-white/80 backdrop-blur transition hover:bg-white/20"
        >
          {/* 모바일은 좁은 우상단 폭에 맞춰 짧게(아이콘+한 단어), 데스크톱은 풀 라벨. */}
          <span className="sm:hidden">{mode === 'nebula' ? '🔭 성운' : '🚀 회상'}</span>
          <span className="hidden sm:inline">
            카메라: {mode === 'nebula' ? '성운(전체 조망)' : '회상(근접 항해)'}
          </span>
        </button>
      </div>

      {/* 우주 셸 오버레이(spec 31) — 영속 캔버스 위 비차단 호스트(모바일=바텀시트/데스크톱=사이드
          패널). 각 feature는 콘텐츠(`…Sheet`)만 제공하고, 호스트가 컨테이너·peek·스냅·reduced-motion을
          맡는다. 캔버스는 절대 재init되지 않는다(1.5). */}
      {panel === 'dormant' && (
        <OverlayHost
          open
          peek={peek}
          title="잠든 별"
          peekLabel="🌙 잠든 별 목록 펼치기"
          onClose={closeShellPanel}
          onExpand={() => setPeek(false)}
        >
          <DormantSheet onSelect={focusDormant} />
        </OverlayHost>
      )}
      {/* 일기 목록(spec 31) — 펼친 상태에서만 호스트로 띄운다. 일기를 고르면 peek=true가 되어 목록은
          사라지고, 아래의 포커스 구동 DiaryCard가 그 자리를 대신한다(목록≠조망 — orthogonal, spec 39). */}
      {panel === 'diary' && !peek && (
        <OverlayHost
          open
          peek={false}
          title="원본 일기 — 별 찾기"
          peekLabel="📖 일기 목록 펼치기"
          onClose={closeShellPanel}
          onExpand={() => setPeek(false)}
        >
          <DiarySheet onSelectDiary={frameDiary} />
        </OverlayHost>
      )}
      {/* 조망 중인 일기 카드(spec 31·39) — 포커스=일기면 어느 경로(목록 선택·"이 일기의 다른 별들")로든
          하단에 뜬다(구버전은 panel==='diary'에 묶여 회상 패널 경로에선 카드가 안 떴다). 단 일기 목록이
          펼쳐져 있을 땐(panel='diary' && !peek 위 호스트가 떠 있음) 카드를 숨겨 겹치지 않게 한다. "목록"은
          목록을 펼치고(카드는 위 가드로 숨음), ✕·배경 탭·Esc는 복귀. */}
      {highlightedRecordId && (panel !== 'diary' || peek) && (
        <DiaryCard
          recordId={highlightedRecordId}
          onExpand={() => {
            setPeek(false)
            void navigate({ search: (prev) => ({ ...prev, panel: 'diary' }) })
          }}
          onClose={closeShellPanel}
        />
      )}

      {/* 테마·오브제 스위처 — 우상단 컨트롤 스택 아래(safe-area로 노치 아래). FAB은 z-50(전역 chrome). */}
      <AppearanceSwitcher className="top-[calc(7rem+env(safe-area-inset-top))] right-4" />

      {/* 별 보내기 모달(spec 36) — 회상 패널의 "이 별 보내기"가 열고, 발급된 토큰 URL을 복사해 전달한다. */}
      {sendMemoryId && <SendStarModal memoryId={sendMemoryId} onClose={() => setSendMemoryId(null)} />}

      {/* 시뮬레이션 패널(spec 19) — 데모에서만, 좌하단(데스크톱)/하단 시트(모바일).
          데모의 기록은 이 패널의 "별 띄우기" 컨트롤러가 담당한다(작성 폼은 데모에서 숨김). */}
      {isDemoMode() && <DemoSimPanel initialSimId={sim} onSheetChange={setDemoSheetOpen} />}

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
