import { useId } from 'react'
import { clamp01 } from '../viz-concept'
import { lighten } from '../viz-color'
import type { StarVisualProps } from './types'

/** 정n각형 path(추상 결정 윤곽). rot=시작각(도). */
function ngon(cx: number, cy: number, rr: number, sides: number, rot: number): string {
  let d = ''
  for (let i = 0; i < sides; i++) {
    const a = ((rot + (i / sides) * 360) * Math.PI) / 180
    d += `${i === 0 ? 'M' : 'L'} ${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)} `
  }
  return d + 'Z'
}

/** 중심에서 상하로 뻗는 가느다란 마름모(회절 스파이크). rotate로 방향을 바꾼다. */
function spike(cx: number, cy: number, len: number, w: number): string {
  return `M ${cx} ${(cy - len).toFixed(2)} L ${(cx + w).toFixed(2)} ${cy} L ${cx} ${(cy + len).toFixed(2)} L ${(cx - w).toFixed(2)} ${cy} Z`
}

/**
 * deepfield — 천체사진 속 별빛을 미니멀하게 추상화. 채운 보석이 아니라 '빛'이다: 투명한 결정 윤곽
 * 위에 JWST식 회절 스파이크가 맥동하며 반짝이고(crystal-pulse), 중심에 작은 빛점만 남긴다.
 */
export function CrystalStar({ cx, cy, r, color, brightness = 1, active = false, seed = 1 }: StarVisualProps) {
  const id = useId().replace(/:/g, '')
  const b = clamp01(brightness)
  const k = active ? 1.16 : 1
  const cool = lighten(color, 0.5)
  const ice = lighten(color, 0.85)
  const rot = (seed % 12) * 7
  const longLen = r * 3.2 * k
  const diagLen = r * 1.7 * k
  const w = Math.max(r * 0.1, 0.45)

  return (
    <g opacity={b}>
      <defs>
        <radialGradient id={`${id}bloom`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={cool} stopOpacity={0.42} />
          <stop offset="45%" stopColor={color} stopOpacity={0.16} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        {/* 스파이크: 중심 백열 → 끝 투명 */}
        <radialGradient id={`${id}spk`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ice} stopOpacity={0.95} />
          <stop offset="24%" stopColor={cool} stopOpacity={0.5} />
          <stop offset="100%" stopColor={cool} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={cx} cy={cy} r={r * 2.6 * k} fill={`url(#${id}bloom)`} />

      {/* 회절 스파이크 — 맥동하며 반짝인다(별빛이 깜빡이는 결) */}
      <g className="crystal-pulse" style={{ animationDelay: `${(seed % 9) * 0.4}s` }} fill={`url(#${id}spk)`}>
        <path d={spike(cx, cy, longLen, w)} />
        <path d={spike(cx, cy, longLen, w)} transform={`rotate(90 ${cx} ${cy})`} />
        <g opacity={0.45}>
          <path d={spike(cx, cy, diagLen, w * 0.8)} transform={`rotate(45 ${cx} ${cy})`} />
          <path d={spike(cx, cy, diagLen, w * 0.8)} transform={`rotate(135 ${cx} ${cy})`} />
        </g>
      </g>

      {/* 투명한 결정 윤곽(채우지 않는다) + 작은 빛점 */}
      <path
        d={ngon(cx, cy, r * 0.72, 6, rot)}
        fill="none"
        stroke={cool}
        strokeOpacity={0.45}
        strokeWidth={Math.max(r * 0.05, 0.4)}
        strokeLinejoin="round"
      />
      <circle cx={cx} cy={cy} r={r * 0.2} fill={ice} fillOpacity={0.95} />
    </g>
  )
}
