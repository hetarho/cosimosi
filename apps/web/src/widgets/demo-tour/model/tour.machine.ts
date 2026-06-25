// 첫 별 튜토리얼(plan 48·change 34) 진행 상태 머신 — step·phase 전이·게이팅·항해 실습 자동진행을 하나의
// 순수 FSM으로 둔다. 데모 우주와 실계정 최초 진입이 같은 머신을 공유하되, `tourContext`(demo/account)로
// 보이는 단계를 거른다(A16). 커서(stepIndex/phaseIndex)는 *필터된* 활성 단계 목록(activeSteps)을 가리킨다.
//
// 순수 TS(three/React/DOM 미의존, 헌법4) — TOUR_STEPS를 데이터로 두고 phase 종류별 상태로 진행을 모델링한다:
//  - routing      전이 허브(always로 현재 phase 종류로 라우팅; 커서가 끝을 넘으면 done)
//  - info         정보 phase(kind=info) — 오직 `다음`(NEXT)으로 진행 → can('NEXT')=true
//  - domAction    행동 phase(kind=action, 관찰 await) — 관찰값이 충족돼야 진행, NEXT 미처리 → can('NEXT')=false
//  - navPractice  시점 전환 항해 실습 — navSampler(invoke) 액터가 임계 도달 시 PRACTICE_MET 1회 전송
//  - done         투어 종료(건너뛰기 EXIT·마지막 단계 진행) — 페이지가 수렴시킨다(데모=free, 실계정=완료 저장)
// "행동 phase=행동으로만, 정보 phase=다음으로"가 구조다(A15): action phase는 NEXT를 처리하지 않으므로
// can('NEXT')=false, info phase만 NEXT 전이가 있어 true. UI는 snapshot.can('NEXT')만 보고 `다음`을 노출한다.
//
// 관찰 await는 페이지가 보내는 이산 이벤트로 context.observed를 갱신하면 domAction의 always 가드가 판정한다.
// 변화 기준(persona/clock/submitted)은 phase 진입 시 baseline을 떠놓고 비교한다. 항해 rAF 샘플링·표면
// open/close·카메라 lock 같은 DOM/cross-widget 부수효과는 ui/pages가 맡는다(navSampler provide + 노출 파생).
import { setup, assign, fromCallback, type EventObject, type SnapshotFrom } from 'xstate'
import { activeSteps, type TourAwait, type TourContext, type TourPhase, type TourStep } from './steps'

/** 항해 실습 await — navSampler 액터가 rAF로 관찰해 충족 판정한다(DOM 관찰형과 구분). */
const NAV_AWAITS = new Set<TourAwait>(['nebula-rotated', 'nebula-zoomed', 'recall-looked', 'recall-thrusted'])

/** navSampler(invoke) 액터 입력 — 현재 실습 phase의 await. ui가 provide하는 rAF 구현이 임계를 고른다. */
export interface NavSamplerInput {
  awaitId: TourAwait | null
}

/** 페이지가 보내는 현재 관찰 상태(데모 HUD·실계정 표면에서 파생). 진행 게이팅용 제어 플래그다. */
interface Observed {
  uiHidden: boolean
  popover: 'persona' | 'time' | null
  persona: string
  clockDay: number
  explorerOpen: boolean
  explorerTab: 'diary' | 'star'
  composeOpen: boolean
  composePhase: 'compose' | 'review'
  /** 제출 단조 카운터 — phase 진입 baseline과 다르면 그 사이 별 띄우기가 일어난 것(submitted await). */
  submittedSeq: number
  /** 현재 회상 포커스된 별 id(없으면 null). 튜토리얼 우주엔 방금 만든 별만 있어, 별을 누르면 곧 recall-open. */
  focusedStarId: string | null
}

interface Ctx {
  /** 활성 맥락 — 어느 단계 목록을 커서로 쓰는가(A16). RESET이 정한다. */
  tourContext: TourContext
  stepIndex: number
  phaseIndex: number
  /** 페이지가 이벤트로 동기화하는 현재 관찰값. */
  observed: Observed
  /** 변화 기준 await(persona-changed·time-moved·submitted)용 — domAction 진입 시점 스냅샷. */
  baseline: { persona: string; clockDay: number; submittedSeq: number }
}

type Ev =
  | { type: 'NEXT' } // 정보 phase 진행(`다음`)
  | { type: 'PREV' } // 이전 phase/step
  | { type: 'EXIT' } // 건너뛰기 → done
  | { type: 'RESET'; step: number; context: TourContext } // 진입/다시 보기 — 맥락+커서를 맞추고 재진입
  | { type: 'PRACTICE_MET' } // navSampler 액터: 항해 임계 도달
  | { type: 'UI_TOGGLED'; hidden: boolean }
  | { type: 'POPOVER_CHANGED'; popover: 'persona' | 'time' | null }
  | { type: 'PERSONA_CHANGED'; persona: string }
  | { type: 'CLOCK_CHANGED'; day: number }
  | { type: 'EXPLORER_TOGGLED'; open: boolean }
  | { type: 'EXPLORER_TAB_CHANGED'; tab: 'diary' | 'star' }
  | { type: 'COMPOSE_CHANGED'; open: boolean; phase: 'compose' | 'review' }
  | { type: 'SUBMITTED' }
  | { type: 'STAR_FOCUSED'; id: string | null }

