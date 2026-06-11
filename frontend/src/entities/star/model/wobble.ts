// 별 미세 부유 파라미터(spec 19) — 단일 출처. StarField(CPU 인스턴스 행렬)와
// SynapseFilaments(TSL 정점 셰이더)가 같은 수식을 공유해, 시냅스 끝이 떠다니는 별의
// 중앙을 프레임 단위로 정확히 따라간다. 값 하나라도 바뀌면 양쪽이 함께 바뀐다.
// 순수 — three/React/DOM 미의존(헌법 §4).

export const WOBBLE_AMP = 1.0

/** 축별 [base, seedGain] 각주파수(rad/s) — freq = base + seed·gain (주기 대략 14~40초). */
export const WOBBLE_FREQ: readonly (readonly [number, number])[] = [
  [0.24, 0.2], // x
  [0.2, 0.26], // y
  [0.16, 0.32], // z
]

/** 축별 위상 배수 — phase = seed·2π·multiplier (별마다·축마다 다른 시작점). */
export const WOBBLE_PHASE: readonly number[] = [1.7, 3.1, 5.3]

/** 축 axis(0=x,1=y,2=z)의 단위 부유값(진폭 미적용, -1..1). seed(0..1)는 별 고유값. */
export function wobbleUnit(seed: number, t: number, axis: 0 | 1 | 2): number {
  const [base, gain] = WOBBLE_FREQ[axis]
  return Math.sin(t * (base + seed * gain) + seed * Math.PI * 2 * WOBBLE_PHASE[axis])
}
