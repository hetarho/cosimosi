import { useState } from 'react'
import { cn } from '@/shared/lib'
import { MOOD, type MoodKey } from '@/shared/config'
import { useLandingTheme } from '../../model/theme'
import { VizStar, VizSynapse } from '../viz'

interface StarNode {
  id: number
  x: number
  y: number
  r: number
  mood: MoodKey
  label: string
}

// 보기 좋게 흩뿌린 정적 노드들 (viewBox 0~100). 위치는 결정론적으로 precompute.
const NODES: StarNode[] = [
  { id: 0, x: 24, y: 30, r: 6.5, mood: 'violet', label: '첫 출근' },
  { id: 1, x: 50, y: 20, r: 5.5, mood: 'teal', label: '바다 여행' },
  { id: 2, x: 74, y: 34, r: 7, mood: 'coral', label: '오랜 다툼' },
  { id: 3, x: 38, y: 56, r: 6, mood: 'pink', label: '늦은 고백' },
  { id: 4, x: 64, y: 62, r: 5.5, mood: 'amber', label: '작은 성취' },
  { id: 5, x: 20, y: 74, r: 5, mood: 'teal', label: '비 오는 밤' },
  { id: 6, x: 82, y: 76, r: 6, mood: 'violet', label: '오래된 약속' },
]

// 시냅스(빛의 선): 관련 기억끼리 잇는 정적 엣지.
const EDGES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [0, 3],
  [3, 4],
  [1, 4],
  [3, 5],
  [4, 6],
  [2, 6],
]

function neighborsOf(id: number): Set<number> {
  const set = new Set<number>([id])
  for (const [a, b] of EDGES) {
    if (a === id) set.add(b)
    if (b === id) set.add(a)
  }
  return set
}

/** "뇌가 곧 우주" — 기억(별)과 시냅스(빛의 선)로 이뤄진 작은 성단 데모. 테마별 시각 언어로 그린다. */
export function ConceptSection() {
  const concept = useLandingTheme((s) => s.theme)
  const [activeId, setActiveId] = useState<number | null>(null)
  const active = activeId === null ? null : neighborsOf(activeId)

  const isNodeLit = (id: number) => active === null || active.has(id)
  const isEdgeLit = (a: number, b: number) => active === null || (active.has(a) && active.has(b))

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <figure className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 bg-space-900/40">
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full"
            role="img"
            aria-label="기억과 시냅스로 이뤄진 별 성단 데모. 별 위에 올리면 연결된 기억이 함께 밝아집니다."
          >
            {/* 시냅스: 빛의 선(테마별 곡선) */}
            <g>
              {EDGES.map(([a, b]) => {
                const lit = isEdgeLit(a, b)
                return (
                  <VizSynapse
                    key={`${a}-${b}`}
                    x1={NODES[a].x}
                    y1={NODES[a].y}
                    x2={NODES[b].x}
                    y2={NODES[b].y}
                    color={MOOD[NODES[a].mood]}
                    strength={lit ? 0.85 : 0.28}
                    active={lit && active !== null}
                    concept={concept}
                  />
                )
              })}
            </g>

            {/* 별(엔그램) */}
            <g>
              {NODES.map((node) => {
                const lit = isNodeLit(node.id)
                const isActive = activeId === node.id
                return (
                  <g
                    key={node.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`기억: ${node.label}`}
                    aria-pressed={isActive}
                    className="cursor-pointer outline-none transition-opacity duration-500"
                    style={{ opacity: lit ? 1 : 0.4 }}
                    onMouseEnter={() => setActiveId(node.id)}
                    onMouseLeave={() => setActiveId(null)}
                    onFocus={() => setActiveId(node.id)}
                    onBlur={() => setActiveId(null)}
                    onClick={() => setActiveId((prev) => (prev === node.id ? null : node.id))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setActiveId((prev) => (prev === node.id ? null : node.id))
                      }
                    }}
                  >
                    {/* 별 비주얼(테마별 SVG 오브제) + 넉넉한 투명 히트 영역 */}
                    <VizStar
                      cx={node.x}
                      cy={node.y}
                      r={node.r}
                      color={MOOD[node.mood]}
                      concept={concept}
                      seed={node.id * 97 + 13}
                      active={isActive}
                    />
                    <circle cx={node.x} cy={node.y} r={node.r * 2.1} fill="transparent" />
                  </g>
                )
              })}
            </g>
          </svg>
        </figure>

        <ul className="flex flex-col gap-2">
          {NODES.map((node) => {
            const lit = isNodeLit(node.id)
            const isActive = activeId === node.id
            return (
              <li key={node.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 text-left transition-all duration-300',
                    isActive ? 'bg-white/10' : 'bg-white/[0.03] hover:bg-white/[0.06]',
                  )}
                  style={{ opacity: lit ? 1 : 0.4 }}
                  onMouseEnter={() => setActiveId(node.id)}
                  onMouseLeave={() => setActiveId(null)}
                  onFocus={() => setActiveId(node.id)}
                  onBlur={() => setActiveId(null)}
                  onClick={() => setActiveId((prev) => (prev === node.id ? null : node.id))}
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: MOOD[node.mood] }} />
                  <span className="text-sm leading-relaxed text-white/80">{node.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-white/40">
        {activeId === null
          ? '별 하나에 마음을 두면, 함께 떠오르는 기억이 같이 밝아져요.'
          : `"${NODES[activeId].label}" — 여기 이어진 ${neighborsOf(activeId).size - 1}개의 기억이 함께 빛나요.`}
      </p>
    </div>
  )
}
