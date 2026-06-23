// 데모("체험") 가상 시계 — 시간 시뮬레이션의 단일 주입 지점(spec 19, change 24).
// 밝기·잠듦·반지름 계산(entities/memory/model/activation·layout)은 전부 now를 인자로 받는 순수
// 함수라, 렌더·파생 계층이 읽는 "현재 시각"을 이 함수 하나로 모으면 시간이 배속으로 흐르는 게 실제로
// 시간이 흐른 것과 동일한 코드 경로로 동작한다(감쇠 수식·임계·병합 무변경, 연출 없음).
// offset은 데모에서만 0이 아니며(비데모는 항상 Date.now() 그대로 — 일반 모드 무영향),
// 모듈 변수라 새로고침 시 소멸한다(데모 수명 규칙: state로만, 새로고침하면 초기화).
// 순수 모듈 — three/React/DOM 미의존(헌법 §4, 모바일 재사용). rAF 틱은 호출자(pages 드라이버)가 굴린다.
import { isDemoMode } from './flag'
import { VALUES } from '@/shared/config'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
// 야간 공고화 발화점 = 04:00 KST = 19:00 UTC. 발화 시각은 엔진(서버)과 같은 값을 쓴다(드리프트 없음).
const CONSOLIDATION_BOUNDARY_SHIFT_MS = VALUES.consolidation.hourUtc * HOUR_MS

/** 배속: 실제 1초당 흐르는 가상 시간(시). 'paused'면 시계가 멈춘다(배속 미적용). */
export type DemoClockSpeed = number | 'paused'

const DEFAULT_SPEED: DemoClockSpeed = VALUES.demoClock.hoursPerSecond[0]

let offsetMs = 0
let speed: DemoClockSpeed = DEFAULT_SPEED

/** 렌더·파생 계층의 "현재 시각". 비데모면 항상 `Date.now()`와 동일값. */
export function virtualNowMs(): number {
  return Date.now() + (isDemoMode() ? offsetMs : 0)
}

/** 패널/투어 표시용 — 지금까지 흘려보낸 가상 일수. */
export function demoOffsetDays(): number {
  return Math.floor(offsetMs / DAY_MS)
}

/** 현재 배속(UI 하이라이트·드라이버 게이트). */
export function getDemoClockSpeed(): DemoClockSpeed {
  return speed
}

/** 배속 설정 — 다음 advanceDemoClock 틱부터 즉시 반영된다('paused'는 누적 멈춤). */
export function setDemoClockSpeed(next: DemoClockSpeed): void {
  speed = next
}

/** (prevMs, nextMs] 안의 simulated 04:00 KST 경계 수. 경계는 24h 간격이라 day-bucket이 바뀔
 *  때마다 정확히 1회 — 빠른 배속이 한 틱에 여러 날을 건너도 경계마다 1회씩(누락·중복 없음). */
export function consolidationBoundariesCrossed(prevMs: number, nextMs: number): number {
  const bucket = (t: number) => Math.floor((t - CONSOLIDATION_BOUNDARY_SHIFT_MS) / DAY_MS)
  return Math.max(0, bucket(nextMs) - bucket(prevMs))
}

/** 배속 흐름 한 틱: 경과 실시간(ms)을 배속만큼 가상 시간으로 환산해 offset에 누적하고, 이 틱이
 *  지난 04:00 경계 수를 돌려준다(드라이버가 그 횟수만큼 야간 공고화를 발화). 정지면 0. */
export function advanceDemoClock(realElapsedMs: number): number {
  if (speed === 'paused' || realElapsedMs <= 0) return 0
  // wall-clock은 한 번만 읽어 경계 수가 정확히 Δoffset에서만 나오게 한다(두 번 읽으면 그 사이 실시간
  // 드리프트가 경계를 하나 더 셀 수 있다). 가상 경과(시)=실제 경과(초)·배속 ⇒ Δoffset(ms)=realElapsedMs·speed·(HOUR_MS/1000).
  const wall = Date.now()
  const before = wall + offsetMs
  offsetMs += realElapsedMs * speed * (HOUR_MS / 1000)
  const after = wall + offsetMs
  return consolidationBoundariesCrossed(before, after)
}

/** 시계를 기본 상태(가상 시계 0·기본 배속)로 — 체험 종료/리셋/페르소나 전환 시 resetDemo가 호출한다. */
export function resetDemoClock(): void {
  offsetMs = 0
  speed = DEFAULT_SPEED
}
