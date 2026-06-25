import { useEffect, useRef } from 'react'
import { useSelector } from '@xstate/react'
import {
  getTutorialStep,
  setTutorialStep,
  restartTutorial,
  completeTutorial,
  type DemoPersona,
  type DemoFlow,
} from '@/shared/lib/demo'
import { completeFirstStarTour, resetFirstStarTour } from '@/shared/lib/tutorial'
import { setTourStarTarget } from '@/shared/lib'
import { navigationActor, selectHeadingMode, setTourCameraLocked } from '@/widgets/universe-canvas'
import { resetDemoExperience } from '@/widgets/demo-sim'
import {
  selectStepIndex,
  selectPhaseIndex,
  selectStepId,
  selectSurface,
  selectPhaseMode,
  selectCameraLocked,
  selectIsDone,
  activeSteps,
} from '@/widgets/demo-tour'
import { composeActor, selectPhase as selectComposePhase } from '@/features/record-memory'
import { focusActor, selectFocusedStarId, starsOfRecord, useMemoryStore } from '@/entities/memory'
import { tourActor } from './tour-actor'
import type { UniverseSurfaces } from './use-universe-surfaces'

interface TutorialTourInput {
  demoMode: boolean
  demoTutorial: boolean
  /** 실계정 첫 별 튜토리얼 활성(HomePage가 빈 우주·미완료에서 latch). */
  accountTutorial: boolean
  /** 실계정 user id — per-user 완료 상태 키(없으면 자동 시작 안 함, A2). */
  userId: string | null
  demoPersona: DemoPersona
  demoClockDay: number
  setDemoFlowState: (f: DemoFlow) => void
  /** 실계정 튜토리얼 활성 latch setter(완료=false, 다시 보기=true). */
  setAccountTourActive: (v: boolean) => void
  surfaces: UniverseSurfaces
}

