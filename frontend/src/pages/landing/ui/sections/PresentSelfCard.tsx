import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/shared/lib'
import { MOOD } from '@/shared/config'
import { useLandingTheme } from '../../model/theme'
import { VizStar, VizSynapse } from '../viz'

// 무대 좌표계(가로로 넓은 우주 한 자락).
const VW = 100
const VH = 60

interface Feeling {
  mood: string
  /** 요즘의 마음 한 단어. */
  label: string
  /** 이 마음이 머무는 별무리의 중심. */
  cx: number
  cy: number
}

// 요즘의 마음 셋 — 각자 우주 한쪽에 별무리를 둔다. 색은 의미를 운반하므로 고정(테마와 무관).
const FEELINGS: Feeling[] = [
  { mood: MOOD.teal, label: '잔잔함', cx: 25, cy: 21 },
  { mood: MOOD.amber, label: '설렘', cx: 52, cy: 44 },
  { mood: MOOD.pink, label: '그리움', cx: 77, cy: 22 },
]

// 별무리 안 세 별의 상대 배치(중심 기준). seed는 별마다 고유한 형태를 빚는다.
const OFFSETS = [
  { dx: -8, dy: -3, r: 4.2, seed: 11 },
  { dx: 7, dy: -6, r: 3.4, seed: 29 },
  { dx: 3, dy: 7, r: 4.8, seed: 47 },
]

// 새 별이 내려앉는 자리(중심 기준 오프셋) — 여러 개 더해도 겹치지 않게.
const ADD_SLOTS = [
  { dx: -2, dy: -10 },
  { dx: 10, dy: 4 },
  { dx: -10, dy: 6 },
]
const SPAWN = { x: 52, y: VH + 6 } // 화면 아래에서 떠오른다

interface NewStar {
  id: number
  feeling: number
  tx: number
  ty: number
  /** 끌려가 맺힌 별무리 별 좌표(연결의 반대 끝). */
  ax: number
  ay: number
}

function clusterStars(f: Feeling) {
  return OFFSETS.map((o) => ({ x: f.cx + o.dx, y: f.cy + o.dy, r: o.r, seed: o.seed + Math.round(f.cx) }))
}

/**
 * "지금의 내가 우주를 물들인다" — 요즘의 마음(경쟁적 할당·흥분성)을 만지는 카드.
 * 마음을 고르면 우주의 빛깔이 그쪽으로 물들고 그 별무리가 깨어난다. 새 기억을 더하면
 * 빈 곳이 아니라 요즘 머문 별무리 곁으로 끌려가 — 연결이 그 자리를 정한다(위치 창발).
 */
