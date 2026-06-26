import { mulberry32 } from './prng'

export interface BlobOptions {
  points?: number
  radius?: number
  variance?: number
  cx?: number
  cy?: number
}

/**
 * 시드 기반 결정론적 블롭 SVG path 문자열. 같은 (seed, opts)면 항상 같은 모양.
 * 부드러운 닫힌 곡선(Catmull-Rom → cubic bezier 변환). 기본 viewBox 100x100, 중심 (50,50).
 * "별 = 시드로 빚어지고 회상(시드 변경)마다 다시 빚어진다"는 컨셉의 구현 도구.
 */
export function blobPath(seed: number, opts: BlobOptions = {}): string {
  const { points = 6, radius = 38, variance = 0.34, cx = 50, cy = 50 } = opts
  const rand = mulberry32(seed)
  const pts: Array<[number, number]> = []
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2
    const r = radius * (1 - variance + rand() * variance * 2)
    pts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r])
  }
  const n = pts.length
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
  }
  return `${d} Z`
}
