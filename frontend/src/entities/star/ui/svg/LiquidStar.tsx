import { useId } from 'react'
import { blobPath, clamp01 } from '@/shared/lib'
import { lighten } from '../../lib/color'
import type { StarVisualProps } from './types'

/**
 * liquid — 투명한 물방울. 속이 꽉 찬 옥구슬이 아니라, 중심은 비치고(배경이 보임) 가장자리에서만 빛이
 * 굴절하는 물방울이다: 옅은 색이 테두리에 맺히고, 아래쪽 굴절 림이 밝게 빛난다. 인위적인 흰 반사
 * 하이라이트는 두지 않는다. 표면장력처럼 은은히 출렁인다(liquid-wobble).
 */
export function LiquidStar({ cx, cy, r, color, brightness = 1, active = false, seed = 1 }: StarVisualProps) {
  const id = useId().replace(/:/g, '')
  const b = clamp01(brightness)
  const k = active ? 1.1 : 1
  const hi = lighten(color, 0.78)
  // 거의 원, 아주 살짝만 유기적으로(물방울 표면장력).
  const body = blobPath(seed, { points: 8, variance: 0.08, radius: r * k, cx, cy })

  return (
    <g opacity={b}>
      <defs>
        <radialGradient id={`${id}bloom`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={hi} stopOpacity={0.28} />
          <stop offset="55%" stopColor={color} stopOpacity={0.1} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        {/* 물방울 본체: 중심은 거의 투명(배경이 비친다) → 가장자리로 갈수록 옅은 색이 맺힌다(굴절). */}
        <radialGradient id={`${id}body`} cx="50%" cy="46%" r="55%">
          <stop offset="0%" stopColor={color} stopOpacity={0.04} />
          <stop offset="58%" stopColor={color} stopOpacity={0.1} />
          <stop offset="85%" stopColor={hi} stopOpacity={0.42} />
          <stop offset="100%" stopColor={hi} stopOpacity={0.12} />
        </radialGradient>
        {/* 굴절 림: 아래쪽 가장자리가 가장 밝게 빛난다(물방울 바닥에 모이는 굴절광). */}
        <linearGradient id={`${id}rim`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={hi} stopOpacity={0.32} />
          <stop offset="50%" stopColor={hi} stopOpacity={0.08} />
          <stop offset="100%" stopColor={hi} stopOpacity={0.8} />
        </linearGradient>
      </defs>

      <circle cx={cx} cy={cy} r={r * 2.0 * k} fill={`url(#${id}bloom)`} />
      {/* 본체 + 굴절 림 — 표면장력처럼 은은히 출렁이게 묶는다(글로우는 정적). */}
      <g className="liquid-wobble" style={{ animationDelay: `${(seed % 7) * 0.4}s` }}>
        <path d={body} fill={`url(#${id}body)`} />
        <path d={body} fill="none" stroke={`url(#${id}rim)`} strokeWidth={Math.max(r * 0.1, 0.6)} />
      </g>
    </g>
  )
}
