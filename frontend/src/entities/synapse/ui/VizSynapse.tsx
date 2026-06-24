import { clamp01 } from '@/shared/lib'
import { parseStarLook } from '@/entities/star/@x/synapse'
import { synapseCurve } from '../lib/curve'

export interface VizSynapseProps {
  x1: number
  y1: number
  x2: number
  y2: number
  /** 연결 색(보통 한쪽 별의 mood 색). */
  color: string
  /** 0~1 시냅스 강도 → 굵기·밝기. */
  strength: number
  /** 끝점 별 룩(단일 축, change 29). 룩으로 코어색/점선을 맞춘다. */
  concept: string
  /** 곡률(직선의 지루함 제거). 기본 0.14. */
  arc?: number
  active?: boolean
  className?: string
}

/**
 * 두 별을 잇는 시냅스를 '빛의 실'로 그린다 — 굵은 페인트 선이 아니라, 넓고 아주 옅은 글로우 위에
 * 가느다란 발광 코어. 항상 휘어진 곡선(직선 금지). strength가 굵기·밝기를 키운다.
 * 오브제(형태)마다 한 끗만 다르다(색 테마와 독립): ember=mood색 코어, deepfield=점선 별자리 선,
 * 그 외=차가운 백색 코어.
 */
export function VizSynapse({
  x1,
  y1,
  x2,
  y2,
  color,
  strength,
  concept,
  arc = 0.14,
  active = false,
  className,
}: VizSynapseProps) {
  const s = clamp01(strength)
  const d = synapseCurve(x1, y1, x2, y2, arc)
  const boost = active ? 1.3 : 1
  // 룩으로 끝점 별 연결선을 맞춘다: spiky=mood색 코어, polyhedron=점선 별자리 선, liquid=차가운 백색 코어.
  const look = parseStarLook(concept)
  const coreColor = look === 'spiky' ? color : '#eef1ff'
  const dashed = look === 'polyhedron'

  return (
    <g className={className} fill="none" strokeLinecap="round">
      {/* 넓고 아주 옅은 글로우 */}
      <path d={d} stroke={color} strokeWidth={(1.4 + s * 4) * boost} strokeOpacity={(0.05 + s * 0.14) * boost} />
      {/* 가느다란 발광 코어 */}
      <path
        d={d}
        stroke={coreColor}
        strokeWidth={(0.35 + s * 1.1) * boost}
        strokeOpacity={(0.22 + s * 0.5) * boost}
        strokeDasharray={dashed ? '0.7 3' : undefined}
      />
    </g>
  )
}
