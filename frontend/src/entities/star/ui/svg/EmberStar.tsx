import { useId } from 'react'
import { mulberry32, blobPath, clamp01 } from '@/shared/lib'
import { lighten, darken, mix } from '../../lib/color'
import type { StarVisualProps } from './types'

const HOT = '#ffd28a' // 백열 톤
const LAVA = '#ff6a1f' // 용암 톤

/**
 * ember — 먹빛 위 잉걸불을 미니멀하게 추상화. 어두운 외피 안에서 발광 코어가 숨쉬며 타오르고
 * (ember-glow), 몇 가닥 균열만 깜빡인다(ember-flicker). 디테일을 덜어 어둠과 불씨의 대비만 남긴다.
 * 같은 seed면 외피·균열 모양이 늘 같다.
 */
export function EmberStar({ cx, cy, r, color, brightness = 1, active = false, seed = 1 }: StarVisualProps) {
  const id = useId().replace(/:/g, '')
  const b = clamp01(brightness)
  const k = active ? 1.12 : 1
  const rand = mulberry32(seed * 2654435761)
  const crust = darken(color, 0.78)
  const lava = mix(color, LAVA, 0.5)
  const hot = mix(lighten(color, 0.5), HOT, 0.6)
  const shell = blobPath(seed, { points: 7, variance: 0.2, radius: r * k, cx, cy })

  // 미니멀 균열 — 코어에서 뻗는 3갈래만(seed로 각도·길이 변주).
  const veinCount = 3
  const veins = Array.from({ length: veinCount }, (_, i) => {
    const a = (i / veinCount) * Math.PI * 2 + rand() * 1.0
    const len = r * (0.5 + rand() * 0.35)
    const midA = a + (rand() - 0.5) * 0.5
    const mx = cx + Math.cos(midA) * len * 0.55
    const my = cy + Math.sin(midA) * len * 0.55
    const ex = cx + Math.cos(a) * len
    const ey = cy + Math.sin(a) * len
    return `M ${cx.toFixed(2)} ${cy.toFixed(2)} Q ${mx.toFixed(2)} ${my.toFixed(2)} ${ex.toFixed(2)} ${ey.toFixed(2)}`
  })

  return (
    <g opacity={b}>
      <defs>
        <radialGradient id={`${id}bloom`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={lava} stopOpacity={0.5} />
          <stop offset="55%" stopColor={lava} stopOpacity={0.14} />
          <stop offset="100%" stopColor={lava} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}core`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={hot} stopOpacity={1} />
          <stop offset="45%" stopColor={lava} stopOpacity={0.9} />
          <stop offset="100%" stopColor={lava} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={cx} cy={cy} r={r * 2.4 * k} fill={`url(#${id}bloom)`} />
      {/* 어두운 외피 */}
      <path d={shell} fill={crust} />
      {/* 타오르는 발광 코어 — 숨쉬며 부푼다 */}
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.7}
        fill={`url(#${id}core)`}
        className="ember-glow"
        style={{ animationDelay: `${(seed % 11) * 0.27}s` }}
      />
      {/* 몇 가닥 균열 — 깜빡인다 */}
      <g
        stroke={lava}
        strokeWidth={Math.max(r * 0.07, 0.5)}
        strokeLinecap="round"
        fill="none"
        className="ember-flicker"
        style={{ animationDelay: `${(seed % 11) * 0.31}s` }}
      >
        {veins.map((d, i) => (
          <path key={i} d={d} strokeOpacity={0.5 + (i % 2) * 0.2} />
        ))}
      </g>
      {/* 백열 중심점 */}
      <circle cx={cx} cy={cy} r={r * 0.16} fill={hot} fillOpacity={0.95} />
    </g>
  )
}
