// 무늬 셰이퍼 — 노이즈/거리를 [0,1] 구조/마스크로 깎는다. 색은 입히지 않는다 — mood 색 합성은 소비처(entity)
// 몫이다(plan 50: 툴킷은 "형태", entity는 "그 형태에 감정색을 입힌 스킨"). 전부 순수 노드 in/out.
import { float, abs, pow, floor, fract, clamp } from 'three/tsl'
import { asFloatNode } from '../tsl'

/** Worley f1·f2로 셀 경계선([0,1]) — 결정/세포막. sharpness↑일수록 가는 선(경계만 밝음). */
export function cellEdge(f1: unknown, f2: unknown, sharpness = 8) {
  const edge = asFloatNode(f2).sub(asFloatNode(f1)) // 경계에서 0, 셀 내부로 갈수록 커짐
  return pow(clamp(float(1).sub(edge.mul(sharpness)), float(0), float(1)), float(2))
}

/** [0,1] 값을 steps단계로 양자화 — 계단 톤/등고선 층(지형도). */
export function contourSteps(value: unknown, steps = 7) {
  return floor(asFloatNode(value).mul(steps)).div(steps)
}

/** 등치선(isoline)([0,1]) — 값이 레벨 경계를 지날 때만 밝아지는 가는 선. sharpness↑일수록 가늘다. */
export function isoLine(value: unknown, levels = 7, sharpness = 6) {
  const f = fract(asFloatNode(value).mul(levels)) // 레벨마다 0..1 톱니
  const d = abs(f.sub(0.5)).mul(2) // 레벨 경계에서 1, 중간에서 0
  return pow(clamp(d, float(0), float(1)), float(sharpness))
}
