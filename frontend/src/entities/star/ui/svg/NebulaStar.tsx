import { useId } from 'react'
import { mulberry32, clamp01 } from '@/shared/lib'
import { lighten, shiftHue } from '../../lib/color'
import type { StarVisualProps } from './types'

/**
 * aurora — 표면 없는 빛 구름. 색이 다른 soft 그라디언트 덩이들을 screen으로 겹쳐 흐르는
 * 성운/오로라 결을 만든다. 또렷한 코어 없이 가장자리가 완전히 풀린다(크리스털의 각짐과 정반대).
 * 같은 seed면 덩이 배치가 늘 같다.
 */
export function NebulaStar({ cx, cy, r, color, brightness = 1, active = false, seed = 1 }: StarVisualProps) {
  const id = useId().replace(/:/g, '')
  const b = clamp01(brightness)
  const k = active ? 1.18 : 1
  const rand = mulberry32(seed * 2654435761)
  const hi = lighten(color, 0.42)
  const comp = shiftHue(color, 46) // 오로라 색 흐름(보색 쪽 hint)
  const comp2 = shiftHue(color, -38)

  // 떠다니는 빛덩이들(중심 기준 오프셋, seed로 변주). 첫 덩이는 중심 고정.
  const blobs = [
    { dx: 0, dy: 0, rr: 1.0, col: color, op: 0.5 },
    { dx: (rand() - 0.5) * r * 0.9, dy: (rand() - 0.7) * r * 0.7, rr: 0.74, col: hi, op: 0.5 },
    { dx: (rand() - 0.3) * r, dy: (rand() - 0.3) * r * 0.9, rr: 0.66, col: comp, op: 0.42 },
    { dx: (rand() - 0.7) * r * 0.8, dy: (rand() - 0.2) * r * 0.8, rr: 0.52, col: comp2, op: 0.36 },
  ]

  return (
    <g opacity={b}>
      <defs>
        {blobs.map((bl, i) => (
          <radialGradient key={i} id={`${id}g${i}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={bl.col} stopOpacity={0.95} />
            <stop offset="44%" stopColor={bl.col} stopOpacity={0.45} />
            <stop offset="100%" stopColor={bl.col} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>

      {/* 가산(screen) 합성된 흐르는 빛구름 — 상시 은은한 일렁임. */}
      <g className="nebula-breathe" style={{ mixBlendMode: 'screen', animationDelay: `${(seed % 9) * 0.6}s` }}>
        {blobs.map((bl, i) => (
          <ellipse
            key={i}
            cx={cx + bl.dx}
            cy={cy + bl.dy}
            rx={r * 1.7 * bl.rr * k}
            ry={r * 1.4 * bl.rr * k}
            fill={`url(#${id}g${i})`}
            opacity={bl.op}
          />
        ))}
        {/* 옅은 응결 코어 */}
        <circle cx={cx} cy={cy} r={r * 0.32} fill={hi} fillOpacity={0.55} />
      </g>
    </g>
  )
}
