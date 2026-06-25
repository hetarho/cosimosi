// 데모 우주 genesis(change 28) — "빈 우주에서 30일을 살아간다"의 입력 결정. 매 simulated day
// 페르소나별 확률로 일기를 쓸지(하루 최대 1편)·과거 별을 회상할지 굴리고, 쓰면 페르소나 토픽
// 분포대로 프리셋 한 편을 뽑는다. **난수는 여기(genesis 입력)에만** 있고 엔진 함수(data.ts의
// createDemoDiary·linkNewDiary·demoConsolidate)는 입력이 같으면 결정론이라 change 27 골든 parity가
// 안 깨진다(불변: 난수를 엔진에 흘리지 말 것). 세션마다 다른 시드라 데모마다 다른 우주가 자란다.
//
// 순수 model 모듈 — three/React/DOM 미의존(헌법 §4). data.ts가 이 결정을 받아 production 엔진으로
// 별을 빚는다(genesis는 data.ts를 import하지 않는다 — 순환 방지·단방향 의존).
import { VALUES } from '@/shared/config'
import { mulberry32 } from '../prng'
import { getDemoPersona, PERSONA_ORDER } from './flag'
import { pickGenesisDiary, type DiaryPreset } from './diary-presets'

const TOTAL_DAYS = VALUES.demoGenesis.days

// ── 런타임 상태(모듈 수명 = 탭 세션, 새로고침/리셋 시 소멸 — 데모 휘발성 규칙) ──
let active = false
let processedDay = 0
let rng: () => number = mulberry32(1) // startGenesis가 세션 시드로 교체

/** genesis 배속(실 1초당 가상 시간). data.ts/use-demo-flow가 자동 재생 속도로 쓴다. */
export const GENESIS_HOURS_PER_SECOND = VALUES.demoGenesis.hoursPerSecond

const personaIndex = (): number => PERSONA_ORDER.indexOf(getDemoPersona())
const writeProb = (): number => VALUES.demoGenesis.dailyWriteProb[personaIndex()] ?? 0
const recallProb = (): number => VALUES.demoGenesis.dailyRecallProb[personaIndex()] ?? 0

/** genesis를 처음부터 시작한다 — 가상 시계 0·추가 별 0 경계(data.ts resetDemo)에서 함께 불린다.
 *  seed를 주면 결정론(테스트용); 없으면 세션마다 다른 우주가 자라도록 시각 기반 시드(고정 아님, A8). */
export function startGenesis(seed?: number): void {
  active = TOTAL_DAYS > 0
  processedDay = 0
  rng = mulberry32(seed ?? freshSeed())
}

/** genesis 상태를 비운다(비활성·day 0) — resetDemo/튜토리얼 시드 경계에서. */
export function resetGenesis(): void {
  active = false
  processedDay = 0
}

export function isGenesisActive(): boolean {
  return active
}

/** 지금까지 처리한 genesis 일수(1-indexed 진행 표시용 — 0이면 아직 첫날 전). */
export function genesisDay(): number {
  return processedDay
}

export function genesisTotalDays(): number {
  return TOTAL_DAYS
}

/** 그 날 genesis 입력 — 쓰면 뽑힌 프리셋(아니면 null), 회상 여부. */
export interface GenesisDayPlan {
  write: DiaryPreset | null
  recall: boolean
}

/** 다음 genesis day의 입력을 굴려 결정하고 진행을 한 칸 전진한다. 마지막 날을 처리하면 active=false로
 *  내려 genesis 종료를 알린다. 비활성이면 null(무동작). 호출자(data.ts)는 write/recall을 production
 *  엔진으로 실행한다 — 여기서 별을 직접 만들지 않는다(난수↔엔진 분리). */
export function planNextGenesisDay(): GenesisDayPlan | null {
  if (!active) return null
  processedDay += 1
  // roll 순서를 고정(write → recall)해 같은 시드면 같은 수열 — 결정론(테스트 재현성).
  const write = rng() < writeProb() ? pickGenesisDiary(getDemoPersona(), rng) : null
  const recall = rng() < recallProb()
  if (processedDay >= TOTAL_DAYS) active = false
  return { write, recall }
}

/** genesis 입력용 추가 난수 한 개(회상 대상 인덱스 등) — 난수를 genesis rng로 일원화해 결정론 유지. */
export function genesisRoll(): number {
  return rng()
}

/** 세션마다 다른(고정 아님) 32-bit 시드 — Date.now 비트를 섞어 데모마다 다른 우주가 자란다(A8).
 *  app 코드라 Date.now 사용 가능(엔진 결정론과 무관 — 난수는 genesis 입력에만 흐른다). */
function freshSeed(): number {
  const t = Date.now()
  return (t ^ (t >>> 11) ^ 0x9e3779b9) >>> 0
}
