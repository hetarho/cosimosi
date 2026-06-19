// Demo("체험") 모드 플래그 — DB/로그인 없이 우주를 둘러보게 하는 스위치.
// 진입점은 랜딩의 "체험해보기" 버튼이고, 켜지면 아래 API 래퍼들이 백엔드 대신
// 프런트 더미데이터(shared/demo/data)를 돌려준다. sessionStorage에 보관해 라우트
// 이동/리렌더에는 유지되고, 새로고침(모듈 리로드)하면 base 데이터가 다시 생성되며
// 체험 중 추가한 별은 사라진다(요구사항: state로만, 새로고침하면 소멸).
//
// 셸이 아니라 model 계층의 순수 모듈이라 three/React/DOM 의존이 없다(헌법 §4).
// 모듈 로드 시 한 번만 sessionStorage를 읽어 동기 게터로 노출한다 — get-universe 등
// API 함수가 await 없이 분기할 수 있어야 하기 때문.

const KEY = 'cosimosi:demo'
const PERSONA_KEY = 'cosimosi:demo-persona'
const FLOW_KEY = 'cosimosi:demo-flow'
const TOUR_STEP_KEY = 'cosimosi:demo-tour-step'

/** 체험 우주의 주인공. 같은 화면 코드가 페르소나마다 다른 일기 흐름(personas.ts)을 시드한다. */
export type DemoPersona = 'student' | 'worker' | 'homemaker'
const PERSONA_IDS: DemoPersona[] = ['student', 'worker', 'homemaker']
const DEFAULT_PERSONA: DemoPersona = 'student' // 가장 조밀·밝은 우주 — 첫인상 쇼케이스

/** 체험 진입 흐름(plan 47·48). 데모 세션에만 저장하고 실계정·서버엔 안 남긴다.
 *  - not_started: 데모는 켜졌지만 온보딩 미완료(누구의 우주를 볼지 고르기 전).
 *  - persona_selected: 페르소나는 골랐고 모드(튜토리얼/자유) 선택 대기.
 *  - free: 자유모드 — change09 우주 셸을 그대로 둘러본다.
 *  - tutorial_tbd: (plan 47) 튜토리얼 버튼을 눌렀지만 준비 중 안내만(자유모드로 복귀 가능).
 *  - tutorial: (plan 48) 스포트라이트 투어 진행 중. */
export type DemoFlow = 'not_started' | 'persona_selected' | 'free' | 'tutorial_tbd' | 'tutorial'
const FLOW_VALUES: DemoFlow[] = ['not_started', 'persona_selected', 'free', 'tutorial_tbd', 'tutorial']
const DEFAULT_FLOW: DemoFlow = 'not_started'

function readPersisted(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(KEY) === '1'
  } catch {
    return false // private 모드 등 sessionStorage 접근 불가 → 일반 모드로 안전 폴백
  }
}

function readPersona(): DemoPersona {
  try {
    const v = sessionStorage.getItem(PERSONA_KEY)
    return PERSONA_IDS.includes(v as DemoPersona) ? (v as DemoPersona) : DEFAULT_PERSONA
  } catch {
    return DEFAULT_PERSONA
  }
}

function readFlow(): DemoFlow {
  try {
    const v = sessionStorage.getItem(FLOW_KEY)
    return FLOW_VALUES.includes(v as DemoFlow) ? (v as DemoFlow) : DEFAULT_FLOW
  } catch {
    return DEFAULT_FLOW
  }
}

