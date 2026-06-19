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
  demoOffsetDays,
  demoFragmentText,
  demoRecall,
  exitDemoMode,
  resetDemo,
  useDemoOverlay,
} from '@/shared/lib/demo'
import { RendererUnavailableError } from '@/shared/lib/r3f'
import { Eye, EyeOff, Menu, Orbit, Palette, Plus, Sparkles, Telescope } from 'lucide-react'
import { Backdrop, MorningDiffNote, Surface, primaryButtonCls } from '@/shared/ui'
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
import { MemoryForm, composeActor, selectPhase } from '@/features/record-memory'
import { MemoryPanel, recallFlushActor } from '@/features/recall'
import { EvolutionPanel, useEvolutionStore } from '@/features/evolution'
import { DiaryCard } from '@/features/diary-list'
import { AppearanceModal } from './AppearanceModal'
import { UniverseSidebar } from './UniverseSidebar'
import { UniverseExplorerSheet, type ExplorerTab } from './UniverseExplorerSheet'
import { ShareUniverseBody } from '@/features/share-universe'
import { SendStarBody, StarGiftsBody } from '@/features/send-star'
import {
  applyUniverse,
  mapStar,
  starsOfRecord,
  universeQueryOptions,
  useMemoryStore,
  focusActor,
  selectHighlightedRecordId,
  selectIsStarFocus,
  selectIsFocused,
} from '@/entities/memory'
import {
  applySettings,
  settingsQueryOptions,
  applyInventory,
  inventoryQueryOptions,
  useAppearance,
} from '@/entities/appearance'

// The universe shell (spec 10, extended by 11; IA re-laid-out by change 09): full-screen
// <UniverseCanvas/> (renders the stars from the memory store) + 2D HUD overlays OUTSIDE the R3F
// scene (Architecture §3.1). The universe loads via the GetUniverse query (16) — loading/error/
// retry UI here, merge-sync into the stores. change 09 IA: a top-right hamburger sidebar + vertical
// view controls (camera toggle · telescope), a top-center HUD hide toggle, a bottom-center floating
// 새 별 button, and a telescope explorer sheet (일기/별 tabs) that replaces the old menu + panels.
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
 *  thrusts forward/back). Hidden in nebula mode (there you zoom/orbit freely) and whenever a
 *  HUD surface (sidebar/explorer) is up or the HUD is hidden (change 09 — passed as `suppressed`). */
