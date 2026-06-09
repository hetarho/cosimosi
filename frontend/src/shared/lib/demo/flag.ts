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

function readPersisted(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(KEY) === '1'
  } catch {
    return false // private 모드 등 sessionStorage 접근 불가 → 일반 모드로 안전 폴백
  }
}

let demo = readPersisted()

/** 현재 체험 모드인가. API 래퍼·세션 게이트가 동기로 호출한다. */
export function isDemoMode(): boolean {
  return demo
}

/** 체험 모드 진입(랜딩 "체험해보기"). 이후 라우트 이동에도 유지된다. */
export function enterDemoMode(): void {
  demo = true
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* 저장 실패해도 메모리 플래그로 이번 세션은 동작 */
  }
}

/** 체험 종료(랜딩 복귀). 추가했던 더미 별도 함께 비운다. */
export function exitDemoMode(): void {
  demo = false
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}
