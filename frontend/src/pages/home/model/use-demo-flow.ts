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
  getDemoClockSpeed,
  setDemoClockSpeed,
  type DemoClockSpeed,
  type DemoPersona,
  type DemoFlow,
} from '@/shared/lib/demo'
import { VALUES } from '@/shared/config'
import { tickDemoClock, resetDemoExperience, switchDemoPersona } from '@/widgets/demo-sim'
import { toSynapseEdge } from '@/entities/synapse'
import {
  mapStar,
  refreshActivation,
  universeInvalidateKey,
  dormantInvalidateKey,
  recordsInvalidateKey,
  focusActor,
} from '@/entities/memory'
import { navigationActor, type Bridge } from '@/widgets/universe-canvas'
import type { DemoPopover } from '../ui/DemoFreeModeControls'

// 데모 진입 흐름(plan 47)·페르소나·겹쳐보기(spec 37)·자유모드 전환을 한 곳에 모은다. 비데모면 flow=free라
// 일반 우주 셸이 게이트 없이 그대로 렌더된다. 팝오버는 표면 훅이 소유하므로 setter만 받아 전환마다 닫는다.
export function useDemoFlow({ setDemoPopover }: { setDemoPopover: (p: DemoPopover) => void }) {
  const demoMode = isDemoMode()
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: '/' })
  const demoOverlayOn = useDemoOverlay((s) => s.on)

  // 데모 진입 흐름·페르소나는 온보딩↔자유모드 전환마다 리렌더가 필요해 상태로 둔다(flag의 동기 게터는 비반응형).
  const [demoFlow, setDemoFlowState] = useState<DemoFlow>(() => (demoMode ? getDemoFlow() : 'free'))
  // 항상 유효한 페르소나(비데모는 기본값 — 안 쓰임)라 null 분기가 없다.
  const [demoPersona, setDemoPersonaState] = useState<DemoPersona>(() => getDemoPersona())
  // 세션 내 불변인 페르소나 메타(라벨·태그라인) — 매 렌더 재생성 않게 1회 만든다(두 표면이 공유).
  const personaList = useMemo(() => demoPersonaList(), [])
  // 가상 시계 배속(change 24) — 셀렉터 하이라이트용 React 상태. 실제 흐름은 모듈 시계가 들고,
  // 아래 rAF 드라이버가 굴린다. 비반응형 모듈이라 진입 시점 값으로 시드한다.
  const [clockSpeed, setClockSpeedState] = useState<DemoClockSpeed>(() => getDemoClockSpeed())

  // 온보딩(선택 화면)은 not_started/persona_selected/tutorial_tbd에서만 HUD 대신 뜬다(plan 47 A1).
  // 'tutorial'·'free'는 자유모드 HUD를 그대로 띄우고, tutorial은 그 위에 스포트라이트 투어를 얹는다(plan 48).
  const demoOnboarding =
    demoMode &&
    (demoFlow === 'not_started' || demoFlow === 'persona_selected' || demoFlow === 'tutorial_tbd')
  const demoTutorial = demoMode && demoFlow === 'tutorial'
  // 가상 시계(spec 19·change 24) 경과일 — 배속 흐름이 시간을 흘리면 별 밝기/반지름이 그만큼 늙고,
  // 겹쳐보기도 재시뮬 대상이다(demoOverlayData가 virtualNowMs를 읽는다). 비반응형 모듈 시계라 정수 일이
  // 바뀔 때만 드라이버가 이 상태로 끌어올려(매 프레임 아님 — 헌법8) tour CLOCK_CHANGED·overlay 재시뮬을 친다.
  const [demoClockDay, setDemoClockDay] = useState(() => (demoMode ? demoOffsetDays() : 0))
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

  // 배속 흐름 드라이버(change 24) — 데모 자유/튜토리얼에서 rAF로 가상 시계를 굴린다. 매 프레임 경과
  // 실시간을 누적하고 04:00 경계마다 야간 공고화를 발화하되(tickDemoClock), 밝기·반지름 재파생
  // (refreshActivation)은 throttle해 setStars 폭주를 막는다(헌법8). 정수 일이 바뀔 때만 React 상태로
  // 끌어올려 tour CLOCK_CHANGED·overlay 재시뮬을 친다. 정지·겹쳐보기 중엔 루프를 멈춘다. rAF는 탭이
  // 가려지면 자동으로 멎어 누적 폭주가 없다(setInterval 대비 이점).
  useEffect(() => {
    if (!demoMode || demoOverlayOn) return
    if (demoFlow !== 'free' && demoFlow !== 'tutorial') return
    if (clockSpeed === 'paused') return
    const pullClockDay = () => setDemoClockDay((d) => (d === demoOffsetDays() ? d : demoOffsetDays()))
    let raf = 0
    let last = performance.now()
    let lastRefresh = last
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      // 탭이 가려졌다 돌아오거나(rAF 멎음) 메인스레드가 길게 멎으면 한 틱 elapsed가 거대해져 수십~수백
      // 밤을 한 번에 발화한다 — 상한으로 잘라 가려진 동안은 사실상 정지로 둔다(누적 폭주·UI 프리즈 방지).
      const elapsed = Math.min(t - last, VALUES.demoClock.maxTickMs)
      last = t
      const boundaries = tickDemoClock(queryClient, elapsed)
      if (t - lastRefresh >= VALUES.demoClock.refreshThrottleMs) {
        lastRefresh = t
        refreshActivation()
        pullClockDay()
      } else if (boundaries > 0) {
        pullClockDay() // 밤이 지났으면(공고화로 데이터 변경) 정수 일을 바로 끌어올린다
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [demoMode, demoFlow, demoOverlayOn, clockSpeed, queryClient])

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
    // 같은 페르소나면 switchDemoPersona가 no-op이라 시계도 리셋되지 않는다 — 시계 상태를 0으로
    // 강제하면 모듈 시계(여전히 진행 중)와 어긋나 드라이버가 곧 되돌리며 깜빡인다. 실제 전환만 리셋.
    if (id === getDemoPersona()) return
    switchDemoPersona(id)
    setDemoPersonaState(id)
    setClockSpeedState(getDemoClockSpeed()) // resetDemo가 배속을 기본으로 되돌리므로 셀렉터 동기화
    setDemoClockDay(0)
  }
  // 가상 시계 배속 선택(change 24) — 즉시 적용(모듈 시계가 다음 틱부터 그 속도로 흐르거나 정지).
  // 팝오버는 열어 둬 여러 배속을 바로 비교할 수 있게 한다(라이브 컨트롤).
  const selectClockSpeed = (speed: DemoClockSpeed) => {
    setDemoClockSpeed(speed)
    setClockSpeedState(speed)
  }
  // 처음으로 — 현재 페르소나·자유모드 유지, 가상 시계·추가 별 0(온보딩으로 돌아가지 않는다).
  const resetDemoToStart = () => {
    setDemoPopover(null)
    resetDemoExperience()
    setClockSpeedState(getDemoClockSpeed()) // resetDemoClock가 기본 배속으로 되돌린 값으로 동기화
    setDemoClockDay(0)
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
    clockSpeed,
    selectClockSpeed,
    resetDemoToStart,
    addDemoRandomStars,
    leaveDemo,
  }
}
