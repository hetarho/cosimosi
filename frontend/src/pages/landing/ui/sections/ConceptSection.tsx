import { useState } from 'react'
import { Section } from '@/shared/ui'
import { blobPath, cn } from '@/shared/lib'
import { MOOD, type MoodKey } from '@/shared/config'

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

/** "뇌가 곧 우주" — 기억(별)과 시냅스(빛의 선)로 이뤄진 작은 성단 데모. */
export function ConceptSection() {
  const [activeId, setActiveId] = useState<number | null>(null)
  const active = activeId === null ? null : neighborsOf(activeId)

  const isNodeLit = (id: number) => active === null || active.has(id)
  const isEdgeLit = (a: number, b: number) =>
    active === null || (active.has(a) && active.has(b))

  return (
    <Section id="concept">
      <div className="flex flex-col gap-4">
        <span className="text-xs uppercase tracking-widest text-mood-violet/80">
          Concept
        </span>
        <h2 className="font-display text-3xl text-white/90 sm:text-4xl">
          뇌가 곧 우주
        </h2>
        <p className="max-w-2xl text-base leading-relaxed text-white/60">
          수많은 기억이 별이 되고, 관련된 기억끼리 시냅스 같은 빛의 선으로 이어져
          하나의 성단을 이룹니다. 머릿속에서만 펼쳐지던 풍경을, 눈에 보이는
          작은 우주로 옮겨 둔 것이 cosimosi입니다.
        </p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <figure className="relative overflow-hidden rounded-3xl border border-white/10 bg-space-900/60">
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full"
            role="img"
            aria-label="기억과 시냅스로 이뤄진 별 성단 데모. 별 위에 올리면 연결된 기억이 함께 밝아집니다."
          >
            {/* 시냅스: 빛의 선 */}
            <g>
              {EDGES.map(([a, b]) => {
                const lit = isEdgeLit(a, b)
                const na = NODES[a]
                const nb = NODES[b]
                return (
                  <line
                    key={`${a}-${b}`}
                    x1={na.x}
                    y1={na.y}
                    x2={nb.x}
                    y2={nb.y}
                    stroke={MOOD[na.mood]}
                    strokeWidth={lit ? 0.9 : 0.4}
                    strokeOpacity={lit ? 0.7 : 0.12}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                )
              })}
            </g>

            {/* 별(엔그램): mood 색 블롭 + 코어 */}
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
                    className="cursor-pointer outline-none transition-all duration-500"
                    style={{
                      opacity: lit ? 1 : 0.22,
                      transform: `translate(${node.x}px, ${node.y}px) scale(${
                        isActive ? 1.18 : lit ? 1 : 0.92
                      })`,
                      transformBox: 'fill-box',
                      transformOrigin: 'center',
                    }}
                    onMouseEnter={() => setActiveId(node.id)}
                    onMouseLeave={() => setActiveId(null)}
                    onFocus={() => setActiveId(node.id)}
                    onBlur={() => setActiveId(null)}
                    onClick={() =>
                      setActiveId((prev) => (prev === node.id ? null : node.id))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setActiveId((prev) => (prev === node.id ? null : node.id))
                      }
                    }}
                  >
                    <path
                      d={blobPath(node.id * 97 + 13, {
                        radius: node.r,
                        cx: 0,
                        cy: 0,
                        points: 7,
                        variance: 0.32,
                      })}
                      fill={MOOD[node.mood]}
                      fillOpacity={lit ? 0.85 : 0.5}
                    />
                    <circle r={node.r * 0.32} cx={0} cy={0} fill="#dfe3ff" fillOpacity={lit ? 0.9 : 0.4} />
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
                  onClick={() =>
                    setActiveId((prev) => (prev === node.id ? null : node.id))
                  }
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: MOOD[node.mood] }}
                  />
                  <span className="text-sm leading-relaxed text-white/80">{node.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-white/40">
        {activeId === null
          ? '별 하나에 마음을 두면, 함께 떠오르는 기억들이 같이 밝아집니다.'
          : `"${NODES[activeId].label}" 그리고 이어진 ${
              neighborsOf(activeId).size - 1
            }개의 기억이 함께 빛나는 중`}
      </p>
    </Section>
  )
}
