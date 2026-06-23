// Reconsolidation render-composition (spec 23). Pure: no three/React/DOM
// (constitution §4·acceptance 1.10 — reused on mobile). The server is authoritative
// over the cumulative reshaping state (brightness_offset / hue_shift / form_seed_delta);
// these helpers fold that state into the values the renderer actually draws so the
// recalled star reads as the SAME star, a little re-shaped.
import { A_MIN } from './activation'

/**
 * 재성형 반영 별 유효 밝기 = clamp(starBrightness + brightnessOffset, A_MIN, 1).
 * 누적 오프셋이 아무리 쌓여도 별은 A_MIN 바닥 아래로 내려가지 않는다(헌법2, acceptance 1.7).
 */
export function reshapedBrightness(base: number, offset: number): number {
  return Math.max(A_MIN, Math.min(1, base + offset))
}

/** 형태 시드 = seed + formSeedDelta(StarField aSeed 입력). 형태가 미세하게 다시 빚어진다. */
export function reshapedSeed(seed: number, delta: number): number {
  return seed + delta
}

/**
 * 다축 형태 시드 = 각 축 + formSeedDelta(StarField aShape 입력, spec 53). 회상/재공고화가 누적한
 * form_seed_delta(spec 23·야간 요지)를 3개 형태 축에 똑같이 더해 — 별을 다시 떠올릴 때마다 실루엣이
 * 미세하게 다시 빚어진다(A4). 누적 캡은 form_seed_delta 자체(reshape.form_delta_max, ±0.6)가 보증한다.
 */
export function reshapedShapeSeed(
  shape: readonly [number, number, number],
  delta: number,
): [number, number, number] {
  return [shape[0] + delta, shape[1] + delta, shape[2] + delta]
}
