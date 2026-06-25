// 플랫폼 무관 기억 물리 — Bjork 기억 weight(저장·인출 강도), 자아 중심 반지름(거리=강함), 야간
// 요지의 추상화 단계, 감정 유사도. 셋 다 three/React/DOM 미의존 순수 함수다(헌법4). 여기 둔 이유:
// 실렌더(entities/memory)와 체험 시뮬(shared/lib/demo)이 **같은 함수를 import해** 동치를 보장하기
// 위해서다(job 43 parity). entities는 shared를 import할 수 있지만 shared는 entities를 import할 수 없으므로
// (FSD 하향 의존), 공유 가능한 식은 가장 낮은 층(shared/lib)에 두고 entities/memory가 re-export한다.
// 서버 권위 로직(Go: internal/job/radius.go·worker.go·excitability.go, internal/memory/service.go)의
// 충실한 FE 포트다 — 서버 식이 바뀌면 여기와 골든 대조 테스트가 함께 따라가야 한다(드리프트 방지).
import { VALUES } from '@/shared/config'
import { targetRadius } from './layout'

const DAY_MS = 86_400_000
const STORAGE_BASE = VALUES.memoryWeight.storageBase
const EMO_CONSOLIDATION = VALUES.memoryWeight.emoConsolidation
const TAU0_DAYS = VALUES.memoryWeight.tau0Days
const TAU_STORAGE_GAIN = VALUES.memoryWeight.tauStorageGain
const CONN_DRIFT_ALPHA = VALUES.radialLayout.connDriftAlpha
const CONN_WEIGHT_TERM = VALUES.radialLayout.connWeightTerm

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

// ── Bjork 기억 weight(spec 07, radius.go storageStrength/retrievalStrength 미러) ──

/** Storage strength S(Bjork): 누적·단조 비감소. 부호화 시 STORAGE_BASE, 회상마다 +1, 정서 강도가
 *  회상당 공고화를 키운다(정서적 기억일수록 깊이). S는 줄지 않는다 — Δt(아래 R)만 접근성을 낮춘다. */
export function storageStrength(recallCount: number, intensity: number): number {
  const n = Math.max(0, recallCount)
  return (STORAGE_BASE + n) * (1 + EMO_CONSOLIDATION * clamp01(intensity))
}

/** Retrieval strength R = exp(-Δt / τ(S)) ∈ (0,1]: 시간 감쇠 하의 현재 접근성. τ(S)가 S와 함께
 *  커져(spacing effect) 잘 공고화된 기억은 천천히 잊힌다. tauGain≥0은 τ를 더 늘리는(감쇠를 늦추는)
 *  선택적 항 — 반지름용 연결성이 먹인다(memoryRadiusR), 그 외엔 0(불변). */
export function retrievalStrength(s: number, dtDays: number, tauGain = 0): number {
  const tau = TAU0_DAYS * (1 + TAU_STORAGE_GAIN * Math.log1p(Math.max(0, s))) * (1 + Math.max(0, tauGain))
  return Math.exp(-Math.max(0, dtDays) / tau)
}

/** 별 raw 필드에서 바로 R — 반지름(38)·배경 감정 랭킹이 함께 읽는 값. dtDays=(now−lastRecalledAt)/day. */
export function memoryR(recallCount: number, intensity: number, lastRecalledAt: number, now: number): number {
  return retrievalStrength(storageStrength(recallCount, intensity), (now - lastRecalledAt) / DAY_MS)
}

/** 반지름용 연결성(spec 38 change 18): degree + Σweight를 합친다. ≥0; 보통 별 ≈1, 허브는 그 위. */
export function radiusConnectedness(degreeNorm: number, weightedDegreeNorm: number): number {
  return Math.max(0, degreeNorm) + CONN_WEIGHT_TERM * Math.max(0, weightedDegreeNorm)
}

/** 자아 거리 반지름용 R — 연결성이 τ를 늘려 감쇠만 늦춘다(연결은 별을 중앙으로 당길 뿐 밖으로 밀지
 *  않는다). connectedness=0이면 memoryR와 동일. R≤1이라 연결이 별을 R_MIN 안으로 끌거나 미연결보다
 *  멀게 만들 수 없다. */