export function PresentSelfCard() {
  const reduce = useReducedMotion()
  const concept = useLandingTheme((s) => s.theme)
  const [feeling, setFeeling] = useState(0)
  const [added, setAdded] = useState<NewStar[]>([])

  const hot = FEELINGS[feeling]
  const clusters = FEELINGS.map(clusterStars)

  // 마음이 옮겨가면 우주가 새로 물든다 — 직전 마음으로 끌려갔던 새 별은 그 장면과 함께 정리한다.
  const pickFeeling = (i: number) => {
    setFeeling(i)
    setAdded([])
  }

  const addMemory = () => {
    setAdded((prev) => {
      if (prev.length >= ADD_SLOTS.length) return [] // 다 차면 처음부터
      const slot = ADD_SLOTS[prev.length]
      const tx = hot.cx + slot.dx
      const ty = hot.cy + slot.dy
      // 끌려가 맺힐 별무리 별 = 새 자리에서 가장 가까운 별.
      const stars = clusters[feeling]
      const near = stars.reduce((a, b) =>
        Math.hypot(b.x - tx, b.y - ty) < Math.hypot(a.x - tx, a.y - ty) ? b : a,
      )
      return [...prev, { id: prev.length, feeling, tx, ty, ax: near.x, ay: near.y }]
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 우주 한 자락 — 요즘 색의 앰비언트 글로우 위에 세 별무리. */}
      <figure className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-white/10 bg-space-900/50">
        {/* 요즘 색 앰비언트 — 마음마다 한 겹씩 깔고 opacity로 크로스페이드. */}
        {FEELINGS.map((f, i) => (
          <motion.div
            key={i}
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `radial-gradient(120% 120% at ${f.cx}% ${(f.cy / VH) * 100}%, ${f.mood}38 0%, transparent 60%)`,
            }}
            initial={false}
            animate={{ opacity: feeling === i ? 1 : 0 }}
            transition={{ duration: reduce ? 0 : 0.8, ease: 'easeInOut' }}
          />
        ))}

        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="요즘의 마음에 따라 우주가 물들고, 새 기억이 그 별무리로 끌려가는 모습"
        >
          {/* 별무리 안의 시냅스 — 깨어난 무리는 또렷, 잠든 무리는 옅게. */}
          {clusters.map((stars, ci) => {
            const litCluster = ci === feeling
            return (
              <g key={`c-${ci}`}>
                <VizSynapse
                  x1={stars[0].x} y1={stars[0].y} x2={stars[1].x} y2={stars[1].y}
                  color={FEELINGS[ci].mood} strength={litCluster ? 0.8 : 0.16} active={litCluster} concept={concept}
                />
                <VizSynapse
                  x1={stars[1].x} y1={stars[1].y} x2={stars[2].x} y2={stars[2].y}
                  color={FEELINGS[ci].mood} strength={litCluster ? 0.72 : 0.14} active={litCluster} concept={concept}
                />
              </g>
            )
          })}

          {/* 새 별이 끌려가며 맺는 연결 — 도착에 맞춰 옅게 떠오른다. */}
          {added.map((s) => (
            <motion.g
              key={`syn-${s.id}`}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: reduce ? 0 : 0.95 }}
            >
              <VizSynapse
                x1={s.tx} y1={s.ty} x2={s.ax} y2={s.ay}
                color={FEELINGS[s.feeling].mood} strength={0.7} active concept={concept}
              />
            </motion.g>
          ))}

          {/* 별무리 별들. */}
          {clusters.map((stars, ci) =>
            stars.map((st, si) => (
              <VizStar
                key={`s-${ci}-${si}`}
                cx={st.x} cy={st.y} r={st.r}
                color={FEELINGS[ci].mood}
                seed={st.seed}
                concept={concept}
                brightness={ci === feeling ? 1 : 0.4}
                active={ci === feeling}
              />
            )),
          )}

          {/* 더해진 새 별 — 아래에서 떠올라 요즘 별무리 곁으로 끌려간다. */}
          {added.map((s) => (
            <motion.g
              key={`new-${s.id}`}
              initial={reduce ? false : { x: SPAWN.x - s.tx, y: SPAWN.y - s.ty, opacity: 0 }}
              animate={{ x: 0, y: 0, opacity: 1 }}
              transition={{ duration: reduce ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
            >
              <VizStar
                cx={s.tx} cy={s.ty} r={4}
                color={FEELINGS[s.feeling].mood}
                seed={900 + s.id}
                concept={concept}
                brightness={1}
                active
              />
            </motion.g>
          ))}
        </svg>
      </figure>

      {/* 요즘의 마음 고르기 + 새 기억 더하기. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="mr-1 text-xs text-white/45">요즘의 마음</span>
          {FEELINGS.map((f, i) => (
            <button
              key={f.label}
              type="button"
              onClick={() => pickFeeling(i)}
              aria-pressed={feeling === i}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                feeling === i ? 'text-white' : 'border-white/10 text-white/55 hover:text-white/80',
              )}
              style={
                feeling === i
                  ? { borderColor: `${f.mood}88`, backgroundColor: `${f.mood}22`, color: f.mood }
                  : undefined
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={addMemory}
          className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-white/80 transition-colors hover:border-white/35 hover:text-white"
          style={{ boxShadow: `0 0 22px -10px ${hot.mood}` }}
        >
          {added.length >= ADD_SLOTS.length ? '처음부터' : '오늘, 새 기억 쓰기'}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-white/40">
        {added.length === 0
          ? `요즘은 '${hot.label}' 쪽에 마음이 머문다. 새로 쓴 기억은 그 빛으로 끌려간다.`
          : `새 별이 '${FEELINGS[added[added.length - 1].feeling].label}'의 별무리 곁에 내려앉았다 — 어디 놓일지는 연결이 정한다.`}
      </p>
    </div>
  )
}
