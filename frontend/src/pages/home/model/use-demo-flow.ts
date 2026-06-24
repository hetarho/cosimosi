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
  beginDemoCompose,
  exitDemoMode,
  resetDemo,
  useDemoOverlay,
  getDemoClockSpeed,
  setDemoClockSpeed,
  ensureDemoGenesisArmed,
  isGenesisActive,
  GENESIS_HOURS_PER_SECOND,
  type DemoClockSpeed,
  type DemoPersona,
  type DemoFlow,
} from '@/shared/lib/demo'
import { VALUES } from '@/shared/config'
import { tickDemoClock, resetDemoExperience, switchDemoPersona } from '@/widgets/demo-sim'
import { toSynapseEdge, useSynapseStore } from '@/entities/synapse'
import { mapStar, refreshActivation, focusActor, universeInvalidateKey, dormantInvalidateKey, useMemoryStore } from '@/entities/memory'
import { composeActor } from '@/features/record-memory'
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
  // 30일 genesis 관전(change 28) — 자유모드 진입 시 빈 우주가 배속으로 30일을 살아간다. genesisActive
  // 동안 `새 별 띄우기`·배속 셀렉터가 잠기고(읽기/회상/카메라는 허용), 30일을 마치면 시계가 멈추고
  // 환영 안내(genesisWelcome)가 뜬 뒤 컨트롤이 열린다. 모듈 genesis 상태(비반응형)를 React로 미러한다.
  const [genesisActive, setGenesisActive] = useState(false)
  const [genesisWelcome, setGenesisWelcome] = useState(false)

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

  // genesis 배속 자동재생을 켠다 — 빈 우주 시드 + startGenesis(ensureDemoGenesisArmed)가 켜졌으면
  // 배속을 genesis 속도로 올리고 잠금 상태를 표면에 반영한다. 진입·리셋·새로고침 재개의 단일 경로.
  // genesis가 안 켜졌으면(튜토리얼·종료 후) 아무것도 하지 않고 false를 돌려준다.
  const armGenesisPlayback = useCallback((): boolean => {
    if (!ensureDemoGenesisArmed()) return false
    setDemoClockSpeed(GENESIS_HOURS_PER_SECOND)
    setClockSpeedState(GENESIS_HOURS_PER_SECOND)
    setGenesisActive(true)
    setGenesisWelcome(false)
    setDemoClockDay(0)
    return true
  }, [])

  // 자유모드 진입/새로고침 재개 — flow가 free가 되면(또는 free로 새로고침) genesis가 켜져 있는지
  // 보고 배속 재생을 무장한다. 튜토리얼→free(완료/건너뛰기)는 정적 코퍼스가 이미 시드돼 있어
  // ensureDemoGenesisArmed가 false라 무장하지 않는다(투어 우주 보존 — 회귀 경계).
  // setState는 rAF로 미뤄 effect 동기 setState(cascading render)를 피한다(HUD 모닝디프와 같은 패턴).
  useEffect(() => {
    if (!demoMode || demoFlow !== 'free') return
    const id = requestAnimationFrame(() => armGenesisPlayback())
    return () => cancelAnimationFrame(id)
  }, [demoMode, demoFlow, armGenesisPlayback])

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
  // (refreshActivation)은 두 경로로 나눠 setStars/setEdges 폭주를 막는다(헌법8, 렉 완화): 경계 step은
  // 공고화 refetch가 새 now로 다시 굽고, 경계 없는 step만 refreshMs로 throttle한다(아래 상세). 정수 일이
  // 바뀔 때만 React 상태로 끌어올려 tour CLOCK_CHANGED·overlay 재시뮬을 친다. 정지·겹쳐보기 중엔 루프를
  // 멈춘다. rAF는 탭이 가려지면 자동으로 멎어 누적 폭주가 없다(setInterval 대비 이점).
  useEffect(() => {
    if (!demoMode || demoOverlayOn) return
    if (demoFlow !== 'free' && demoFlow !== 'tutorial') return
    if (clockSpeed === 'paused') return
    const pullClockDay = () => setDemoClockDay((d) => (d === demoOffsetDays() ? d : demoOffsetDays()))
    let raf = 0
    let last = performance.now()
    let lastStep = last
    let lastRefresh = last
    let accumMs = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      // 매 프레임은 경과 실시간만 누적하고(프레임당 max_tick_ms로 캡 — 탭 복귀/스톨의 catch-up 폭주
      // 방지) 가상 시계는 멈춰 둔다. step_ms마다 한 번에 흘린다 — 사이 프레임엔 virtualNow가 고정이라
      // force-sim이 자리를 잡고(settle) 카메라·입력이 메인스레드를 쓴다(흐름 중 인터랙션 끊김 해소).
      // 매 프레임 시계를 전진시키면 별 반지름 목표가 매 프레임 바뀌어 force-sim이 영영 안 멎는다(렉).
      accumMs += Math.min(t - last, VALUES.demoClock.maxTickMs)
      last = t
      if (t - lastStep < VALUES.demoClock.stepMs) return
      lastStep = t
      const elapsed = accumMs
      accumMs = 0
      const genesisBefore = isGenesisActive()
      const boundaries = tickDemoClock(queryClient, elapsed) // offset 전진 + 04:00 경계마다 genesis 하루 + 공고화 + 무효화
      // 밝기 재파생을 두 경로로 나눠 setStars/setEdges 폭주를 막는다(렉 완화). ① 04:00 경계를 지난 step은
      // 공고화가 universe/dormant를 invalidate→refetch하고 applyUniverse가 새 now로 밝기를 다시 굽는다 —
      // 여기서 refreshActivation까지 부르면 같은 재파생을 한 step에 두 번 발화해 StarField·시냅스를 두 번
      // 재구성한다(고배속일수록 경계 step이 잦아 이중 비용↑). 그래서 경계 step은 건너뛴다. ② 경계 없는
      // step만 refreshActivation으로 밤 사이 밝기 드리프트를 굽되 refreshMs로 throttle한다(배속 무관 ≤2Hz —
      // 반감기 30일이라 그 간격 안의 밝기 변화는 비가시, 별 위치 드리프트는 layout이 매 프레임 따로 굴린다).
      if (boundaries === 0 && t - lastRefresh >= VALUES.demoClock.refreshMs) {
        refreshActivation() // 밤 사이 별·엣지 밝기를 새 now로 재파생(경계 step은 공고화 refetch가 대신)
        lastRefresh = t
      }
      pullClockDay() // 정수 일이 바뀌면 React 상태로(tour CLOCK_CHANGED·overlay 재시뮬)
      // genesis 30일 완료 감지(change 28) — 마지막 밤을 지나며 isGenesisActive가 false로 내려가면 시계를
      // 멈추고 환영 안내를 띄운다. 컨트롤(배속·새 별)은 genesisActive=false로 풀린다. 한 번만 발화한다.
      if (genesisBefore && !isGenesisActive()) {
        setDemoClockSpeed('paused')
        setClockSpeedState('paused')
        setGenesisActive(false)
        setGenesisWelcome(true)
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
  // "자유롭게 탐험해보기" → 빈 우주에서 30일 genesis를 재생한다(change 28): 데이터 출처(정적 코퍼스→빈
  // genesis)를 비우고 flow=free로 두면, 위 free-진입 effect가 armGenesisPlayback으로 genesis를 켠다.
  const chooseFree = () => {
    resetDemo()
    setFlow('free')
    // 출처 경계 스토어 리셋(필수) — 온보딩 동안 우주 쿼리는 정적 코퍼스를 렌더 스토어에 이미 시드해 둔다
    // (캔버스는 온보딩 오버레이 뒤에서도 마운트되고, flow≠free라 ensureSeeded가 성숙 코퍼스를 시드한다).
    // resetDemo는 데이터 모듈(baseStars)만 비우고 렌더 스토어는 그대로라, merge(무삭제 — 헌법2)가 빈
    // genesis로 refetch해도 그 정적 별들이 남아 "빈 우주에서 시작"이 깨진다(최초 진입에 디폴트 별이 보임).
    // 페르소나 전환·처음으로는 resetDemoExperience의 demo enter/exit가 모드 리스너(resetUniverseData)로
    // 스토어를 비우지만, chooseFree는 모드를 토글하지 않으므로 여기서 직접 비운다. applyUniverse가 빈
    // 우주를 다시 판정(loadedEmpty)해 첫 genesis 별이 탄생 연출을 받는다.
    useMemoryStore.getState().setStars([])
    useMemoryStore.getState().setLoadedEmpty(false)
    useSynapseStore.getState().setEdges([])
    // 같은 핸들러에서 동기로 무장한다 — genesisActive(잠금)·배속을 즉시 켜, 진입 첫 프레임에 `새 별 띄우기`가
    // 열려 보이는 레이스를 없앤다(effect의 rAF 무장은 새로고침 재개용 백스톱으로 남는다).
    armGenesisPlayback()
    void queryClient.invalidateQueries({ queryKey: universeInvalidateKey() })
    void queryClient.invalidateQueries({ queryKey: dormantInvalidateKey() })
  }
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
    // 새 페르소나로 genesis를 처음부터 다시 돌린다(A8) — switchDemoPersona가 리셋한 뒤 빈 우주 + 새
    // 난수로 genesis 재무장. 배속·clockDay·잠금 상태는 armGenesisPlayback이 맞춘다.
    armGenesisPlayback()
  }
  // 가상 시계 배속 선택(change 24) — 즉시 적용(모듈 시계가 다음 틱부터 그 속도로 흐르거나 정지).
  // 팝오버는 열어 둬 여러 배속을 바로 비교할 수 있게 한다(라이브 컨트롤).
  const selectClockSpeed = (speed: DemoClockSpeed) => {
    setDemoClockSpeed(speed)
    setClockSpeedState(speed)
  }
  // 처음으로 — 현재 페르소나·자유모드 유지, genesis를 처음부터 다시 돌린다(가상 시계·추가 별 0, 새
  // 난수 — A8). 온보딩으로 돌아가지 않는다. armGenesisPlayback이 빈 우주 재시드·배속·잠금을 맞춘다.
  const resetDemoToStart = () => {
    setDemoPopover(null)
    resetDemoExperience()
    armGenesisPlayback()
  }
  // 자유모드 하단 "새 별 띄우기"(change 25) — production 작성 폼을 read-only·프리셋으로 연다. 다음
  // 프리셋 일기를 골라(beginDemoCompose) 본문·날짜를 작성 머신에 주입한다(읽기전용). 이후 "별 나누기"
  // → 검토 → "별 띄우기"가 production과 같은 흐름으로 조각 별을 우주에 띄운다(데모는 서버 미호출 —
  // segment/submit 액터가 프리셋·demoRecordMemory로 분기). 폼 표면 열기는 HomePage가 openCompose로.
  const prepareDemoCompose = () => {
    if (genesisActive) return // genesis 관전 중엔 새 별 띄우기 잠금(A5) — 버튼도 disabled, 방어적으로 무동작
    // 진행 중(segmenting/submitting)이면 머신이 SET_BODY/SET_DATE를 무시하므로 프리셋만 소비되고 폼이
    // 어긋난다 — 그 짧은 창에서는 새 프리셋을 고르지 않고 진행 중인 작성이 끝나게 둔다(이중 클릭 방어).
    const snap = composeActor.getSnapshot()
    if (!snap.matches('composing') && !snap.matches('reviewing')) return
    const { body, entryDate } = beginDemoCompose()
    composeActor.send({ type: 'BACK_TO_COMPOSE' }) // reviewing 잔여 시 본문 단계로 (composing이면 무시)
    composeActor.send({ type: 'SET_BODY', body })
    composeActor.send({ type: 'SET_DATE', date: entryDate })
  }
  // 30일 genesis 완료 환영 안내를 닫는다 — 자유 작성·배속 컨트롤은 이미 genesisActive=false로 열려 있다.
  const dismissGenesisWelcome = () => setGenesisWelcome(false)
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
  }
}
