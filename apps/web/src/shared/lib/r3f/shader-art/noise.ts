// 절차적 노이즈 — 모든 무늬의 재료. three TSL의 MaterialX 노이즈를 우리 합성 규약(노드 in/out·이름 있는
// 인자·부수효과 없음)으로 감싼다. material·uniform·React를 모르며 노드만 만들어 돌려준다(plan 50 A2).
import { mx_fractal_noise_float, mx_noise_float, mx_worley_noise_vec2, abs, float } from 'three/tsl'
import { asFloatNode, asVec3Node } from '../tsl'

export interface FbmOptions {
  /** fbm 옥타브 수 — 클수록 미세 디테일이 쌓인다(옥타브당 노이즈 1회라 연산 비쌈). */
  octaves?: number
  /** 옥타브마다 주파수 배수(보통 2) — 클수록 옥타브 간 결 간격이 벌어진다. */
  lacunarity?: number
  /** 옥타브마다 진폭 감쇠(보통 0.5) — 클수록 고주파가 살아 거친 결. */
  gain?: number
}

/** fbm(fractal Brownian motion) — 구름·연기·성운의 기본 결. 반환 ≈ [-1,1]. */
export function fbm(p: unknown, { octaves = 3, lacunarity = 2, gain = 0.5 }: FbmOptions = {}) {
  return mx_fractal_noise_float(asVec3Node(p), octaves, lacunarity, gain)
}

/** fbm을 [0,1]로 리맵 — 밀도/마스크로 쓸 때. */
export function fbm01(p: unknown, opts?: FbmOptions) {
  return fbm(p, opts).mul(0.5).add(0.5)
}

/** 단일 옥타브 그라디언트 노이즈([-1,1]) — 미세 입자·디더용(fbm보다 쌈). */
export function gnoise(p: unknown) {
  return mx_noise_float(asVec3Node(p))
}

/** 능선형 노이즈([0,1]) — |fbm|을 뒤집어 날카로운 능선/불꽃 가닥을 만든다. */
export function ridged(p: unknown, opts?: FbmOptions) {
  return float(1).sub(abs(fbm(p, opts)))
}

/** Worley(세포) 노이즈 → 가장 가까운 두 셀 중심까지 거리. f2-f1이 셀 경계, f1이 셀 중심까지 거리.
 *  세포·결정·물방울 무늬의 재료. jitter↑일수록 셀 중심이 불규칙해진다. */
export function worley(p: unknown, jitter = 1) {
  const d = mx_worley_noise_vec2(asVec3Node(p), float(jitter))
  return { f1: asFloatNode(d.x), f2: asFloatNode(d.y) }
}