const DEFAULT_OBSERVED: Observed = {
  uiHidden: false,
  popover: null,
  persona: '',
  clockDay: 0,
  explorerOpen: false,
  explorerTab: 'diary',
  composeOpen: false,
  composePhase: 'compose',
  submittedSeq: 0,
  focusedStarId: null,
}

function clampStep(n: number, context: TourContext): number {
  const len = activeSteps(context).length
  return Number.isInteger(n) && n >= 0 ? Math.min(n, len - 1) : 0
}

function stepsOf(c: Pick<Ctx, 'tourContext'>): TourStep[] {
  return activeSteps(c.tourContext)
}

function phaseAt(c: Pick<Ctx, 'tourContext' | 'stepIndex' | 'phaseIndex'>): TourPhase | undefined {
  return stepsOf(c)[c.stepIndex]?.phases[c.phaseIndex]
}

/** DOM 관찰 await가 (진입 baseline 대비) 현재 관찰값으로 충족됐는지. 항해 await·null은 여기서 false. */
function isObserveAwaitMet(a: TourAwait, o: Observed, b: Ctx['baseline']): boolean {
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
    case 'compose-open':
      return o.composeOpen
    case 'segmented':
      return o.composePhase === 'review'
    case 'submitted':
      return o.submittedSeq !== b.submittedSeq
    case 'recall-open':
      return o.focusedStarId != null // 튜토리얼 우주엔 방금 만든 별만 있어 어느 별을 눌러도 그 별이다
    case 'explorer-star-selected':
      return o.explorerOpen && o.explorerTab === 'star'
    default:
      return false
  }
}

