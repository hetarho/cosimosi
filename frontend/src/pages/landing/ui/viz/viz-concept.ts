import type { LandingThemeId } from '../../model/theme'

/** 시각화 비주얼 언어 = 랜딩 테마. 배경과 시각화가 한 테마로 함께 바뀐다. */
export type VizConcept = LandingThemeId

/**
 * 두 점을 잇는 부드러운 2차 베지어 곡선 path. 중점을 수직으로 살짝 띄워(arc) 직선의
 * 지루함을 없앤다. 같은 (좌표, arc)면 항상 같은 곡선.
 */
export function synapseCurve(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  arc = 0.14,
): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const cx = (x1 + x2) / 2 + nx * len * arc
  const cy = (y1 + y2) / 2 + ny * len * arc
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
export { clamp01 }