function NavPad({ suppressed }: { suppressed: boolean }) {
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

/** 우상단 세로 컨트롤의 아이콘 버튼 — 안정적인 고정 크기 + tooltip/aria-label(A5·A11). */
const verticalBtnCls =
  'grid size-9 place-items-center rounded-md bg-white/10 text-white/80 backdrop-blur transition hover:bg-white/20'

export interface HomePageProps {
  /** 실로그아웃 — 앱(session-context)이 내려준다(pages는 session-context를 직접 import하지 않음, FSD). */
  onSignOut: () => void
}

export function HomePage({ onSignOut }: HomePageProps) {
  const mode = useSelector(navigationActor, selectHeadingMode)
  const starCount = useMemoryStore((s) => s.stars.length)
  const demoMode = isDemoMode()

  // 겹쳐보기(spec 37) 체험 우주 — DemoSimPanel의 토글이 켜면 두 페르소나 우주를 한 씬에 띄운다(서버 없이
  // (b) 겹침 공간 시연). 활성 페르소나가 mine, 다른 페르소나가 theirs, crossResonances가 그 사이 다리를
  // 파생한다. proto → StarNode/SynapseEdge로 매핑(겹침 위젯은 PROPS 구동). 활성 페르소나가 바뀌면 재계산.
  const demoOverlayOn = useDemoOverlay((s) => s.on)
  const demoPersona = demoMode ? getDemoPersona() : null
  // 가상 시계(spec 19) 경과일 — 시간 머신이 시간을 흘리면 별 밝기/반지름이 그만큼 늙어야 하므로
  // 겹쳐보기도 재시뮬 대상이다(demoOverlayData가 virtualNowMs를 읽는다). 비반응형 모듈 시계라
  // 값으로 환원해 deps에 넣는다 — 클럭이 바뀐 채 리렌더되면 두 우주를 새 now로 다시 빚는다.
  const demoClockDay = demoMode ? demoOffsetDays() : 0
  const demoOverlaySides = useMemo(() => {
    if (!demoOverlayOn || !demoMode) return null
    const d = demoOverlayData()
    return {
      mine: { stars: d.mine.stars.map((s, i) => mapStar(s, i)), edges: d.mine.synapses.map(toSynapseEdge) },
      theirs: { stars: d.theirs.stars.map((s, i) => mapStar(s, i)), edges: d.theirs.synapses.map(toSynapseEdge) },
      bridges: d.bridges.map((b): Bridge => ({ myId: b.aId, theirId: b.bId })),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 활성 페르소나(값)·가상 시계 변경 시 재시뮬
  }, [demoOverlayOn, demoPersona, demoClockDay])
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
  // ?sim=<id> — 랜딩 카드 "체험 우주에서 해보기"가 넘긴 이론 포커스(spec 19, 라우트가 검증).
  // ?panel=dormant|diary — 구 셸 딥링크(change 09 이전). 신규 UI는 망원경 탐색 시트로 흡수 →
  //   진입 시 1회 소비해 탐색 시트(별/일기 탭)를 열고 param을 비운다(legacy redirect).
  // ?record=<recordId> — 독립 일기 페이지 "우주에서 보기" 핸드오프(change 09): 그 record의 별을 frame-all.
  // ?fly=<memoryId> — 별 수락(spec 36) 후 내 우주로 돌아오며 새 별로 fly-to할 대상.
  const { sim, panel: urlPanel, record: urlRecord, fly } = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })

  // change 09 IA 상태 — 우상단 햄버거 사이드바, 망원경 탐색 시트(일기/별 탭), 상단 중앙 HUD 숨김 토글,
  // 그리고 기존 결과/액션 표면(작성·공유·선물·보내기·꾸미기). 한 번에 하나의 표면만 띄운다(prepareOpen).
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [explorerOpen, setExplorerOpen] = useState(false)
  const [explorerTab, setExplorerTab] = useState<ExplorerTab>('diary')
  const [uiHidden, setUiHidden] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [giftsOpen, setGiftsOpen] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  // 별 보내기(spec 36) — 회상 패널의 "이 별 보내기"가 memoryId를 넘겨 연다(비차단 Surface). 데모엔 서버가 없어 끈다.
  const [sendMemoryId, setSendMemoryId] = useState<string | null>(null)

  // 포커스 상태(focus 머신, spec 39) — 별 회상 선택 / 일기 조망. highlightedRecordId는 일기 카드
  // 렌더에, focused는 포커스 딤에, isStarFocus는 회상 표면 게이트에 쓴다.
  const highlightedRecordId = useSelector(focusActor, selectHighlightedRecordId)
  const focused = useSelector(focusActor, selectIsFocused)
  const isStarFocus = useSelector(focusActor, selectIsStarFocus)
  const evolutionOpen = useEvolutionStore((s) => s.openFor != null)
  const composePhase = useSelector(composeActor, selectPhase)

  // 한 번에 하나의 표면만 — 새 표면을 열기 전에 나머지를 정리한다(특히 모바일 바텀시트 중첩 방지).
  // 변천사·별 보내기는 회상 위에서 의도적으로 겹치므로 여기서 닫지 않는다(회상에서 파생).
  const closeSurfaces = useCallback(() => {
    setSidebarOpen(false)
    setExplorerOpen(false)
    setComposeOpen(false)
    setShareOpen(false)
    setGiftsOpen(false)
    setAppearanceOpen(false)
    setSendMemoryId(null)
  }, [])
  // 기능 진입 — 정리 후 연다. 열려 있던 별 회상/일기 조망도 함께 풀어 한 표면만 남긴다(우주는 떠나지 않음).
  const prepareOpen = useCallback(() => {
    closeSurfaces()
    focusActor.send({ type: 'DISMISS' })
  }, [closeSurfaces])

  const openSidebar = () => {
    prepareOpen()
    setSidebarOpen(true)
  }
  const openExplorer = (tab: ExplorerTab) => {
    prepareOpen()
    setExplorerTab(tab)
    setExplorerOpen(true)
  }
  const openCompose = () => {
    prepareOpen()
    setComposeOpen(true)
  }
  const openShare = () => {
    prepareOpen()
    setShareOpen(true)
  }
  const openGifts = () => {
    prepareOpen()
    setGiftsOpen(true)
  }
  const openAppearance = () => {
    prepareOpen()
    setAppearanceOpen(true)
  }

  // 사이드바 항목 — 마이페이지/일기는 라우트 이동, 공유/선물은 표면 전환. 모두 진입 전에 정리한다.
  const goMyPage = () => {
    closeSurfaces()
    void navigate({ to: '/my-page' })
  }
  const goDiary = () => {
    closeSurfaces()
    void navigate({ to: '/diary' })
  }
  // 체험 종료(데모) — 기존 SessionGate 핀과 같은 동선(더미 별 비우기 → 마케팅 랜딩).
  const leaveDemo = () => {
    exitDemoMode()
    resetDemo()
    void navigate({ to: '/landing' })
  }

  // 일기를 고르면 그 일기(record_id) 별들을 조망 프레이밍+강조하고(focus 머신 diary) 탐색 시트는 닫는다 —
  // 뒤 우주에서 frame-all fly-to(28). 시각 전용(records/memories 불변, 헌법1·2). DiaryCard가 하단에 뜬다.
  const frameDiary = (recordId: string) => {
    focusActor.send({ type: 'SELECT_DIARY', recordId })
    setExplorerOpen(false)
  }
  // 별을 고르면 그 별로 fly-to(항행 FLY_TO_STAR) — 우주를 떠나지 않는다. 포커스(별)는 도착 시
  // FlyToController가 SELECT_STAR로 연다. 탐색 시트는 닫아 프레이밍 별을 가리지 않는다.
  const flyToStar = (memoryId: string) => {
    navigationActor.send({ type: 'FLY_TO_STAR', id: memoryId })
    setExplorerOpen(false)
  }

  // HUD 숨김 토글(A13·A14) — 숨길 때 토글을 제외한 모든 HUD와 열린 표면/포커스를 정리한다. 캔버스는
  // 언마운트하지 않는다(uiHidden은 HUD DOM만 가린다). 보이기를 누르면 기본 HUD가 복귀한다.
  const toggleUiHidden = () => {
    setUiHidden((prev) => {
      const next = !prev
      if (next) {
        closeSurfaces()
        focusActor.send({ type: 'DISMISS' })
        useEvolutionStore.getState().close()
      }
      return next
    })
  }

  // 어떤 표면/사이드바가 떠 있거나 HUD가 숨겨졌으면 NavPad·데모 HUD를 억제한다(구 panel!=null 대체).
  const surfaceUp = sidebarOpen || explorerOpen || composeOpen || shareOpen || giftsOpen || appearanceOpen || sendMemoryId != null
  const navSuppressed = surfaceUp || uiHidden
  const demoHudSuppressed = focused || surfaceUp || uiHidden
  // 모달형 표면(탐색·작성·공유·선물·보내기·변천사)이 뜨면 배경을 딤 백드롭으로 가린다 — 이 백드롭은
  // HUD 크롬(우상단 컨트롤·테마·하단 새 별·상단 중앙 UI 숨기기 토글, 전부 z-20)보다 위(z-30), 모달 표면
  // (z-30, DOM 뒤라 위)보다 아래에 깔려 크롬·토글까지 함께 흐려진다. 탭하면 모달을 닫는다. 사이드바는
  // 자체 백드롭(z-40)을 가지고, 회상(별 포커스)은 의도적으로 비차단(z-10 포커스 딤만)이라 제외한다.
  const modalUp = explorerOpen || composeOpen || shareOpen || giftsOpen || sendMemoryId != null || evolutionOpen
  const closeModalSurfaces = useCallback(() => {
    closeSurfaces()
    useEvolutionStore.getState().close()
  }, [closeSurfaces])

  // 구 셸 딥링크(?panel=dormant|diary) 1회 소비 → 망원경 탐색 시트로 흡수(잠든 별 → 별 탭). param은 비운다.
  // setState는 rAF로 미뤄 effect 동기 setState(cascading render)를 피한다(모닝디프와 같은 패턴).
  useEffect(() => {
    if (!urlPanel) return
    const tab: ExplorerTab = urlPanel === 'dormant' ? 'star' : 'diary'
    // 열기(setState) 후 같은 프레임에서 param을 비운다 — navigate를 rAF 밖에 두면 panel 변경이 effect를
    // 재실행해 cleanup이 rAF를 취소(open 유실)한다. 둘을 rAF 안에 묶어 레이스를 없앤다.
    const id = requestAnimationFrame(() => {
      setExplorerTab(tab)
      setExplorerOpen(true)
      void navigate({ search: (prev) => ({ ...prev, panel: undefined }), replace: true })
    })
    return () => cancelAnimationFrame(id)
  }, [urlPanel, navigate])

  // 독립 일기 페이지 "우주에서 보기" 핸드오프(?record=) — 그 record의 별이 스토어에 실리면(GetUniverse
  // 도착) 1회 frame-all 하고 param을 비운다(?fly와 같은 일회성 패턴). 좌표 권위는 클라 force-sim(헌법3).
  useEffect(() => {
    if (!urlRecord) return
    if (starsOfRecord(useMemoryStore.getState().stars, urlRecord).length === 0) return // 아직 안 실림 — 대기
    focusActor.send({ type: 'SELECT_DIARY', recordId: urlRecord })
    void navigate({ search: (prev) => ({ ...prev, record: undefined }), replace: true })
  }, [urlRecord, starCount, navigate])

  // 페이지 HUD의 하단 시트(작성 폼·기억 실험실)가 열려 있는 동안 캔버스에 알린다 — 모바일에선 별들이
  // 화면 중앙에 있어 시트에 가려지므로, 캔버스가 view offset+줌아웃으로 우주를 위로 올린다(sm 미만만).
  const [demoSheetOpen, setDemoSheetOpen] = useState(false)
  // Morning diff (6.1) — live universe only; demo's "밤 보내기" owns its own note.
  const [morningDiff, setMorningDiff] = useState(false)
  const setSheetOpen = useViewport((s) => s.setSheetOpen)
  const requestQuietSettle = useViewport((s) => s.requestQuietSettle)
  useEffect(() => {
    setSheetOpen((composeOpen && !uiHidden) || (!demoHudSuppressed && demoSheetOpen))
    return () => setSheetOpen(false)
  }, [composeOpen, uiHidden, demoHudSuppressed, demoSheetOpen, setSheetOpen])

  // GetUniverse as a declarative query (16): staleTime 5m·gcTime 30m·focus refetch는
  // 옵션이 소유. 응답은 전체 교체가 아니라 병합으로 스토어에 반영(1.4).
  const universe = useQuery(universeQueryOptions())
  const { data: universeData } = universe
  useEffect(() => {
    if (universeData) {
      applyUniverse(universeData)
      reportUniverseData({
        star_count: universeData.stars.length,
        synapse_count: universeData.synapses.length,
      })
    }
  }, [universeData])

  // 개인 시각 설정(spec 30): 인증된 우주에서 GetSettings로 appearance store를 시드한다.
  const { data: settingsData } = useQuery(settingsQueryOptions())
  useEffect(() => {
    if (settingsData) applySettings(settingsData)
  }, [settingsData])

  // 커스터마이즈 인벤토리(spec 44): 별가루 잔액 + 소유 아이템을 시드한다.
  const { data: inventoryData } = useQuery(inventoryQueryOptions())
  useEffect(() => {
    if (inventoryData) applyInventory(inventoryData)
  }, [inventoryData])
  const stardust = useAppearance((s) => s.stardust)

  // First universe open of a new local day → the morning-diff note once (6.1).
  useEffect(() => {
    if (demoMode || !universe.isSuccess || starCount === 0) return
    const id = requestAnimationFrame(() => {
      if (claimMorningDiffForToday()) setMorningDiff(true)
    })
    return () => cancelAnimationFrame(id)
  }, [universe.isSuccess, starCount, demoMode])

  // 별 수락(spec 36) 후 내 우주로 돌아오며 새 별로 fly-to. 스토어에 실릴 때까지 기다렸다 한 번만 날아가고 ?fly를 지운다.
  useEffect(() => {
    if (!fly) return
    if (!useMemoryStore.getState().stars.some((s) => s.id === fly)) return // 아직 안 실림 — refetch 대기
    navigationActor.send({ type: 'FLY_TO_STAR', id: fly })
    void navigate({ search: (prev) => ({ ...prev, fly: undefined }), replace: true })
  }, [fly, starCount, navigate])

  // Flush any pending co-recall reinforcement when the tab is hidden/closed (1.3).
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

  // 단일 Esc 라우터(change 09): 위에 뜬 표면을 위에서부터 닫은 뒤(보내기→변천사→꾸미기→공유→선물→
  // 작성→탐색→사이드바), 마지막으로 포커스(별 회상·일기 조망)를 푼다. SideDrawer는 자체 Esc도 잡지만
  // (stopPropagation) 여기서도 사이드바를 닫아 일관되게 라우팅한다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isTypingTarget()) return
      if (sendMemoryId) return void setSendMemoryId(null)
      if (useEvolutionStore.getState().openFor) return void useEvolutionStore.getState().close()
      if (appearanceOpen) return void setAppearanceOpen(false)
      if (shareOpen) return void setShareOpen(false)
      if (giftsOpen) return void setGiftsOpen(false)
      if (composeOpen) return void setComposeOpen(false)
      if (explorerOpen) return void setExplorerOpen(false)
      if (sidebarOpen) return void setSidebarOpen(false)
      if (focusActor.getSnapshot().matches('idle')) return
      focusActor.send({ type: 'DISMISS' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sendMemoryId, appearanceOpen, shareOpen, giftsOpen, composeOpen, explorerOpen, sidebarOpen])

  // 겹쳐보기(spec 37) 데모 — 두 페르소나 우주 + 빛의 다리만 띄우는 전용 뷰(단일 우주 HUD와 분리).
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
      {/* 바운더리는 Canvas에만(17). 외형 모달이 열리면 캔버스를 언마운트해(change 06) WebGPU 컨텍스트를
          모달 프리뷰/썸네일에 양보한다. HUD 숨김은 캔버스를 언마운트하지 않는다(A14) — HUD DOM만 가린다. */}
      {!appearanceOpen && (
        <Sentry.ErrorBoundary fallback={CanvasErrorFallback}>
          <UniverseCanvas />
        </Sentry.ErrorBoundary>
      )}
      {/* Film grain over the canvas — above the canvas, below the HUD, pointer-events:none. */}
      <UniverseGrain />

      {/* 포커스 딤 — 별 회상·일기 조망 중 은은히 어둡힌다. pointer-events-none이라 별 탭은 통과. */}
      {focused && !uiHidden && <Backdrop className="z-10" />}

      {/* === 상단 중앙 HUD 숨김/보이기 토글(A13) — 숨김 상태에서도 보이는 유일한 컨트롤. 모달이 뜨면
          z-30 백드롭이 이 토글까지 덮어 함께 흐려진다(z-20). === */}
      <div className="absolute left-1/2 top-[calc(1rem+env(safe-area-inset-top))] z-20 -translate-x-1/2">
        <button
          type="button"
          onClick={toggleUiHidden}
          aria-pressed={uiHidden}
          title={uiHidden ? 'UI 보이기' : 'UI 숨기기'}
          aria-label={uiHidden ? 'UI 보이기' : 'UI 숨기기'}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/70 backdrop-blur transition hover:bg-black/60"
        >
          {uiHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          <span>{uiHidden ? 'UI 보이기' : 'UI 숨기기'}</span>
        </button>
      </div>

      {!uiHidden && (
        <>
          {/* 야간 공고화 morning diff(spec 27, 6.1) — 하루 첫 접속 1회. 데모는 자체 "밤 보내기"가 띄운다. */}
          {!demoMode && <MorningDiffNote show={morningDiff} onDismiss={() => setMorningDiff(false)} />}

          {/* === 우상단 세로 컨트롤(A5) — 햄버거 · 시점 전환 · 망원경. (모달 백드롭 z-30 아래 z-20) === */}
          <div className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] z-20 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={openSidebar}
              aria-label="메뉴"
              aria-haspopup="menu"
              aria-expanded={sidebarOpen}
              className={verticalBtnCls}
            >
              <Menu className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => navigationActor.send({ type: 'TOGGLE_MODE' })}
              className={verticalBtnCls}
              // change 08(A1): 사용자-facing 카메라 모드 용어. title/aria-label은 누르면 갈 모드를 안내한다.
              title={mode === 'nebula' ? '별들 가까이서 탐험하기로 전환' : '멀리서 내 우주 보기로 전환'}
              aria-label={mode === 'nebula' ? '별들 가까이서 탐험하기로 전환' : '멀리서 내 우주 보기로 전환'}
            >
              <Orbit className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => openExplorer('diary')}
              aria-label="탐색 — 일기·별 찾기"
              title="탐색 — 일기·별 찾기"
              aria-expanded={explorerOpen}
              className={verticalBtnCls}
            >
              <Telescope className="size-5" />
            </button>
          </div>

          {/* === 좌상단 별가루·테마 알약 — 누르면 꾸미기 표면(스킨/감정 색). 실로그인은 잔액+팔레트, 데모는 팔레트만. === */}
          <button
            type="button"
            onClick={openAppearance}
            aria-label="테마·외형 열기"
            className="absolute left-4 top-[calc(1rem+env(safe-area-inset-top))] z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white/85 backdrop-blur transition hover:bg-black/60"
          >
            {!demoMode && (
              <span className="flex items-center gap-1 tabular-nums">
                <Sparkles className="size-3.5 text-amber-200/90" aria-hidden />
                {stardust}
              </span>
            )}
            <Palette className="size-4 text-white/80" aria-hidden />
          </button>

          {/* 이동 D-pad — 회상 모드 전용, 화면 가장자리. 표면/숨김 시 억제. */}
          <NavPad suppressed={navSuppressed} />

          {/* === 하단 중앙 floating 새 별 띄우기(A17) — 작성 폼(데모 제외 — DemoSimPanel이 기록 담당). === */}
          {!demoMode && (
            <button
              type="button"
              onClick={openCompose}
              className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-indigo-500/80 px-5 py-3 text-sm font-medium text-white shadow-lg backdrop-blur transition hover:bg-indigo-500"
            >
              <Plus className="size-4" aria-hidden />새 별 띄우기
            </button>
          )}
        </>
      )}

      {/* 모달 딤 백드롭 — 모달형 표면(탐색·작성·공유·선물·보내기·변천사) 뒤에 깔려 배경 + HUD 크롬
          (토글 포함, z-20)을 함께 흐린다. z-30 + DOM상 표면보다 앞 → 표면(z-30, 뒤)이 위에 또렷이 뜬다.
          탭하면 모달을 닫는다. 사이드바(자체 백드롭)·회상(비차단 포커스 딤)은 제외. */}
      {modalUp && <Backdrop className="z-30 backdrop-blur-sm" onDismiss={closeModalSurfaces} />}

      {/* === 사이드바·탐색·결과 표면 — HUD 숨김 시엔 모두 닫혀 있다(toggle이 정리). === */}
      <UniverseSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isDemo={demoMode}
        onSignOut={onSignOut}
        onLeaveDemo={leaveDemo}
        onMyPage={goMyPage}
        onShare={openShare}
        onGifts={openGifts}
        onDiary={goDiary}
      />

      <UniverseExplorerSheet
        open={explorerOpen}
        tab={explorerTab}
        onTab={setExplorerTab}
        onClose={() => setExplorerOpen(false)}
        onSelectDiary={frameDiary}
        onSelectStar={flyToStar}
      />

      {/* 꾸미기 — 좌상단 알약이 여는 집중 모달(스킨/감정 색, change 09). 모달이 열리면 UniverseCanvas는 언마운트된다. */}
      <AppearanceModal open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />

      {/* 만들기 — 작성 폼(데모 제외). 제목은 작성/검토 단계를 반영한다. */}
      {!demoMode && (
        <Surface
          open={composeOpen}
          title={composePhase === 'compose' ? '새 일기 — 별 띄우기' : '조각 확인 — 별 다듬기'}
          onClose={() => setComposeOpen(false)}
          place="top"
        >
          <MemoryForm />
        </Surface>
      )}

      {/* 회상 — 별 클릭(focus 머신 star). 별 → 조각 → 원본 + 변천사/보내기/다른 별들 동선(11·28·36). */}
      <Surface
        open={isStarFocus && !uiHidden}
        title="회상 — 원본 일기"
        onClose={() => focusActor.send({ type: 'DISMISS' })}
        place="top"
      >
        <MemoryPanel
          onOpenEvolution={(id) => useEvolutionStore.getState().open(id)}
          onSendStar={demoMode ? undefined : (id) => setSendMemoryId(id)}
          // "이 일기의 다른 별들 보기"(spec 28·39): SEE_DIARY_STARS → focus 머신 diary로 수렴(같은 일기 카드 + 조망).
          onSeeDiaryStars={(recordId) => {
            focusActor.send({ type: 'SEE_DIARY_STARS', recordId })
          }}
        />
      </Surface>

      {/* 변천사 타임랩스(24) — 회상의 "변천사 보기"가 useEvolutionStore.open으로 연다(회상 위에 겹침). */}
      <Surface
        open={evolutionOpen && !uiHidden}
        title="별 변천사 — 변한 것과 변하지 않은 것"
        onClose={() => useEvolutionStore.getState().close()}
        place="center"
        width="lg"
      >
        <EvolutionPanel />
      </Surface>
      {/* 소셜 — 우주 공개(35)·주고받은 별(36). 사이드바가 열고, 비차단 Surface로 뜬다(데모 제외). */}
      {!demoMode && (
        <Surface open={shareOpen} title="우주 공개" onClose={() => setShareOpen(false)} place="center" width="sm">
          <ShareUniverseBody />
        </Surface>
      )}
      {!demoMode && (
        <Surface open={giftsOpen} title="주고받은 별" onClose={() => setGiftsOpen(false)} place="center" width="sm">
          <StarGiftsBody />
        </Surface>
      )}
      {/* 별 보내기(36) — 회상의 "이 별 보내기"가 연다(회상 위에 겹침). */}
      {sendMemoryId && !uiHidden && (
        <Surface open title="별 보내기" onClose={() => setSendMemoryId(null)} place="center" width="sm">
          <SendStarBody memoryId={sendMemoryId} onClose={() => setSendMemoryId(null)} />
        </Surface>
      )}

      {/* 조망 중인 일기 카드(spec 31·39) — 포커스=일기면 하단에 뜬다. "목록"은 탐색 시트(일기 탭)를 다시 연다. */}
      {highlightedRecordId && !uiHidden && (
        <DiaryCard
          recordId={highlightedRecordId}
          onExpand={() => openExplorer('diary')}
          onClose={() => focusActor.send({ type: 'DISMISS' })}
        />
      )}

      {/* 시뮬레이션 패널(spec 19) — 데모에서만. 데모의 기록은 이 패널의 "별 띄우기"가 담당한다. */}
      {demoMode && !uiHidden && (
        <DemoSimPanel
          initialSimId={sim}
          onSheetChange={setDemoSheetOpen}
          suppressed={demoHudSuppressed}
          onQuietSettle={requestQuietSettle}
        />
      )}

      {/* 우주 로딩 — 응답 전의 빈 캔버스를 "별이 없다"로 오인시키지 않는다(1.1). */}
      {universe.isPending && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p className="animate-pulse rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white/70 backdrop-blur">
            우주를 불러오는 중…
          </p>
        </div>
      )}

      {/* 첫 로드 실패 — 침묵 금지(1.2): 에러 카드 + 재시도. */}
      {universe.isError && universeData === undefined && (
        <UniverseErrorCard>
          <p className="text-sm text-white/85">우주를 불러오지 못했어요.</p>
          <p className="text-xs break-all text-white/40">{errorMessage(universe.error)}</p>
          <button type="button" onClick={() => void universe.refetch()} className={primaryButtonCls}>
            다시 시도
          </button>
        </UniverseErrorCard>
      )}

      {universe.isSuccess && starCount === 0 && !uiHidden && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 text-center">
          <p className="text-sm text-white/55">
            아직 별이 없어요. 첫 일기를 적어 첫 별을 띄워보세요.
          </p>
        </div>
      )}
    </div>
  )
}