function readTourStep(): number {
  try {
    const n = Number(sessionStorage.getItem(TOUR_STEP_KEY))
    return Number.isInteger(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

let demo = readPersisted()
let persona = readPersona()
let flow = readFlow()
let tourStep = readTourStep()

// 모드가 실제로 바뀔 때 호출되는 콜백. 데이터 출처(체험 더미 ↔ 실서버)가 바뀌면 쿼리
// 캐시·렌더 스토어를 리셋해야 하는데(16 — 둘은 같은 쿼리 키를 공유한다), 그 리셋은 app
// 레이어 소유다. shared가 app을 import할 수 없으므로(상향 금지) app이 여기로 주입한다.
type DemoModeListener = () => void
let onModeChange: DemoModeListener | null = null

/** 모드 전환 콜백 등록(app 부팅 시 1회). null로 해제. */
export function setDemoModeListener(cb: DemoModeListener | null): void {
  onModeChange = cb
}

/** 현재 체험 모드인가. API 래퍼·세션 게이트가 동기로 호출한다. */
export function isDemoMode(): boolean {
  return demo
}

/** 체험 모드 진입(랜딩 "체험해보기"). 이후 라우트 이동에도 유지된다. */
export function enterDemoMode(): void {
  if (demo) return
  demo = true
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* 저장 실패해도 메모리 플래그로 이번 세션은 동작 */
  }
  onModeChange?.()
}

/** 체험 종료(랜딩 복귀). 추가했던 더미 별도 함께 비운다. 온보딩/튜토리얼 흐름 상태도 함께
 *  지운다 — 다음 체험 진입이 처음(온보딩)부터 시작하도록(plan 47·48). */
export function exitDemoMode(): void {
  if (!demo) return
  demo = false
  flow = DEFAULT_FLOW
  tourStep = 0
  try {
    sessionStorage.removeItem(KEY)
    sessionStorage.removeItem(FLOW_KEY)
    sessionStorage.removeItem(TOUR_STEP_KEY)
  } catch {
    /* noop */
  }
  onModeChange?.()
}

/** 현재 체험 페르소나. ensureSeeded가 동기로 읽어 해당 코퍼스를 시드한다. */
export function getDemoPersona(): DemoPersona {
  return persona
}

/** 페르소나 전환 — sessionStorage에만 반영한다(동기 게터 일관). 데이터 출처가 바뀌므로
 *  실제 우주 재시드/캐시 리셋은 호출자(스위처)가 resetDemo + 모드 리스너 경유로 처리한다
 *  (여기서 onModeChange를 직접 부르면 base를 비우기 전에 refetch가 옛 페르소나를 읽는다). */
export function setDemoPersona(next: DemoPersona): void {
  if (persona === next) return
  persona = next
  try {
    sessionStorage.setItem(PERSONA_KEY, next)
  } catch {
    /* 저장 실패해도 메모리 플래그로 이번 세션은 동작 */
  }
}

/** 현재 체험 진입 흐름. 우주 셸이 자유모드/온보딩/튜토리얼을 가른다(동기 게터). */
export function getDemoFlow(): DemoFlow {
  return flow
}

/** 체험 흐름 전환 — sessionStorage에 반영해 같은 세션 새로고침에도 유지된다(예: free는
 *  다시 온보딩으로 튕기지 않는다). 데이터 출처는 안 바꾸므로 onModeChange를 부르지 않는다. */
export function setDemoFlow(next: DemoFlow): void {
  if (flow === next) return
  flow = next
  try {
    sessionStorage.setItem(FLOW_KEY, next)
  } catch {
    /* 저장 실패해도 메모리 플래그로 이번 세션은 동작 */
  }
}

/** 체험 흐름을 처음(온보딩)으로 되돌린다 — 랜딩에서 새 체험을 시작할 때 매번 온보딩부터
 *  보이게 한다(plan 47). 데모 플래그 자체는 건드리지 않는다. */
export function resetDemoFlow(): void {
  setDemoFlow(DEFAULT_FLOW)
}

// ── 튜토리얼 스포트라이트 투어(plan 48) — 진행 step index를 데모 세션에 보관(새로고침 시 이어감) ──

/** 현재 튜토리얼 단계 index(0-based). flow가 'tutorial'일 때만 의미가 있다. */
export function getTutorialStep(): number {
  return tourStep
}

/** 튜토리얼 단계 index를 저장한다(새로고침에도 같은 데모 세션이면 이어진다). */
export function setTutorialStep(n: number): void {
  const next = Number.isInteger(n) && n >= 0 ? n : 0
  if (tourStep === next) return
  tourStep = next
  try {
    sessionStorage.setItem(TOUR_STEP_KEY, String(next))
  } catch {
    /* noop */
  }
}

/** 튜토리얼 진입(모드 선택 "기능 하나하나 알아보기") — flow=tutorial, step 0부터. */
export function enterTutorialMode(): void {
  setTutorialStep(0)
  setDemoFlow('tutorial')
}

/** 튜토리얼 완료/건너뛰기 — 자유모드로 수렴하고 step을 비운다(자동 재시작 방지). */
export function completeTutorial(): void {
  setTutorialStep(0)
  setDemoFlow('free')
}

/** "다시 보기" — 자유모드에서 사용자가 명시적으로 튜토리얼을 처음부터 다시 본다. */
export function restartTutorial(): void {
  enterTutorialMode()
}
