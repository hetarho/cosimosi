import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  isDemoMode,
  getDemoPersona,
  getDemoFlow,
  setDemoFlow,
  enterTutorialMode,
  demoPersonaList,
  demoOverlayData,
  demoOffsetDays,
  demoAddRandomStars,
  demoToday,
  exitDemoMode,
  resetDemo,
  useDemoOverlay,
  type DemoPersona,
  type DemoFlow,
} from '@/shared/lib/demo'
import { VALUES } from '@/shared/config'
import { runTimeSkip, resetDemoExperience, switchDemoPersona } from '@/widgets/demo-sim'
import { toSynapseEdge } from '@/entities/synapse'
import {
  mapStar,
  universeInvalidateKey,
  dormantInvalidateKey,
  recordsInvalidateKey,
  focusActor,
} from '@/entities/memory'
import { navigationActor, useViewport, type Bridge } from '@/widgets/universe-canvas'
import type { DemoPopover } from '../ui/DemoFreeModeControls'

// 데모 진입 흐름(plan 47)·페르소나·겹쳐보기(spec 37)·자유모드 전환을 한 곳에 모은다. 비데모면 flow=free라
// 일반 우주 셸이 게이트 없이 그대로 렌더된다. 팝오버는 표면 훅이 소유하므로 setter만 받아 전환마다 닫는다.
export function useDemoFlow({ setDemoPopover }: { setDemoPopover: (p: DemoPopover) => void }) {
  const demoMode = isDemoMode()
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: '/' })
  const requestQuietSettle = useViewport((s) => s.requestQuietSettle)
  const demoOverlayOn = useDemoOverlay((s) => s.on)

  // 데모 진입 흐름·페르소나는 온보딩↔자유모드 전환마다 리렌더가 필요해 상태로 둔다(flag의 동기 게터는 비반응형).
  const [demoFlow, setDemoFlowState] = useState<DemoFlow>(() => (demoMode ? getDemoFlow() : 'free'))
  // 항상 유효한 페르소나(비데모는 기본값 — 안 쓰임)라 null 분기가 없다.
  const [demoPersona, setDemoPersonaState] = useState<DemoPersona>(() => getDemoPersona())
  // 세션 내 불변인 페르소나 메타(라벨·태그라인) — 매 렌더 재생성 않게 1회 만든다(두 표면이 공유).
  const personaList = useMemo(() => demoPersonaList(), [])

  // 온보딩(선택 화면)은 not_started/persona_selected/tutorial_tbd에서만 HUD 대신 뜬다(plan 47 A1).
  // 'tutorial'·'free'는 자유모드 HUD를 그대로 띄우고, tutorial은 그 위에 스포트라이트 투어를 얹는다(plan 48).
  const demoOnboarding =
    demoMode &&
    (demoFlow === 'not_started' || demoFlow === 'persona_selected' || demoFlow === 'tutorial_tbd')
  const demoTutorial = demoMode && demoFlow === 'tutorial'
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

  // ── 데모 자유모드 흐름·컨트롤(plan 47) ──────────────────────────────────────────────
  // flow 전환은 sessionStorage(setDemoFlow)와 렌더 상태를 함께 옮긴다(새로고침에도 유지).
  const setFlow = useCallback((next: DemoFlow) => {
    setDemoFlow(next)
    setDemoFlowState(next)
  }, [])
  // 온보딩 1단계 페르소나 선택 → 그 우주로 전환(switchDemoPersona: 같은 id면 no-op, 아니면
  // 데이터 출처 리셋) 후 모드 선택 단계로. flow는 switchDemoPersona가 보존한다.
  const selectOnboardingPersona = (id: DemoPersona) => {
    switchDemoPersona(id)
    setDemoPersonaState(id)
    setFlow('persona_selected')
  }
  const chooseFree = () => setFlow('free')
  // 모드 선택 "기능 하나하나 알아보기" → 스포트라이트 투어 진입(plan 48): flow=tutorial, step 0.
  const chooseTutorial = () => {
    enterTutorialMode()
    setDemoFlowState('tutorial')
  }
  const backToModeSelect = () => setFlow('persona_selected')

  // 자유모드 좌상단 페르소나 전환 — 같은 리셋 경로, 자유모드 유지. 팝오버는 닫는다.
  // 같은 페르소나면 switchDemoPersona가 no-op(원천 getDemoPersona 기준 판정)이라 리셋이 안 일어난다.
  const switchFreePersona = (id: DemoPersona) => {
    setDemoPopover(null)
    switchDemoPersona(id)
    setDemoPersonaState(id)
  }
  // 시간 이동(하루/한 달) — 기존 하루 단위 배치 + 조용한 재안정화. 시간 이동은 별·선을 삭제하지 않는다(헌법2).
  const skipDemoDays = (days: number) => {
    setDemoPopover(null)
    runTimeSkip(queryClient, days, requestQuietSettle)
  }
  // 처음으로 — 현재 페르소나·자유모드 유지, 가상 시계·추가 별 0(온보딩으로 돌아가지 않는다).
  const resetDemoToStart = () => {
    setDemoPopover(null)
    resetDemoExperience()
  }
  // 자유모드 하단 "새 별 띄우기" — 폼/날짜·감정 선택 없이 랜덤 별 1~5개(values)를 즉시 추가하고
  // 우주·잠든 별·일기 목록 쿼리를 무효화해 즉시 반영한다(서버 쓰기 없음 — 헌법 데모 경계).
  const addDemoRandomStars = () => {
    const { randomStarMin, randomStarMax } = VALUES.demoFreeMode
    const count = randomStarMin + Math.floor(Math.random() * (randomStarMax - randomStarMin + 1))
    demoAddRandomStars(count, demoToday())
    void queryClient.invalidateQueries({ queryKey: universeInvalidateKey() })
    void queryClient.invalidateQueries({ queryKey: dormantInvalidateKey() })
    void queryClient.invalidateQueries({ queryKey: recordsInvalidateKey() })
  }
  // 체험 종료(데모) — 기존 SessionGate 핀과 같은 동선(더미 별 비우기 → 마케팅 랜딩).
  const leaveDemo = () => {
    exitDemoMode()
    resetDemo()
    void navigate({ to: '/landing' })
  }

  return {
    demoMode,
    demoFlow,
    setDemoFlowState,
    demoPersona,
    demoOnboarding,
    demoTutorial,
    demoClockDay,
    personaList,
    demoOverlaySides,
    selectOnboardingPersona,
    chooseFree,
    chooseTutorial,
    backToModeSelect,
    switchFreePersona,
    skipDemoDays,
    resetDemoToStart,
    addDemoRandomStars,
    leaveDemo,
  }
}
