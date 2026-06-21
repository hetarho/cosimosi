// 데모 둘러보기(plan 48) 진행 상태 머신 — step·phase 전이·게이팅·항해 실습 자동진행을 하나의
// 순수 FSM으로(change 13). 구버전은 DemoGuidedTour의 useState(phaseIndex)+여러 useEffect(DOM await
// 관찰·rAF 항해 샘플링)와 flag.ts의 tourStep이 같은 논리 상태를 두 곳에 표현해, `다음`으로 행동 phase를
// 건너뛰면 다음 phase가 깨진 맥락을 가리키는 엣지버그가 구조적으로 가능했다(tech/state-machines 경고).
//
// 순수 TS(three/React/DOM 미의존, 헌법4) — TOUR_STEPS를 데이터로 두고 (stepIndex, phaseIndex) 커서를
// context로 든다. phase 종류별 상태로 진행을 모델링한다:
//  - routing      전이 허브(always로 현재 phase 종류를 라우팅; 커서가 끝을 넘으면 done)
//  - info         정보 phase(await=null) — 오직 `다음`(NEXT)으로 진행 → can('NEXT')=true
//  - domAction    행동 phase(DOM 관찰 await) — 관찰값이 충족돼야 진행, NEXT 미처리 → can('NEXT')=false
//  - navPractice  시점 전환 항해 실습 — navSampler(invoke) 액터가 임계 도달 시 PRACTICE_MET 1회 전송
//  - done         투어 종료(건너뛰기 EXIT·마지막 단계 진행) — 페이지가 자유모드로 수렴시킨다
// 행동/실습 phase가 NEXT를 처리하지 않으므로 "행동 phase=행동으로만, 정보 phase=다음으로"가 구조가 된다
// (UI는 snapshot.can('NEXT')만 보고 `다음` 노출을 결정 — 명령형 분기 없음).
//
// 관찰 await는 페이지가 보내는 이산 이벤트(UI_TOGGLED·POPOVER_CHANGED·PERSONA_CHANGED·CLOCK_CHANGED·
// EXPLORER_TOGGLED)로 context.observed를 갱신하면, domAction의 always 가드가 충족을 판정한다. 변화 기준
// (persona/clock)은 phase 진입 시 baseline을 떠놓고 비교한다. 항해 실습 rAF 샘플링·표면 open/close·카메라
// 모드 구동 같은 DOM/cross-widget 부수효과는 ui/pages가 navSampler provide + 노출 상태 파생으로 맡는다.
import { setup, assign, fromCallback, type EventObject, type SnapshotFrom } from 'xstate'
import { TOUR_STEPS, type TourAwait, type TourPhase } from './steps'

/** 항해 실습 await — navSampler 액터가 rAF로 관찰해 충족 판정한다(DOM 관찰형과 구분). */
const NAV_AWAITS = new Set<TourAwait>(['nebula-rotated', 'nebula-zoomed', 'recall-looked', 'recall-thrusted'])

/** navSampler(invoke) 액터 입력 — 현재 실습 phase의 await. ui가 provide하는 rAF 구현이 임계를 고른다. */
export interface NavSamplerInput {
  awaitId: TourAwait | null
}

/** 페이지가 보내는 현재 관찰 상태(자유모드 HUD에서 파생). 데이터가 아니라 진행 게이팅용 제어 플래그다. */
interface Observed {
  uiHidden: boolean
  popover: 'persona' | 'time' | null
  persona: string
  clockDay: number
  explorerOpen: boolean
}

interface Ctx {
  stepIndex: number
  phaseIndex: number
  /** 페이지가 이벤트로 동기화하는 현재 관찰값. */
  observed: Observed
  /** 변화 기준 await(persona-changed·time-moved)용 — domAction 진입 시점 스냅샷. */
  baseline: { persona: string; clockDay: number }
}

type Ev =
  | { type: 'NEXT' } // 정보 phase 진행(`다음`)
  | { type: 'PREV' } // 이전 phase/step
  | { type: 'EXIT' } // 건너뛰기 → done
  | { type: 'RESET'; step: number } // 튜토리얼 진입/다시 보기 — 커서를 step으로 맞추고 재진입
  | { type: 'PRACTICE_MET' } // navSampler 액터: 항해 임계 도달
  | { type: 'UI_TOGGLED'; hidden: boolean }
  | { type: 'POPOVER_CHANGED'; popover: 'persona' | 'time' | null }
  | { type: 'PERSONA_CHANGED'; persona: string }
  | { type: 'CLOCK_CHANGED'; day: number }
  | { type: 'EXPLORER_TOGGLED'; open: boolean }

const DEFAULT_OBSERVED: Observed = { uiHidden: false, popover: null, persona: '', clockDay: 0, explorerOpen: false }