export function memoryRadiusR(
  recallCount: number,
  intensity: number,
  lastRecalledAt: number,
  now: number,
  connectedness: number,
): number {
  const tauGain = CONN_DRIFT_ALPHA * Math.max(0, connectedness)
  return retrievalStrength(storageStrength(recallCount, intensity), (now - lastRecalledAt) / DAY_MS, tauGain)
}

// ── 자아 거리 반지름 + 야간 요지 추상화 단계(radius.go starRadii/stageForRadius 미러) ──

/** 별의 자아 거리 반지름(world 단위) — Bjork 인출 강도(+연결성)를 targetRadius로 매핑. 실렌더의
 *  starGlow가 안에서 쓰는 것과 같은 식을 한 함수로(데모·실렌더 공유). 가까울수록(작을수록) 강하다. */
export function starRadius(
  recallCount: number,
  intensity: number,
  lastRecalledAt: number,
  now: number,
  connectedness: number,
): number {
  return targetRadius(memoryRadiusR(recallCount, intensity, lastRecalledAt, now, connectedness))
}

/** 반지름 → 추상화 단계 0..N(서버 stageForRadius): gist_stage_radii의 각 임계를 넘을 때마다 +1.
 *  멀어질(잊힐)수록 단계가 올라 형태가 한 단계씩 단순(요지)해진다(change 20). 야간 공고화가
 *  GREATEST(현재, 이 값)로 단조 승급한다 — 여기서 단계 자체는 순수 파생값. */
export function abstractionStageForRadius(radius: number): number {
  let stage = 0
  for (const t of VALUES.consolidation.gistStageRadii) if (radius > t) stage++
  return stage
}

// ── 감정 유사도(job 37, excitability.go emotionSimilarity 미러) ──

// circumplex 정동 평면의 지름: valence∈[-1,1](범위 2)·intensity∈[0,1](범위 1) → hypot(2,1)=√5.
const EMO_MAX_DIST = Math.sqrt(5)

/** 두 기억의 감정 유사도 0..1 — 정동 평면(valence·intensity) 위 거리로. 같은 감정이면 1, 정반대면 0.
 *  연결 weight의 감정 항(emoAlpha·emoSim)에 쓰인다. */
export function emotionSimilarity(v1: number, i1: number, v2: number, i2: number): number {
  return clamp01(1 - Math.hypot(v1 - v2, i1 - i2) / EMO_MAX_DIST)
}

// ── 연결성 맵(radius.go normalizedDegrees 미러; entities/synapse degreeNormById와 동일 median 정규화) ──

interface DegreeEdge {
  aId: string
  bId: string
  weight: number
}

function normalizedNodeMap(edges: readonly DegreeEdge[], edgeValue: (e: DegreeEdge) => number): Map<string, number> {
  const acc = new Map<string, number>()
  for (const e of edges) {
    const v = edgeValue(e)
    acc.set(e.aId, (acc.get(e.aId) ?? 0) + v)
    acc.set(e.bId, (acc.get(e.bId) ?? 0) + v)
  }
  if (acc.size === 0) return acc
  const sorted = [...acc.values()].sort((x, y) => x - y)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const denom = median > 0 ? median : 1
  const out = new Map<string, number>()
  for (const [id, d] of acc) out.set(id, d / denom)
  return out
}

/** star id → 반지름용 연결성(radiusConnectedness(degreeNorm, weightedDegreeNorm)). degree·weighted-degree를
 *  median으로 정규화해 합친다(보통 별 ≈1, 허브는 그 위). 간선 없는 별은 맵에 없음 → 호출자가 0으로 읽는다. */
export function connectednessById(edges: readonly DegreeEdge[]): Map<string, number> {
  const degree = normalizedNodeMap(edges, () => 1)
  const weighted = normalizedNodeMap(edges, (e) => e.weight)
  const out = new Map<string, number>()
  for (const id of degree.keys()) out.set(id, radiusConnectedness(degree.get(id) ?? 0, weighted.get(id) ?? 0))
  return out
}