export const tourMachine = setup({
  types: {
    context: {} as Ctx,
    events: {} as Ev,
    input: {} as { startStep?: number; context?: TourContext },
  },
  actors: {
    // 항해 실습 rAF 샘플러 — 모델은 순수해야 하므로(헌법4) 여기선 noop placeholder. 실제 구현(rAF로
    // navigation-input·항해 FSM 모드를 읽어 임계 도달 시 PRACTICE_MET)은 ui/pages가 provide한다.
    navSampler: fromCallback<EventObject, NavSamplerInput>(() => {}),
  },
  actions: {
    advance: assign(({ context }) => {
      const steps = stepsOf(context)
      const step = steps[context.stepIndex]
      if (!step) return {}
      if (context.phaseIndex < step.phases.length - 1) return { phaseIndex: context.phaseIndex + 1 }
      if (context.stepIndex < steps.length - 1) return { stepIndex: context.stepIndex + 1, phaseIndex: 0 }
      return { stepIndex: steps.length } // 끝을 넘김 → isComplete → done
    }),
    back: assign(({ context }) => {
      const steps = stepsOf(context)
      if (context.phaseIndex > 0) return { phaseIndex: context.phaseIndex - 1 }
      if (context.stepIndex > 0) {
        const prev = steps[context.stepIndex - 1]
        return { stepIndex: context.stepIndex - 1, phaseIndex: prev.phases.length - 1 }
      }
      return {}
    }),
    // 진입/다시 보기 — 맥락을 정하고 커서를 (clamp(step), 0)으로. observed는 페이지 브리지가 계속 최신이라 유지.
    reset: assign(({ event }) => {
      const context = event.type === 'RESET' ? event.context : 'demo'
      return { tourContext: context, stepIndex: clampStep(event.type === 'RESET' ? event.step : 0, context), phaseIndex: 0 }
    }),
    captureBaseline: assign({
      baseline: ({ context }) => ({
        persona: context.observed.persona,
        clockDay: context.observed.clockDay,
        submittedSeq: context.observed.submittedSeq,
      }),
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
    setExplorerTab: assign({
      observed: ({ context, event }) =>
        event.type === 'EXPLORER_TAB_CHANGED' ? { ...context.observed, explorerTab: event.tab } : context.observed,
    }),
    setCompose: assign({
      observed: ({ context, event }) =>
        event.type === 'COMPOSE_CHANGED'
          ? { ...context.observed, composeOpen: event.open, composePhase: event.phase }
          : context.observed,
    }),
    bumpSubmitted: assign({
      observed: ({ context }) => ({ ...context.observed, submittedSeq: context.observed.submittedSeq + 1 }),
    }),
    setFocused: assign({
      observed: ({ context, event }) =>
        event.type === 'STAR_FOCUSED' ? { ...context.observed, focusedStarId: event.id } : context.observed,
    }),
  },
  guards: {
    isComplete: ({ context }) => context.stepIndex >= stepsOf(context).length,
    isInfoPhase: ({ context }) => {
      const p = phaseAt(context)
      return p != null && p.kind === 'info'
    },
    isNavPhase: ({ context }) => {
      const p = phaseAt(context)
      return p != null && p.kind === 'action' && p.await != null && NAV_AWAITS.has(p.await)
    },
    observeMet: ({ context }) => {
      const p = phaseAt(context)
      return p != null && p.await != null && isObserveAwaitMet(p.await, context.observed, context.baseline)
    },
  },
}).createMachine({
  id: 'tour',
  context: ({ input }) => {
    const tourContext = input?.context ?? 'demo'
    return {
      tourContext,
      stepIndex: clampStep(input?.startStep ?? 0, tourContext),
      phaseIndex: 0,
      observed: { ...DEFAULT_OBSERVED },
      baseline: { persona: '', clockDay: 0, submittedSeq: 0 },
    }
  },
  initial: 'routing',
  // 관찰값 동기화(어느 상태에서든) — 페이지 브리지가 보낸다. 전이 없이 observed만 갱신 → 현재 domAction의
  // always 가드가 그 자리에서 재평가된다. RESET/EXIT은 어느 상태에서나 받는다.
  on: {
    RESET: { target: '.routing', actions: 'reset' },
    EXIT: '.done',
    UI_TOGGLED: { actions: 'setUi' },
    POPOVER_CHANGED: { actions: 'setPopover' },
    PERSONA_CHANGED: { actions: 'setPersona' },
    CLOCK_CHANGED: { actions: 'setClock' },
    EXPLORER_TOGGLED: { actions: 'setExplorer' },
    EXPLORER_TAB_CHANGED: { actions: 'setExplorerTab' },
    COMPOSE_CHANGED: { actions: 'setCompose' },
    SUBMITTED: { actions: 'bumpSubmitted' },
    STAR_FOCUSED: { actions: 'setFocused' },
  },
  states: {
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
      invoke: {
        src: 'navSampler',
        input: ({ context }) => ({ awaitId: phaseAt(context)?.await ?? null }),
      },
      on: {
        PRACTICE_MET: { target: 'routing', actions: 'advance' },
        PREV: { target: 'routing', actions: 'back' },
      },
    },
    done: {},
  },
})

type Snap = SnapshotFrom<typeof tourMachine>

// 파생 selector(컴포넌트 밖 정의 — 참조 안정). TOUR_STEPS는 모듈 상수라 phase 객체 참조가 안정적이다.
const ctxOf = (s: Snap) => ({ tourContext: s.context.tourContext })
export const selectActiveSteps = (s: Snap): TourStep[] => stepsOf(ctxOf(s))
export const selectStepIndex = (s: Snap): number => clampStep(s.context.stepIndex, s.context.tourContext)
export const selectPhaseIndex = (s: Snap): number => s.context.phaseIndex
export const selectTotal = (s: Snap): number => stepsOf(ctxOf(s)).length
export const selectPhase = (s: Snap): TourPhase | undefined => {
  const step = stepsOf(ctxOf(s))[selectStepIndex(s)]
  return step?.phases[Math.min(s.context.phaseIndex, step.phases.length - 1)]
}
export const selectStepId = (s: Snap): string => stepsOf(ctxOf(s))[selectStepIndex(s)]?.id ?? ''
export const selectTitle = (s: Snap): string => stepsOf(ctxOf(s))[selectStepIndex(s)]?.title ?? ''
export const selectSurface = (s: Snap) => stepsOf(ctxOf(s))[selectStepIndex(s)]?.surface ?? 'none'
/** 카메라 조작 잠금 — 현재 단계의 lockCamera(첫 별 클릭/회상 설명 전까지 true, A9·A12). done이면 해제. */
export const selectCameraLocked = (s: Snap): boolean =>
  !s.matches('done') && (stepsOf(ctxOf(s))[selectStepIndex(s)]?.lockCamera ?? false)
/** `다음` 노출 — info phase에서만 NEXT 전이가 있으므로 action/nav phase에선 false(A15를 구조로). */
export const selectCanNext = (s: Snap): boolean => s.can({ type: 'NEXT' })
/** `이전` 활성 — 첫 단계 첫 phase가 아니면 true. */
export const selectCanPrev = (s: Snap): boolean => !(s.context.stepIndex === 0 && s.context.phaseIndex === 0)
/** 항해 실습 구간 — UI가 딤·카드를 거의 투명하게 비운다. */
export const selectIsNavPractice = (s: Snap): boolean => s.hasTag('nav-practice')
/** 마지막 단계의 마지막 phase — `다음` 라벨을 "자유롭게 탐험하기"로. */
export const selectIsFinalPhase = (s: Snap): boolean => {
  const steps = stepsOf(ctxOf(s))
  const last = steps.length - 1
  return s.context.stepIndex === last && s.context.phaseIndex === steps[last].phases.length - 1
}
export const selectPhaseMode = (s: Snap): 'nebula' | 'recall' | undefined => selectPhase(s)?.mode
export const selectIsDone = (s: Snap): boolean => s.matches('done')