// 첫 별 튜토리얼 진행 브리지(plan 48·change 34) — 데모 우주와 실계정 최초 빈 우주가 같은 tourActor(머신)를
// 공유한다. 진행은 머신이 소유하고, 페이지는 관찰 상태(표면·작성·회상·탭·카메라)를 이산 이벤트로 흘리고,
// 머신이 노출하는 step/surface/lock으로 표면·카메라·지속성 부수효과를 일으킨다. context(demo/account)는
// RESET이 정한다(A16 — account에선 데모 페르소나/시간 단계가 머신 차원에서 제외된다).
export function useTutorialTour({
  demoMode,
  demoTutorial,
  accountTutorial,
  userId,
  demoPersona,
  demoClockDay,
  setDemoFlowState,
  setAccountTourActive,
  surfaces,
}: TutorialTourInput) {
  const { uiHidden, demoPopover, explorerOpen, explorerTab, composeOpen, closeSurfaces, setUiHidden } = surfaces

  const active = demoTutorial || accountTutorial

  const tourStep = useSelector(tourActor, selectStepIndex)
  const tourPhaseIndex = useSelector(tourActor, selectPhaseIndex)
  const tourStepId = useSelector(tourActor, selectStepId)
  const tourSurface = useSelector(tourActor, selectSurface)
  const tourPhaseMode = useSelector(tourActor, selectPhaseMode)
  const tourLocked = useSelector(tourActor, selectCameraLocked)
  const tourDone = useSelector(tourActor, selectIsDone)
  const composePhase = useSelector(composeActor, selectComposePhase)
  const focusedStarId = useSelector(focusActor, selectFocusedStarId)
  const stars = useMemoryStore((s) => s.stars)

  // 생성된 첫 별 추적 — submitted payload의 recordId(프레이밍용)와 한 번만 프레이밍했는지(framed) 플래그.
  const trackedRecord = useRef<string | null>(null)
  const framed = useRef(false)

  // "다시 보기"(사이드바) — 데모는 고정 fixture를 다시 준비(빈 우주 → 첫 별 흐름 재진입), 실계정은 현재
  // 우주를 삭제하지 않는 비파괴 둘러보기로 다시 시작한다(A18). resetDemoExperience가 데모 데이터를 빈
  // 튜토리얼 우주로 다시 시드한다(ensureSeeded: tutorial → 빈 우주). restartTutorial을 먼저 둬 flow=tutorial.
  const replayTour = () => {
    if (demoMode) {
      restartTutorial()
      resetDemoExperience()
      closeSurfaces()
      setDemoFlowState('tutorial')
    } else {
      // 실계정 다시 보기 — 비파괴(A18): 우주를 삭제하지 않는다. RESET effect가 현재 우주 상태(별 유무)에
      // 맞춰 시작 단계를 정한다(빈 우주=첫 별 만들기부터, 별 있음=기존 별로 회상~조작법 둘러보기).
      resetFirstStarTour(userId)
      closeSurfaces()
      focusActor.send({ type: 'DISMISS' })
      setAccountTourActive(true)
    }
  }

  // 튜토리얼 진입/재시작 시 머신을 (시작 step, 맥락)으로 맞춘다. 데모는 저장된 step을 재개하되 생성/회상
  // 단계(작성 폼·생성 별 같은 휘발성 상태에 의존)는 새로고침 뒤 복원 불가라 첫 단계로 클램프한다. 실계정은
  // 빈 우주면 첫 별 만들기부터(step 0), 이미 별이 있으면(다시 보기) 생성 단계를 건너뛰고 기존 별로 시작한다(A18).
  useEffect(() => {
    if (!active) return
    if (demoTutorial) {
      const steps = activeSteps('demo')
      const telescope = steps.findIndex((s) => s.id === 'telescope')
      const saved = getTutorialStep()
      // telescope 이전(빈 우주·작성·생성·회상) 단계는 새로고침 시 휘발성 표면/별이 사라져 복원 불가 → 0부터.
      tourActor.send({ type: 'RESET', step: telescope >= 0 && saved < telescope ? 0 : saved, context: 'demo' })
      return
    }
    const steps = activeSteps('account')
    const existing = useMemoryStore.getState().stars
    if (existing.length > 0) {
      // 비파괴 둘러보기: 기존 별 하나를 생성 별 단계의 대상으로 삼아 회상~조작법을 안내한다(첫 별 만들기 생략).
      const star = existing[0]
      trackedRecord.current = star.memory.recordId || star.id
      framed.current = false
      setTourStarTarget(star.id)
      const generated = steps.findIndex((s) => s.id === 'generated-star')
      tourActor.send({ type: 'RESET', step: generated >= 0 ? generated : 0, context: 'account' })
    } else {
      tourActor.send({ type: 'RESET', step: 0, context: 'account' })
    }
  }, [active, demoTutorial])

  // 공통 관찰 신호(데모·실계정 모두) — domAction phase가 이 값으로 진행을 판정한다. active일 때만 보낸다.
  useEffect(() => {
    if (active) tourActor.send({ type: 'UI_TOGGLED', hidden: uiHidden })
  }, [active, uiHidden])
  useEffect(() => {
    if (active) tourActor.send({ type: 'EXPLORER_TOGGLED', open: explorerOpen })
  }, [active, explorerOpen])
  useEffect(() => {
    if (active) tourActor.send({ type: 'EXPLORER_TAB_CHANGED', tab: explorerTab })
  }, [active, explorerTab])
  useEffect(() => {
    if (active)
      tourActor.send({ type: 'COMPOSE_CHANGED', open: composeOpen, phase: composePhase === 'review' ? 'review' : 'compose' })
  }, [active, composeOpen, composePhase])
  useEffect(() => {
    if (active) tourActor.send({ type: 'STAR_FOCUSED', id: focusedStarId })
  }, [active, focusedStarId])

  // 데모 전용 관찰 신호(페르소나/시간 단계는 데모에만 존재 — A16). demoTutorial일 때만 보낸다.
  useEffect(() => {
    if (demoTutorial) tourActor.send({ type: 'POPOVER_CHANGED', popover: demoPopover })
  }, [demoTutorial, demoPopover])
  useEffect(() => {
    if (demoTutorial) tourActor.send({ type: 'PERSONA_CHANGED', persona: demoPersona })
  }, [demoTutorial, demoPersona])
  useEffect(() => {
    if (demoTutorial) tourActor.send({ type: 'CLOCK_CHANGED', day: demoClockDay })
  }, [demoTutorial, demoClockDay])

  // 별 띄우기 제출 → 생성된 첫 별을 추적한다(A8): submitted payload의 memoryIds[0]를 spotlight 투영 대상으로
  // 걸고(setTourStarTarget), 머신에 SUBMITTED를 보내 작성 단계를 진행시킨다. 실제 프레이밍은 별이 스토어에
  // 실린 뒤 아래 effect가 한다(account는 refetch 지연이 있다). 데모 fixture·실계정 실제 별 모두 같은 경로.
  useEffect(() => {
    if (!active) return
    const sub = composeActor.on('submitted', (e) => {
      const id = e.memoryIds[0]
      // id가 있으면 그 별을 프레이밍/하이라이트 대상으로 건다. 없어도(이론상 빈 fan-out) SUBMITTED는
      // 보내 작성 단계가 막히지 않게 한다(action phase는 `다음`이 없어 안 보내면 dead-end).
      if (id) {
        trackedRecord.current = e.recordId
        framed.current = false
        setTourStarTarget(id)
      }
      tourActor.send({ type: 'SUBMITTED' })
    })
    return () => sub.unsubscribe()
  }, [active])

  // 생성된 별이 스토어에 실리면 그 record의 별들을 조망 프레이밍한다(A7·A8) — force-sim 결과 위에서 동작하고
  // 서버 좌표를 새로 저장하지 않는다(헌법3). 한 번만(framed) 프레이밍한다.
  useEffect(() => {
    if (!active || framed.current) return
    const recordId = trackedRecord.current
    if (!recordId || starsOfRecord(stars, recordId).length === 0) return
    framed.current = true
    navigationActor.send({ type: 'FRAME_DIARY', recordId })
  }, [active, stars])

  // 진행 step을 데모 세션에 저장(새로고침 재개) — done이면 completeTutorial이 0으로 비우므로 건너뛴다.
  useEffect(() => {
    if (demoTutorial && !tourDone) setTutorialStep(tourStep)
  }, [demoTutorial, tourStep, tourDone])

  // 카메라 조작 lock(A9·A12) — 현재 단계의 lockCamera를 navigation-input에 반영한다(첫 별 클릭/회상 설명
  // 전까지 true, 그 뒤 false). cleanup으로 매번 풀지 않는다(연속 lock 단계 전환 때 잠깐 풀렸다 켜지는 창 방지) —
  // 값이 안 바뀌면 setter가 무동작이라 idempotent하고, 비활성/false 단계에선 위 식이 false를 넘긴다.
  useEffect(() => {
    setTourCameraLocked(active && tourLocked)
  }, [active, tourLocked])
  // 언마운트 시 안전하게 lock을 푼다(컴포넌트가 사라져도 카메라가 영영 잠기지 않게).
  useEffect(() => () => setTourCameraLocked(false), [])

  // 비활성화 정리 — 튜토리얼이 done이 아닌 경로(데모 flow 강제 전환·account latch off 등)로 꺼져도 캔버스
  // 별 target·추적 record를 비워, 재진입 시 옛 별로 잘못 프레이밍하지 않게 한다(stale target 방지).
  useEffect(() => {
    if (active) return
    setTourStarTarget(null)
    trackedRecord.current = null
    framed.current = false
  }, [active])

  // phase가 기대하는 카메라 모드로 nav를 맞춘다(view 항해 실습) — phase마다 재확정. lock이 풀린 단계에서만 의미.
  useEffect(() => {
    if (!active || !tourPhaseMode) return
    if (selectHeadingMode(navigationActor.getSnapshot()) !== tourPhaseMode) {
      navigationActor.send({ type: 'TOGGLE_MODE' })
    }
  }, [active, tourStep, tourPhaseIndex, tourPhaseMode])

  // 단계 진입 표면 오케스트레이션 — surface='none'이면 모든 표면을 닫고 포커스를 푼다, 'compose'/'recall'이면
  // 사용자가 연 표면(작성 폼·회상 패널)을 유지한다(닫지 않음). 망원경 단계는 'none'(진입 시 닫고 사용자가
  // 버튼으로 다시 연다 — 한 단계 안 4 phase로 시트가 유지된다). setState는 rAF로 미뤄 cascading render를 피한다.
  useEffect(() => {
    if (!active) return
    const id = requestAnimationFrame(() => {
      setUiHidden(false)
      if (tourSurface === 'none') {
        closeSurfaces()
        focusActor.send({ type: 'DISMISS' })
        // view 단계가 아닌데 recall(가까이서)에 있으면 기본 멀리서(nebula)로 정리(다음 단계 표면/별 프레이밍 기준).
        if (tourStepId !== 'view' && selectHeadingMode(navigationActor.getSnapshot()) === 'recall') {
          navigationActor.send({ type: 'TOGGLE_MODE' })
        }
      }
    })
    return () => cancelAnimationFrame(id)
  }, [active, tourStepId, tourSurface, closeSurfaces, setUiHidden])

  // 완료/건너뛰기(done) → 수렴. 카메라 lock·별 target을 풀고 표면/포커스/HUD를 정리한다. 데모는 free로,
  // 실계정은 per-user 완료 상태를 저장해 자동 재시작을 막는다(A17). setState는 rAF로 미뤄 cascading render를 피한다.
  useEffect(() => {
    if (!active || !tourDone) return
    const id = requestAnimationFrame(() => {
      setTourCameraLocked(false)
      setTourStarTarget(null)
      trackedRecord.current = null
      closeSurfaces()
      focusActor.send({ type: 'DISMISS' })
      setUiHidden(false)
      if (selectHeadingMode(navigationActor.getSnapshot()) === 'recall') {
        navigationActor.send({ type: 'TOGGLE_MODE' })
      }
      if (demoTutorial) {
        completeTutorial()
        setDemoFlowState('free')
      } else {
        completeFirstStarTour(userId)
        setAccountTourActive(false)
      }
    })
    return () => cancelAnimationFrame(id)
  }, [active, tourDone, demoTutorial, userId, closeSurfaces, setDemoFlowState, setAccountTourActive, setUiHidden])

  return { replayTour }
}
