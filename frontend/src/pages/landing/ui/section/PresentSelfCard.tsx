import { useEffect, useState } from 'react'
import { cn } from '@/shared/lib'
import { MOOD } from '@/shared/config'
import { useStage, type StageStar, type StageSynapse } from '../../model/stage'
import { useResetOnActive } from '../../lib/use-reset-on-active'

/**
 * "지금의 내가 우주를 물들여요" (present, 요즘의 나: ambient §2.3 + 경쟁적 할당 §5) — 구 AmbientMoodCard +
 * PresentSelfCard. 마음(mood)을 고르면 **랜딩 페이지 전체 배경색**이 그 감정으로 물들고(무대 안만이 아니라
 * 전역), 새로 쓴 기억은 그 별무리 곁으로 끌려가 연결된다(위치는 연결이 정한다). 장을 벗어나면 배경은 복귀한다.
 */

const FEELINGS = [
  { key: 'calm', label: '잔잔함', mood: MOOD.teal },
  { key: 'tender', label: '설렘', mood: MOOD.amber },
  { key: 'longing', label: '그리움', mood: MOOD.pink },
] as const

// 선택된 마음의 별무리(중심 기준 오프셋) — 무대 위.
const CLUSTER = [
  { dx: -14, dy: -4, seed: 11 },
  { dx: 10, dy: -8, seed: 29 },
  { dx: 2, dy: 10, seed: 47 },
]
const CENTER = { x: 50, y: 44 }
// 새 별이 끌려가 내려앉는 자리(중심 기준).
const SLOTS = [
  { dx: -4, dy: -14 },
  { dx: 16, dy: 2 },
  { dx: -16, dy: 6 },
]

export function PresentSelfCard() {
  const isActive = useStage((s) => s.activeAct === 'present')
  const setScene = useStage((s) => s.setScene)
  const setBgMood = useStage((s) => s.setBgMood)
  const [feeling, setFeeling] = useState(0)
  const [added, setAdded] = useState(0)
  const cur = FEELINGS[feeling]

  useResetOnActive(isActive, () => {
    setFeeling(0)
    setAdded(0)
  })

  // 랜딩 전역 배경 물듦 — 장 안에서만. 벗어나면(또는 언마운트) 테마 기본으로 복귀.
  useEffect(() => {
    if (!isActive) {
      setBgMood(null)
      return
    }
    setBgMood(cur.mood)
    return () => setBgMood(null)
  }, [isActive, cur.mood, setBgMood])

  useEffect(() => {
    if (!isActive) return
    const cluster: StageStar[] = CLUSTER.map((o, i) => ({
      id: `cl-${i}`,
      x: CENTER.x + o.dx,
      y: CENTER.y + o.dy,
      size: 0.58,
      color: cur.mood,
      seed: o.seed,
      brightness: 1,
    }))
    const synapses: StageSynapse[] = [
      { id: 'cl-01', a: 'cl-0', b: 'cl-1', color: cur.mood, strength: 0.78, active: true },
      { id: 'cl-12', a: 'cl-1', b: 'cl-2', color: cur.mood, strength: 0.72, active: true },
    ]
    const newStars: StageStar[] = []
    for (let i = 0; i < added; i++) {
      const slot = SLOTS[i % SLOTS.length]
      const id = `new-${i}`
      newStars.push({ id, x: CENTER.x + slot.dx, y: CENTER.y + slot.dy, size: 0.5, color: cur.mood, seed: 900 + i, brightness: 1 })
      // 끌려가 맺힌 별무리 별 = 가장 가까운 클러스터 별.
      const near = cluster.reduce((a, b) =>
        Math.hypot(b.x - (CENTER.x + slot.dx), b.y - (CENTER.y + slot.dy)) <
        Math.hypot(a.x - (CENTER.x + slot.dx), a.y - (CENTER.y + slot.dy))
          ? b
          : a,
      )
      synapses.push({ id: `new-syn-${i}`, a: id, b: near.id, color: cur.mood, strength: 0.7, active: true })
    }
    setScene({ stars: [...cluster, ...newStars], synapses })
  }, [isActive, feeling, added, cur.mood, setScene])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="mr-1 text-xs text-white/45">요즘의 마음</span>
          {FEELINGS.map((f, i) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFeeling(i)
                setAdded(0)
              }}
              aria-pressed={feeling === i}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                feeling === i ? 'text-white' : 'border-white/10 text-white/55 hover:text-white/80',
              )}
              style={feeling === i ? { borderColor: `${f.mood}88`, backgroundColor: `${f.mood}22`, color: f.mood } : undefined}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setAdded((n) => (n >= SLOTS.length ? 0 : n + 1))}
          className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-white/80 transition-colors hover:border-white/35 hover:text-white"
          style={{ boxShadow: `0 0 22px -10px ${cur.mood}` }}
        >
          {added >= SLOTS.length ? '처음부터' : '오늘, 새 기억 쓰기'}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-white/45">
        마음을 고르면 <span className="text-white/70">랜딩 우주 전체</span>가 그 감정으로 물들어요(장을 벗어나면
        제자리로). 새로 쓴 기억은 빈 곳이 아니라 요즘 머문 별무리 곁으로 끌려가 자리를 잡아요 — 어디 놓일지는
        연결이 정해요.
      </p>
    </div>
  )
}