function clampStep(n: number): number {
  return Number.isInteger(n) && n >= 0 ? Math.min(n, TOUR_STEPS.length - 1) : 0
}

function phaseAt(c: Pick<Ctx, 'stepIndex' | 'phaseIndex'>): TourPhase | undefined {
  return TOUR_STEPS[c.stepIndex]?.phases[c.phaseIndex]
}

/** DOM 관찰 await가 (진입 baseline 대비) 현재 관찰값으로 충족됐는지. 항해 await·null은 여기서 false. */
function isObserveAwaitMet(a: TourAwait, o: Observed, b: { persona: string; clockDay: number }): boolean {
  switch (a) {
    case 'ui-hidden':
      return o.uiHidden
    case 'ui-shown':
      return !o.uiHidden
    case 'persona-open':
      return o.popover === 'persona'
    case 'persona-changed':
      return o.persona !== b.persona
    case 'time-open':
      return o.popover === 'time'
    case 'time-moved':
      return o.clockDay !== b.clockDay
    case 'explorer-open':
      return o.explorerOpen
    default:
      return false
  }
}

export const tourMachine = setup({
  types: {
    context: {} as Ctx,
    events: {} as Ev,
    input: {} as { startStep?: number },
  },
  actors: {
    // 항해 실습 rAF 샘플러 — 모델은 순수해야 하므로(헌법4: model은 DOM 미의존) 여기선 noop placeholder다.
    // 실제 구현(rAF로 navigation-input·항해 FSM 모드를 읽어 임계 도달 시 PRACTICE_MET)은 ui/pages가
    // tourMachine.provide({ actors: { navSampler } })로 주입한다.
    navSampler: fromCallback<EventObject, NavSamplerInput>(() => {}),
  },
  actions: {
    // 다음 phase로(같은 step) → 다음 step 첫 phase로 → 끝을 넘으면 stepIndex를 길이로(=isComplete→done).
    advance: assign(({ context }) => {
      const step = TOUR_STEPS[context.stepIndex]
      if (!step) return {}
      if (context.phaseIndex < step.phases.length - 1) return { phaseIndex: context.phaseIndex + 1 }
      if (context.stepIndex < TOUR_STEPS.length - 1) return { stepIndex: context.stepIndex + 1, phaseIndex: 0 }
      return { stepIndex: TOUR_STEPS.length }
    }),
    // 이전 phase로 → 이전 step 마지막 phase로 → 처음(0,0)에서 클램프.
    back: assign(({ context }) => {
      if (context.phaseIndex > 0) return { phaseIndex: context.phaseIndex - 1 }
      if (context.stepIndex > 0) {
        const prev = TOUR_STEPS[context.stepIndex - 1]
        return { stepIndex: context.stepIndex - 1, phaseIndex: prev.phases.length - 1 }
      }
      return {}
    }),
    // 튜토리얼 진입/다시 보기 — 커서를 (clamp(step), 0)으로. observed는 페이지 브리지가 계속 최신이라 유지.
    reset: assign(({ event }) => ({
      stepIndex: clampStep(event.type === 'RESET' ? event.step : 0),
      phaseIndex: 0,
    })),
    captureBaseline: assign({
      baseline: ({ context }) => ({ persona: context.observed.persona, clockDay: context.observed.clockDay }),
    }),
    setUi: assign({
      observed: ({ context, event }) =>
        event.type === 'UI_TOGGLED' ? { ...context.observed, uiHidden: event.hidden } : context.observed,
    }),
    setPopover: assign({
      observed: ({ context, event }) =>
        event.type === 'POPOVER_CHANGED' ? { ...context.observed, popover: event.popover } : context.observed,
    }),
    setPersona: assign({
      observed: ({ context, event }) =>
        event.type === 'PERSONA_CHANGED' ? { ...context.observed, persona: event.persona } : context.observed,
    }),
    setClock: assign({
      observed: ({ context, event }) =>
        event.type === 'CLOCK_CHANGED' ? { ...context.observed, clockDay: event.day } : context.observed,
    }),
    setExplorer: assign({
      observed: ({ context, event }) =>
        event.type === 'EXPLORER_TOGGLED' ? { ...context.observed, explorerOpen: event.open } : context.observed,
    }),
  },
  guards: {
    isComplete: ({ context }) => context.stepIndex >= TOUR_STEPS.length,
    isInfoPhase: ({ context }) => {
      const p = phaseAt(context)
      return p != null && p.await == null
    },
    isNavPhase: ({ context }) => {
      const p = phaseAt(context)
      return p != null && p.await != null && NAV_AWAITS.has(p.await)
    },
    observeMet: ({ context }) => {
      const p = phaseAt(context)
      return p != null && p.await != null && isObserveAwaitMet(p.await, context.observed, context.baseline)
    },
  },
}).createMachine({
  id: 'tour',
  context: ({ input }) => ({
    stepIndex: clampStep(input?.startStep ?? 0),
    phaseIndex: 0,
    observed: { ...DEFAULT_OBSERVED },
    baseline: { persona: '', clockDay: 0 },
  }),
  initial: 'routing',
  // 관찰값 동기화(어느 상태에서든) — 페이지 브리지가 보낸다. 전이는 없고 context.observed만 갱신 →
  // 현재 domAction의 always 가드가 그 자리에서 재평가된다. RESET/EXIT은 어느 상태에서나 받는다.
  on: {
    RESET: { target: '.routing', actions: 'reset' },
    EXIT: '.done',
    UI_TOGGLED: { actions: 'setUi' },
    POPOVER_CHANGED: { actions: 'setPopover' },
    PERSONA_CHANGED: { actions: 'setPersona' },
    CLOCK_CHANGED: { actions: 'setClock' },
    EXPLORER_TOGGLED: { actions: 'setExplorer' },
  },
  states: {
    // 전이 허브 — 매 진행 후 현재 phase 종류로 라우팅한다(커서가 끝을 넘으면 done). routing을 거쳐
    // 재진입하므로 navPractice의 invoke(navSampler)가 phase마다 새로 시작된다(baseline 갱신).
    routing: {
      always: [
        { guard: 'isComplete', target: 'done' },
        { guard: 'isInfoPhase', target: 'info' },
        { guard: 'isNavPhase', target: 'navPractice' },
        { target: 'domAction' },
      ],
    },
    info: {
      on: {
        NEXT: { target: 'routing', actions: 'advance' },
        PREV: { target: 'routing', actions: 'back' },
      },
    },
    domAction: {
      entry: 'captureBaseline',
      // 관찰값이 충족되는 순간(관찰 이벤트가 observed를 갱신한 직후) 자동 진행. NEXT는 받지 않는다.
      always: { guard: 'observeMet', target: 'routing', actions: 'advance' },
      on: {
        PREV: { target: 'routing', actions: 'back' },
      },
    },
    navPractice: {
      tags: 'nav-practice',
      // ui가 provide한 navSampler가 rAF로 항해를 관찰해 임계 도달 시 PRACTICE_MET를 보낸다(매 프레임
      // React state·머신 이벤트 없음 — 헌법4/60fps). routing 경유 재진입마다 새 baseline으로 다시 invoke.
      invoke: {
        src: 'navSampler',
        input: ({ context }) => ({ awaitId: phaseAt(context)?.await ?? null }),
      },
      on: {
        PRACTICE_MET: { target: 'routing', actions: 'advance' },
        PREV: { target: 'routing', actions: 'back' },
      },
    },
    // 종료 주차 상태(final 아님 — 다시 보기 RESET로 재진입 가능). 페이지가 진입을 감지해 자유모드로 수렴.
    done: {},
  },
})

