// 체험 세션 시작 오케스트레이션(plan 47) — 랜딩의 진입 버튼이 쓴다. flag(진입 흐름)과
// data(더미 우주)를 모두 건드리므로 둘을 묶는 이 작은 모듈에 둔다(flag는 data를 import할 수
// 없다 — 순환). 셸/페이지가 아니라 model 계층이라 three/React/DOM 의존이 없다(헌법 §4).
import { enterDemoMode, exitDemoMode, resetDemoFlow } from './flag'
import { resetDemo } from './data'

/** 랜딩에서 새 체험을 시작한다: 이전 세션의 더미 별·가상 시계와 진입 흐름을 비워 매 진입이
 *  온보딩(누구의 우주를 볼지)부터 시작하게 한 뒤 데모 모드로 들어간다.
 *  먼저 `exitDemoMode()`로 데이터 출처 경계를 한 번 넘긴다 — 이미 데모 중이어도(예: 종료 없이
 *  /landing으로 와 다시 시작) enterDemoMode가 early-return해 캐시 리셋 리스너가 안 돌면 옛 우주가
 *  stale 캐시로 남기 때문. exit→enter가 항상 queryClient.clear 경계를 거치게 한다. */
export function startDemoSession(): void {
  exitDemoMode()
  resetDemo()
  resetDemoFlow()
  enterDemoMode()
}
