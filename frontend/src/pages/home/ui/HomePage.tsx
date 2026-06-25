import { useEffect, useState } from 'react'
import { useSelector } from '@xstate/react'
import * as Sentry from '@sentry/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { cn, errorMessage, reportUniverseData } from '@/shared/lib'
import { demoFragmentText, demoRecall, isDemoMode, useDemoOverlay } from '@/shared/lib/demo'
import { Eye, EyeOff, Menu, Orbit, Palette, Plus, Sparkles, Telescope } from 'lucide-react'
import { Backdrop, DebugTuner, MorningDiffNote, Surface, primaryButtonCls } from '@/shared/ui'
import {
  UniverseCanvas,
  UniverseGrain,
  UniverseOverlay,
  OverlayComparePanel,
  navigationActor,
  selectHeadingMode,
  useViewport,
} from '@/widgets/universe-canvas'
import { MemoryForm, composeActor, selectPhase } from '@/features/record-memory'
import { MemoryPanel, recallFlushActor } from '@/features/recall'
import { EvolutionPanel, useEvolutionStore } from '@/features/evolution'
import { DiaryCard } from '@/features/diary-list'
import { AppearancePanel } from './AppearancePanel'
import { useCoarsePointer } from '@/shared/ui/use-coarse-pointer'
import { UniverseSidebar } from './UniverseSidebar'
import { UniverseExplorerSheet } from './UniverseExplorerSheet'
import { DemoOnboarding } from './DemoOnboarding'
import { DemoFreeModeControls } from './DemoFreeModeControls'
import { DemoClockReadout } from './DemoClockReadout'
import { DemoGuidedTour } from '@/widgets/demo-tour'
import { tourActor } from '../model/tour-actor'
import { ShareUniverseBody } from '@/features/share-universe'
import { SendStarBody, StarGiftsBody } from '@/features/send-star'
import {
  applyUniverse,
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
import { NavPad } from './NavPad'
import { CanvasErrorFallback, UniverseErrorCard } from './CanvasErrorFallback'
import { claimMorningDiffForToday } from '../lib/morning-diff'
import { useUniverseSurfaces } from '../model/use-universe-surfaces'
import { useDemoFlow } from '../model/use-demo-flow'
import { useTutorialTour } from '../model/use-tutorial-tour'

// The universe shell (spec 10, extended by 11; IA re-laid-out by change 09): full-screen
// <UniverseCanvas/> (renders the stars from the memory store) + 2D HUD overlays OUTSIDE the R3F
// scene (Architecture §3.1). The universe loads via the GetUniverse query (16) — loading/error/
// retry UI here, merge-sync into the stores. change 09 IA: a top-right hamburger sidebar + vertical
// view controls (camera toggle · telescope), a top-center HUD hide toggle, a bottom-center floating
// 새 별 button, and a telescope explorer sheet (일기/별 tabs) that replaces the old menu + panels.
// 상태/이펙트는 책임별 훅으로 분리한다: useUniverseSurfaces(표면·Esc), useDemoFlow(데모 진입·페르소나·
// 겹쳐보기), useTutorialTour(둘러보기 진행 브리지). NavPad·에러 폴백·헬퍼는 형제 모듈로 분리.

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

  // 표면(작성·탐색·공유·선물·꾸미기·사이드바·HUD 숨김·팝오버) + 단일 Esc 라우터.
  const surfaces = useUniverseSurfaces()
  // 데모 진입 흐름·페르소나·겹쳐보기(plan 47·spec 37). 팝오버 setter만 넘겨 전환마다 닫는다.
  const demo = useDemoFlow({ setDemoPopover: surfaces.setDemoPopover })
  const {
    demoMode,
    demoFlow,
    setDemoFlowState,
    demoPersona,
    demoOnboarding,
    demoTutorial,
    demoClockDay,
    genesisActive,
    genesisWelcome,
    dismissGenesisWelcome,
    personaList,
    demoOverlaySides,
    selectOnboardingPersona,
    chooseFree,
    chooseTutorial,
    backToModeSelect,
    switchFreePersona,
    clockSpeed,
    selectClockSpeed,
    resetDemoToStart,
    prepareDemoCompose,
    leaveDemo,
  } = demo
  // 둘러보기 진행(plan 48·change 13) — 머신이 소유, 페이지는 노출 상태를 구독해 부수효과만.
  const { replayTour } = useTutorialTour({
    demoMode,
    demoTutorial,
    demoPersona,
    demoClockDay,
    setDemoFlowState,
    surfaces,
  })
  const {
    sidebarOpen,
    setSidebarOpen,
    explorerOpen,
    setExplorerOpen,
    explorerTab,
    setExplorerTab,
    uiHidden,
    composeOpen,
    setComposeOpen,
    shareOpen,
    setShareOpen,
    giftsOpen,
    setGiftsOpen,
    appearanceOpen,
    setAppearanceOpen,
    sendMemoryId,
    setSendMemoryId,
    demoPopover,
    setDemoPopover,
    evolutionOpen,
    closeSurfaces,
    openSidebar,
    openExplorer,
    openCompose,
    openShare,
    openGifts,
    openAppearance,
    toggleUiHidden,
    closeModalSurfaces,
    navSuppressed,
    modalUp,
  } = surfaces

  // ?sim=<id> — 랜딩 카드 "체험 우주에서 해보기"가 넘긴 이론 포커스(spec 19, 라우트가 검증).
  // ?panel=dormant|diary — 구 셸 딥링크(change 09 이전). 신규 UI는 망원경 탐색 시트로 흡수 →
  //   진입 시 1회 소비해 탐색 시트(별/일기 탭)를 열고 param을 비운다(legacy redirect).
  // ?record=<recordId> — 독립 일기 페이지 "우주에서 보기" 핸드오프(change 09): 그 record의 별을 frame-all.
  // ?fly=<memoryId> — 별 수락(spec 36) 후 내 우주로 돌아오며 새 별로 fly-to할 대상.
  const { panel: urlPanel, record: urlRecord, fly } = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })

  // 포커스 상태(focus 머신, spec 39) — 별 회상 선택 / 일기 조망. highlightedRecordId는 일기 카드
  // 렌더에, focused는 포커스 딤에, isStarFocus는 회상 표면 게이트에 쓴다.
  const highlightedRecordId = useSelector(focusActor, selectHighlightedRecordId)
  const focused = useSelector(focusActor, selectIsFocused)
  const isStarFocus = useSelector(focusActor, selectIsStarFocus)
  const composePhase = useSelector(composeActor, selectPhase)
  const stardust = useAppearance((s) => s.stardust)
  // 꾸미기 split layout 분기(change 10): 터치=하단 패널, 비터치(데스크톱)=좌측 사이드바.
  const coarsePointer = useCoarsePointer()

  // 사이드바 항목 — 마이페이지/일기는 라우트 이동, 공유/선물은 표면 전환. 모두 진입 전에 정리한다.
  const goMyPage = () => {
    closeSurfaces()
    void navigate({ to: '/my-page' })
  }
  const goDiary = () => {
    closeSurfaces()
    void navigate({ to: '/diary' })
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

  // 구 셸 딥링크(?panel=dormant|diary) 1회 소비 → 망원경 탐색 시트로 흡수(잠든 별 → 별 탭). param은 비운다.
  // setState는 rAF로 미뤄 effect 동기 setState(cascading render)를 피한다(모닝디프와 같은 패턴).
  useEffect(() => {
    if (!urlPanel) return
    const tab = urlPanel === 'dormant' ? 'star' : 'diary'
    // 열기(setState) 후 같은 프레임에서 param을 비운다 — navigate를 rAF 밖에 두면 panel 변경이 effect를
    // 재실행해 cleanup이 rAF를 취소(open 유실)한다. 둘을 rAF 안에 묶어 레이스를 없앤다.
    const id = requestAnimationFrame(() => {
      setExplorerTab(tab)
      setExplorerOpen(true)
      void navigate({ search: (prev) => ({ ...prev, panel: undefined }), replace: true })
    })
    return () => cancelAnimationFrame(id)
  }, [urlPanel, navigate, setExplorerTab, setExplorerOpen])

  // 독립 일기 페이지 "우주에서 보기" 핸드오프(?record=) — 그 record의 별이 스토어에 실리면(GetUniverse
  // 도착) 1회 frame-all 하고 param을 비운다(?fly와 같은 일회성 패턴). 좌표 권위는 클라 force-sim(헌법3).
  useEffect(() => {
    if (!urlRecord) return
    if (starsOfRecord(useMemoryStore.getState().stars, urlRecord).length === 0) return // 아직 안 실림 — 대기
    focusActor.send({ type: 'SELECT_DIARY', recordId: urlRecord })
    void navigate({ search: (prev) => ({ ...prev, record: undefined }), replace: true })
  }, [urlRecord, starCount, navigate])

  // 작성 폼(하단 시트)이 열려 있는 동안 캔버스에 알린다 — 모바일에선 별들이 화면 중앙에 있어 시트에
  // 가려지므로, 캔버스가 view offset+줌아웃으로 우주를 위로 올린다(sm 미만만).
  // Morning diff (6.1) — live universe only; demo's "밤 보내기" owns its own note.
  const [morningDiff, setMorningDiff] = useState(false)
  const setSheetOpen = useViewport((s) => s.setSheetOpen)
  useEffect(() => {
    setSheetOpen(composeOpen && !uiHidden)
    return () => setSheetOpen(false)
  }, [composeOpen, uiHidden, setSheetOpen])

  // 데모: 별을 띄우면(compose 'submitted') 프리셋 작성 폼을 닫는다 — 한 편을 끝내면 우주로 돌아가
  // 결과를 본다(실계정은 연속 작성을 위해 폼을 유지하므로 데모일 때만). 머신 싱글턴 이벤트 구독.
  useEffect(() => {
    const sub = composeActor.on('submitted', () => {
      if (isDemoMode()) setComposeOpen(false)
    })
    return () => sub.unsubscribe()
  }, [setComposeOpen])

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
      {/* dev 라이브 셰이더 튜너(스캐폴딩) — 별/나 셰이더 상수를 슬라이더로 즉시 조절. 프로덕션 빌드엔 미포함. */}
      {import.meta.env.DEV && <DebugTuner />}
      {/* 캔버스 + 꾸미기 패널 split layout(change 10). 꾸미기 패널이 열려도 `UniverseCanvas`는 언마운트되지
          않는다 — 패널은 우주를 덮지 않고 레이아웃을 밀어내, 캔버스 컨테이너의 폭/높이만 줄인다. 데스크톱(fine
          pointer)=좌측 사이드바 + 우측 캔버스, 모바일(coarse)=상단 캔버스 + 하단 패널. 캔버스는 기존
          ResizeObserver로 새 컨테이너 크기에 맞춰 renderer size·camera aspect를 갱신한다(projection offset 미사용).
          바운더리는 Canvas에만(17). HUD 숨김은 캔버스를 언마운트하지 않는다(A14) — HUD DOM만 가린다. */}
      <div className={cn('absolute inset-0 flex', appearanceOpen && coarsePointer ? 'flex-col' : 'flex-row')}>
        {appearanceOpen && !coarsePointer && (
          <AppearancePanel placement="side" onClose={() => setAppearanceOpen(false)} />
        )}
        <div className="relative min-h-0 min-w-0 flex-1">
          <Sentry.ErrorBoundary fallback={CanvasErrorFallback}>
            <UniverseCanvas />
          </Sentry.ErrorBoundary>
          {/* Film grain over the canvas — above the canvas, below the HUD, pointer-events:none. */}
          <UniverseGrain />
        </div>
        {appearanceOpen && coarsePointer && (
          <AppearancePanel placement="bottom" onClose={() => setAppearanceOpen(false)} />
        )}
      </div>

      {/* 포커스 딤 — 별 회상·일기 조망 중 은은히 어둡힌다. pointer-events-none이라 별 탭은 통과. */}
      {focused && !uiHidden && <Backdrop className="z-10" />}

      {/* === 상단 중앙 HUD 숨김/보이기 토글(A13) — 숨김 상태에서도 보이는 유일한 컨트롤. 모달이 뜨면
          z-30 백드롭이 이 토글까지 덮어 함께 흐려진다(z-20). 데모 온보딩(자유모드 전)·꾸미기 패널 중에는 숨긴다. === */}
      {!demoOnboarding && !appearanceOpen && (
        <div className="absolute left-1/2 top-[calc(1rem+env(safe-area-inset-top))] z-20 flex -translate-x-1/2 flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={toggleUiHidden}
            data-tour-id="ui-toggle"
            aria-pressed={uiHidden}
            title={uiHidden ? 'UI 보이기' : 'UI 숨기기'}
            aria-label={uiHidden ? 'UI 보이기' : 'UI 숨기기'}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/70 backdrop-blur transition hover:bg-black/60"
          >
            {uiHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            <span>{uiHidden ? 'UI 보이기' : 'UI 숨기기'}</span>
          </button>
          {/* 데모 가상 시계 읽기값 — 배속 흐름을 눈으로 확인(HUD 숨김 시 함께 숨는다). */}
          {demoMode && !uiHidden && <DemoClockReadout />}
        </div>
      )}

      {!uiHidden && !demoOnboarding && !appearanceOpen && (
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
              data-tour-id="view"
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
              data-tour-id="telescope"
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
            data-tour-id="theme"
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

          {/* === 데모 자유모드 좌상단 컨트롤(plan 47) — 테마 알약 아래 페르소나·시간 버튼(팝오버). === */}
          {demoMode && (
            <DemoFreeModeControls
              open={demoPopover}
              onOpen={setDemoPopover}
              persona={demoPersona}
              personaList={personaList}
              onSelectPersona={switchFreePersona}
              speed={clockSpeed}
              onSelectSpeed={selectClockSpeed}
              onResetToStart={resetDemoToStart}
              genesisActive={genesisActive}
            />
          )}

          {/* 이동 D-pad — 회상 모드 전용, 화면 가장자리. 표면/숨김 시 억제. */}
          <NavPad suppressed={navSuppressed} />

          {/* === 하단 중앙 floating 새 별 띄우기(A17) — 실로그인·데모 모두 작성 폼을 연다. 데모는
              프리셋 일기를 주입(read-only)한 뒤 같은 폼을 띄운다(change 25). genesis 관전 중(change 28)엔
              잠긴다 — 30일을 마쳐야 자유 작성이 열린다(읽기·회상·카메라는 그대로 허용). === */}
          <button
            type="button"
            disabled={genesisActive}
            onClick={
              demoMode
                ? () => {
                    prepareDemoCompose()
                    openCompose()
                  }
                : openCompose
            }
            data-tour-id="new-star"
            title={genesisActive ? '30일 genesis 관전 중 — 곧 직접 별을 띄울 수 있어요' : undefined}
            className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-indigo-500/80 px-5 py-3 text-sm font-medium text-white shadow-lg backdrop-blur transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-indigo-500/80"
          >
            <Plus className="size-4" aria-hidden />새 별 띄우기
          </button>
        </>
      )}

      {/* 모달 딤 백드롭 — 모달형 표면(탐색·작성·공유·선물·보내기·변천사) 뒤에 깔려 배경 + HUD 크롬
          (토글 포함, z-20)을 함께 흐린다. z-30 + DOM상 표면보다 앞 → 표면(z-30, 뒤)이 위에 또렷이 뜬다.
          탭하면 모달을 닫는다. 사이드바(자체 백드롭)·회상(비차단 포커스 딤)은 제외. */}
      {/* 튜토리얼 중 tour가 연 시트(망원경 일기/별 탭)는 바깥 탭으로 닫히지 않게 한다 — dim이
          pointer-events-none이라 빈 곳 탭이 이 백드롭에 닿아 시트를 닫으면 하이라이트 대상이 사라진다.
          onDismiss 없는 백드롭은 시각 전용(pointer-events-none)이라 탭이 통과한다. */}
      {modalUp && (
        <Backdrop
          className="z-30 backdrop-blur-sm"
          onDismiss={demoTutorial ? undefined : closeModalSurfaces}
        />
      )}

      {/* === 사이드바·탐색·결과 표면 — HUD 숨김 시엔 모두 닫혀 있다(toggle이 정리). === */}
      <UniverseSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isDemo={demoMode}
        onSignOut={onSignOut}
        onLeaveDemo={leaveDemo}
        onReplayTour={replayTour}
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

      {/* 꾸미기 패널은 위 split layout(캔버스 sibling)으로 렌더된다 — 전면 모달 아님(change 10). 감정 색은 /my-page. */}

      {/* 만들기 — 작성 폼. 실계정은 자유 입력, 데모는 read-only 프리셋 일기(change 25). 같은 폼·흐름.
          제목은 작성/검토 단계를 반영한다. */}
      <Surface
        open={composeOpen}
        title={composePhase === 'compose' ? '새 일기 — 별 띄우기' : '조각 확인 — 별 다듬기'}
        onClose={() => setComposeOpen(false)}
        place="top"
      >
        <MemoryForm />
      </Surface>

      {/* 회상 — 별 클릭(focus 머신 star). 별 → 조각 → 원본 + 변천사/보내기/다른 별들 동선(11·28·36). 기본 표시는
          별의 조각/흐려진 내용이라(원본 전체 아님) 제목은 "회상"만 — 원본 전체는 패널 안 "원본 일기 전체 보기"로 펼친다. */}
      <Surface
        open={isStarFocus && !uiHidden}
        title="회상"
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

      {/* 데모 최초 온보딩(plan 47) — 자유모드(free) 전이면 우주 HUD 대신 페르소나/모드 선택을 먼저
          보인다. 캔버스는 뒤에서 계속 돈다. 자유모드로 들어가면 위 HUD가 그대로 살아난다. */}
      {demoOnboarding && (
        <DemoOnboarding
          flow={demoFlow}
          persona={demoPersona}
          personaList={personaList}
          onSelectPersona={selectOnboardingPersona}
          onChooseFree={chooseFree}
          onChooseTutorial={chooseTutorial}
          onBackToModeSelect={backToModeSelect}
        />
      )}

      {/* 30일 genesis 완료 환영(change 28) — 빈 우주에서 30일을 함께 산 뒤, 시계가 멈추고 이 안내가
          뜬다. 닫으면 `새 별 띄우기`·배속 컨트롤이 열려 자유모드가 평소대로 동작한다(이미 풀려 있다). */}
      {genesisWelcome && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="30일 genesis 완료"
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
        >
          <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-white/10 bg-black/70 p-7 text-center">
            <Sparkles className="size-7 text-amber-200/90" aria-hidden />
            <header className="flex flex-col gap-2">
              <h2 className="font-display text-2xl text-white/90">30일을 함께 보냈어요</h2>
              <p className="text-sm text-white/55">
                빈 하늘에서 시작한 우주가 하루하루 별로 채워졌어요. 이제 당신의 별을 띄워보세요.
              </p>
            </header>
            <button
              type="button"
              onClick={() => {
                dismissGenesisWelcome()
                prepareDemoCompose() // genesis 종료로 genesisActive=false → 가드 통과, 프리셋 작성 폼 준비
                openCompose()
              }}
              className={primaryButtonCls}
            >
              내 별 띄우기
            </button>
          </div>
        </div>
      )}

      {/* 데모 튜토리얼 스포트라이트 투어(plan 48) — 자유모드 HUD 위에 얹히는 안내 레이어.
          캔버스·HUD는 그대로 살아 있고(언마운트 안 함), 단계마다 버튼을 하나씩 짚는다. */}
      {demoTutorial && <DemoGuidedTour actor={tourActor} />}

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

      {/* 빈 우주 안내 — genesis 관전 중엔 숨긴다(곧 별이 태어나고, 사용자가 쓸 수 없는 단계라 "첫 일기를
          적어"가 어긋난다). genesis가 끝나면 환영 안내가 작성을 안내한다. */}
      {universe.isSuccess && starCount === 0 && !uiHidden && !genesisActive && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 text-center">
          <p className="text-sm text-white/55">
            아직 별이 없어요. 첫 일기를 적어 첫 별을 띄워보세요.
          </p>
        </div>
      )}
    </div>
  )
}
