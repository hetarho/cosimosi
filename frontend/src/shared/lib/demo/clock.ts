// 데모("체험") 가상 시계 — 시간 시뮬레이션의 단일 주입 지점(spec 19).
// 밝기·잠듦 계산(entities/memory/model/activation)은 전부 now를 인자로 받는 순수 함수라,
// 렌더·파생 계층이 읽는 "현재 시각"을 이 함수 하나로 모으면 "하루 지나기"가 실제로 시간이
// 흐른 것과 동일한 코드 경로로 동작한다(감쇠 수식·임계·병합 무변경, 연출 없음).
// offset은 데모에서만 0이 아니며(비데모는 항상 Date.now() 그대로 — 일반 모드 무영향),
// 모듈 변수라 새로고침 시 소멸한다(데모 수명 규칙: state로만, 새로고침하면 초기화).
// 순수 모듈 — three/React/DOM 미의존(헌법 §4, 모바일 재사용).
import { isDemoMode } from './flag'

const DAY_MS = 86_400_000

let offsetMs = 0

/** 렌더·파생 계층의 "현재 시각". 비데모면 항상 `Date.now()`와 동일값. */
export function virtualNowMs(): number {
  return Date.now() + (isDemoMode() ? offsetMs : 0)
}

/** 시간 머신: 가상 시계를 n일 전진(데모 한정 — 시뮬레이션 패널이 호출). */
export function skipDemoDays(days: number): void {
  offsetMs += days * DAY_MS
}

/** 패널 표시용 — 지금까지 보낸 가상 일수("+N일째"). */
export function demoOffsetDays(): number {
  return Math.round(offsetMs / DAY_MS)
}

/** 시계를 0으로 — 체험 종료/리셋 시 resetDemo가 호출한다. */
export function resetDemoClock(): void {
  offsetMs = 0
}
