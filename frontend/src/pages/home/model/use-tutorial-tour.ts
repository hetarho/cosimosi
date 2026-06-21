import { useEffect } from 'react'
import { useSelector } from '@xstate/react'
import {
  getTutorialStep,
  setTutorialStep,
  restartTutorial,
  completeTutorial,
  type DemoPersona,
  type DemoFlow,
} from '@/shared/lib/demo'
import { navigationActor, selectHeadingMode } from '@/widgets/universe-canvas'
import {
  TOUR_STEPS,
  selectStepIndex,
  selectPhaseIndex,
  selectPhaseMode,
  selectIsDone,
} from '@/widgets/demo-tour'
import { tourActor } from './tour-actor'
import type { UniverseSurfaces } from './use-universe-surfaces'

interface TutorialTourInput {
  demoMode: boolean
  demoTutorial: boolean
  demoPersona: DemoPersona
  demoClockDay: number
  setDemoFlowState: (f: DemoFlow) => void
  surfaces: UniverseSurfaces
}

// 둘러보기 진행(plan 48·change 13) — 진행은 tourActor(머신)가 소유하고, 페이지는 노출 상태(표면·모드·
// 지속성)만 파생한다. 자유모드 HUD의 관찰 상태를 이산 이벤트로 머신에 흘리고(domAction phase가 그 값으로
// 진행 판정), 머신이 노출하는 step/phase로 표면·카메라·지속성 부수효과를 일으킨다. 데모에서만 머신을 건드린다.
export function useTutorialTour({
  demoMode,
  demoTutorial,
  demoPersona,
  demoClockDay,
  setDemoFlowState,
  surfaces,
}: TutorialTourInput) {
  const { uiHidden, demoPopover, explorerOpen, closeSurfaces, setUiHidden, setExplorerTab, setExplorerOpen } =
    surfaces

  const tourStep = useSelector(tourActor, selectStepIndex)
  const tourPhaseIndex = useSelector(tourActor, selectPhaseIndex)
  const tourPhaseMode = useSelector(tourActor, selectPhaseMode)
  const tourDone = useSelector(tourActor, selectIsDone)

  // "다시 보기"(사이드바) — 자유모드에서 명시적으로 투어를 처음부터. flow=tutorial 진입이 아래 RESET으로
  // 머신을 step 0에 맞춘다.
  const replayTour = () => {
    restartTutorial()
    closeSurfaces()
    setDemoFlowState('tutorial')
  }
  // 튜토리얼 진입/재시작 시 머신을 저장된 step으로 맞춘다(새로고침 재개·다시 보기).
  useEffect(() => {
    if (demoTutorial) tourActor.send({ type: 'RESET', step: getTutorialStep() })
  }, [demoTutorial])
  // 자유모드 HUD의 관찰 상태를 머신에 이산 이벤트로 흘린다 — domAction phase가 이 값으로 진행을 판정한다.
  // 데모에서만 보낸다(실계정 우주에선 투어 머신을 건드리지 않는다 — plan 48). demoMode를 deps에 둬 데모
  // 진입 시 즉시 동기화하고, 비데모에선 싱글턴을 무변동으로 둔다.
  useEffect(() => {
    if (demoMode) tourActor.send({ type: 'UI_TOGGLED', hidden: uiHidden })
  }, [demoMode, uiHidden])
  useEffect(() => {
    if (demoMode) tourActor.send({ type: 'POPOVER_CHANGED', popover: demoPopover })
  }, [demoMode, demoPopover])
  useEffect(() => {
    if (demoMode) tourActor.send({ type: 'PERSONA_CHANGED', persona: demoPersona })
  }, [demoMode, demoPersona])
  useEffect(() => {
    if (demoMode) tourActor.send({ type: 'CLOCK_CHANGED', day: demoClockDay })
  }, [demoMode, demoClockDay])
  useEffect(() => {
    if (demoMode) tourActor.send({ type: 'EXPLORER_TOGGLED', open: explorerOpen })
  }, [demoMode, explorerOpen])
  // 진행 step을 데모 세션에 저장(새로고침 재개) — done이면 completeTutorial이 0으로 비우므로 건너뛴다.
  useEffect(() => {
    if (demoTutorial && !tourDone) setTutorialStep(tourStep)
  }, [demoTutorial, tourStep, tourDone])
  // phase가 기대하는 모드로 nav를 맞춘다(A7) — phase마다 재확정해 사용자가 도중에 시점을 바꿔도 교정한다.
  // heading(전환 중엔 향하는 모드)과 다를 때만 토글(중복 토글 없음).
  useEffect(() => {
    if (!demoTutorial || !tourPhaseMode) return
    if (selectHeadingMode(navigationActor.getSnapshot()) !== tourPhaseMode) {
      navigationActor.send({ type: 'TOGGLE_MODE' })
    }
  }, [demoTutorial, tourStep, tourPhaseIndex, tourPhaseMode])
  // 건너뛰기(EXIT)·마지막 단계 진행 → done. 자유모드로 수렴하고 열린 표면·UI 숨김·가까이서를 정리한다(A7).
  useEffect(() => {
    if (!demoTutorial || !tourDone) return
    const id = requestAnimationFrame(() => {
      completeTutorial()
      setDemoFlowState('free')
      closeSurfaces()
      setUiHidden(false)
      if (selectHeadingMode(navigationActor.getSnapshot()) === 'recall') {
        navigationActor.send({ type: 'TOGGLE_MODE' })
      }
    })
    return () => cancelAnimationFrame(id)
  }, [demoTutorial, tourDone, closeSurfaces, setDemoFlowState, setUiHidden])

  // 튜토리얼 단계 진입 시 표면 오케스트레이션(plan 48): 망원경 탭 단계만 탐색 시트를 자동으로 열고,
  // 나머지는 모든 표면을 닫는다. 페르소나/시간 팝오버는 사용자가 직접 버튼을 눌러 연다(행동 안내 —
  // 투어가 그 열림을 관찰해 다음 phase로 넘어간다). HUD 숨김도 풀어 다음 target이 보이게 복구한다(A8).
  useEffect(() => {
    if (!demoTutorial) return
    const surface = TOUR_STEPS[tourStep]?.surface ?? 'none'
    // setState는 rAF로 미뤄 effect 동기 setState(cascading render)를 피한다(이 페이지의 딥링크 effect와 같은 패턴).
    const id = requestAnimationFrame(() => {
      setUiHidden(false)
      closeSurfaces() // 팝오버·사이드바·시트 정리 후, 이 단계에 필요한 것만 다시 연다
      // 별 탭 단계만 페이지가 시트를 자동으로 연다(다른 표면은 사용자가 직접 버튼을 눌러 연다 — 행동 안내).
      if (surface === 'telescope-star') {
        setExplorerTab('star')
        setExplorerOpen(true)
      }
      // 항해 실습(view) segment를 벗어나면 기본 멀리서(nebula)로 정리(change 12 A7) — 실습이 가까이서로
      // 들여보낸 카메라를 다음 단계(망원경 등)에 맞게 되돌린다. view 단계의 모드는 phase 힌트가 구동한다.
      if (TOUR_STEPS[tourStep]?.id !== 'view' && selectHeadingMode(navigationActor.getSnapshot()) === 'recall') {
        navigationActor.send({ type: 'TOGGLE_MODE' })
      }
    })
    return () => cancelAnimationFrame(id)
  }, [demoTutorial, tourStep, closeSurfaces, setExplorerOpen, setExplorerTab, setUiHidden])

  return { replayTour }
}
