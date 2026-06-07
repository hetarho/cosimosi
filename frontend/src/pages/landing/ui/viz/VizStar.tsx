import { useId } from 'react'
import { blobPath } from '@/shared/lib'
import { clamp01, type VizConcept } from './viz-concept'

export interface VizStarProps {
  /** 중심 좌표 + 반지름 (부모 svg viewBox 단위). r ≈ 코어 시각 반경. */
  cx: number
  cy: number
  r: number
  /** 의미 색(mood hex). 테마가 바뀌어도 의미 색은 보존된다. */
  color: string
  concept: VizConcept
  /** 0~1 밝기(감쇠·잠든 별 표현). 기본 1. */
  brightness?: number
  /** 강조(hover/active) 시 더 또렷하게. */
  active?: boolean
  /** 결정론 시드 — 코어 블롭의 고유 형태를 빚는다. 같은 seed면 항상 같은 모양. */
  seed?: number
}

/**
 * 별 하나를 '빛'으로 그리는 SVG 프리미티브 — 일러스트가 아니라 발광점.
 * 부드러운 코어 + 넓고 옅은 블룸 헤일로(실제 /universe 블룸 별의 2D 버전).
 * 모든 테마가 이 광점을 공유하고, 테마는 절제된 한 끗만 더한다:
 *  - deepfield: 가느다란 회절 스파이크(천체사진 별빛)
 *  - liquid: 옅은 스페큘러 sheen(빛 반사)
 * 어떤 svg viewBox 안에든 박힌다.
 *
 * 코어는 정원이 아니라 seed로 빚어진 고유 블롭이다 — "기억마다 하나뿐인 형태가
 * 의미에서 창발한다"는 컨셉을 시각적으로 증명한다. 같은 seed면 항상 같은 모양.
 */
export function VizStar({ cx, cy, r, color, concept, brightness = 1, active = false, seed = 1 }: VizStarProps) {
  const id = useId().replace(/:/g, '')
  const b = clamp01(brightness)
  const k = active ? 1.12 : 1
  const bloomR = r * (concept === 'aurora' ? 3.4 : concept === 'ember' ? 3.0 : 2.7) * k
  const coreR = r * 0.62 * k
  const bloomO = (concept === 'deepfield' ? 0.5 : 0.62) * b * (active ? 1.25 : 1)
  // 코어 형태: 작을수록 변형을 줄여(둥글게) 작은 썸네일에서도 별로 읽히게 한다.
  const variance = coreR < 5 ? 0.22 : 0.32
  const corePath = blobPath(seed, { points: 7, variance, radius: coreR, cx, cy })

  return (
    <g>
      <radialGradient id={`${id}b`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={color} stopOpacity={0.85} />
        <stop offset="45%" stopColor={color} stopOpacity={0.32} />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}c`} cx="50%" cy="48%" r="55%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.98 * b} />
        <stop offset="38%" stopColor={color} stopOpacity={0.95 * b} />
        <stop offset="100%" stopColor={color} stopOpacity={0.18 * b} />
      </radialGradient>

      {/* 넓고 옅은 블룸 */}
      <circle cx={cx} cy={cy} r={bloomR} fill={`url(#${id}b)`} opacity={bloomO} />

      {/* deepfield: 회절 스파이크(아주 옅게) */}
      {concept === 'deepfield' && (
        <g stroke="#ffffff" strokeOpacity={0.42 * b} strokeWidth={0.4} strokeLinecap="round">
          <line x1={cx} y1={cy - r * 2.6 * k} x2={cx} y2={cy + r * 2.6 * k} />
          <line x1={cx - r * 2.6 * k} y1={cy} x2={cx + r * 2.6 * k} y2={cy} />
        </g>
      )}

      {/* 발광 코어 — seed로 빚어진 고유 형태(별마다 다른 모양) */}
      <path d={corePath} fill={`url(#${id}c)`} />
      <circle cx={cx} cy={cy} r={coreR * 0.42} fill="#ffffff" fillOpacity={0.92 * b} />

      {/* liquid: 옅은 스페큘러 sheen */}
      {concept === 'liquid' && (
        <ellipse cx={cx - coreR * 0.3} cy={cy - coreR * 0.34} rx={coreR * 0.34} ry={coreR * 0.2} fill="#ffffff" fillOpacity={0.6 * b} />
      )}
    </g>
  )
}