type Snap = SnapshotFrom<typeof tourMachine>

// 파생 selector(컴포넌트 밖 정의 — 참조 안정). TOUR_STEPS는 모듈 상수라 phase 객체 참조가 안정적이다.
export const selectStepIndex = (s: Snap): number => clampStep(s.context.stepIndex)
export const selectPhaseIndex = (s: Snap): number => s.context.phaseIndex
export const selectPhase = (s: Snap): TourPhase | undefined => {
  const step = TOUR_STEPS[selectStepIndex(s)]
  return step?.phases[Math.min(s.context.phaseIndex, step.phases.length - 1)]
}
export const selectTitle = (s: Snap): string => TOUR_STEPS[selectStepIndex(s)]?.title ?? ''
/** `다음` 노출 — 정보 phase에서만 NEXT 전이가 있으므로 행동/실습 phase에선 false(point 1을 구조로). */
export const selectCanNext = (s: Snap): boolean => s.can({ type: 'NEXT' })
/** `이전` 활성 — 첫 단계 첫 phase가 아니면 true. */
export const selectCanPrev = (s: Snap): boolean => !(s.context.stepIndex === 0 && s.context.phaseIndex === 0)
/** 항해 실습 구간 — UI가 딤·카드를 거의 투명하게 비운다(point 3). */
export const selectIsNavPractice = (s: Snap): boolean => s.hasTag('nav-practice')
/** 마지막 단계의 마지막 phase — `다음` 라벨을 "자유롭게 탐험하기"로. */
export const selectIsFinalPhase = (s: Snap): boolean => {
  const last = TOUR_STEPS.length - 1
  return s.context.stepIndex === last && s.context.phaseIndex === TOUR_STEPS[last].phases.length - 1
}
export const selectPhaseMode = (s: Snap): 'nebula' | 'recall' | undefined => selectPhase(s)?.mode
export const selectIsDone = (s: Snap): boolean => s.matches('done')
