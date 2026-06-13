// Pure weight·brightness → visual-parameter mapping. Testable, three-free.
// Line2NodeMaterial has no per-edge width, so strength is carried by emissive/alpha/pulse, not thickness.
import type { SynapseEdge } from './types'

export const A_MIN = 0.05

// Thickness buckets (a 2-step global scalar — Line2NodeMaterial can't vary width per edge).
export const WIDTH_THIN_PX = 1
export const WIDTH_THICK_PX = 4
export const THICK_THRESHOLD = 0.5 // weight ≥ 0.5 → thick bucket

export const ALPHA_MIN = 0.15 // weak/dormant edges still glow faintly
export const ALPHA_MAX = 1

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Effective visual strength = weight · max(a_min, brightness), clamped to [0,1] so a stray
 *  weight/brightness > 1 can't blow out alpha/color on the additive material. */
export const visualIntensity = (e: SynapseEdge): number =>
  Math.min(1, Math.max(0, e.weight) * Math.max(A_MIN, e.brightness))

/** Emissive brightness driver. */
export const emissive = (e: SynapseEdge): number => visualIntensity(e)

/** Opacity driver, floored at ALPHA_MIN so weak/dormant edges remain visible. */
export const alpha = (e: SynapseEdge): number => lerp(ALPHA_MIN, ALPHA_MAX, visualIntensity(e))

/** 링크 활력(spec 26): 누적 공동 회상(co_activation_count)이 많을수록 "살아있는" 연결.
 *  log 압축으로 0..~0.12에 bounded — 처음 몇 번이 가장 크게 기여하고 이후 완만해진다.
 *  서버 미노출(데모/구버전 → 0)이면 0이라 기존 시각과 동일하다. */
export const vitality = (e: SynapseEdge): number =>
  0.12 * Math.min(1, Math.log2(1 + Math.max(0, e.coActivationCount)) / 4)

/** Pulse amplitude for sin(time·f)·amp — recently-reinforced edges pulse stronger; an
 *  often-co-recalled (vital) link keeps a faint baseline pulse even when not just reinforced. */
export const pulseAmp = (e: SynapseEdge): number => Math.min(1, e.reinforcedRecency + vitality(e))

/** Thickness can't be modulated per edge → return a bucket key (optional 2-group render). */
export const widthBucket = (e: SynapseEdge): 'thin' | 'thick' =>
  e.weight >= THICK_THRESHOLD ? 'thick' : 'thin'

export const bucketWidthPx = (b: 'thin' | 'thick'): number =>
  b === 'thick' ? WIDTH_THICK_PX : WIDTH_THIN_PX

// ── 유사도(연결 강도) 단계별 필라멘트 스타일(spec 19) ──────────────────────────
// visualIntensity(weight×시간감쇠) 구간 → 가닥 수·굵기·밝기·불투명도. 연결 시각의
// 단일 조절점: 아래 표의 경계·값만 바꾸면 우주 전체의 연결 표현이 함께 바뀐다
// (SynapseFilaments가 소비). 약한 연결은 한두 가닥 실처럼 은은하게, 강할수록
// 가닥이 늘고 굵고 밝아진다 — "강한 인연만 자기주장한다".

export interface StrandStyle {
  /** 한 연결을 이루는 빛가닥 수. */
  strands: number
  /** 가닥 기본 반지름(world units). */
  radius: number
  /** 발광 베이스(0..1) — 셰이더 brightness 기준값(±지터는 소비처가 얹는다). */
  bright: number
  /** 불투명도 베이스(0..1). */
  opacity: number
}

/** 강도 단계표 — [상한(미만), 스타일]. 마지막 단계가 그 이상 전부를 받는다. */
export const STRAND_TIERS: readonly (readonly [number, StrandStyle])[] = [
  [0.35, { strands: 2, radius: 0.01, bright: 0.2, opacity: 0.5 }], // 옅은 인연 — 실 한두 가닥
  [0.6, { strands: 4, radius: 0.018, bright: 0.32, opacity: 0.62 }], // 보통
  [0.85, { strands: 6, radius: 0.028, bright: 0.45, opacity: 0.72 }], // 강함
  [Infinity, { strands: 9, radius: 0.04, bright: 0.6, opacity: 0.82 }], // 가장 또렷한 인연
]

/** visualIntensity → 단계별 스타일. */
export function strandStyle(e: SynapseEdge): StrandStyle {
  const i = visualIntensity(e)
  for (const [max, style] of STRAND_TIERS) if (i < max) return style
  return STRAND_TIERS[STRAND_TIERS.length - 1][1]
}
