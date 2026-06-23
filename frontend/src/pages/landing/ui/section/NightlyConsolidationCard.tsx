import { useEffect, useRef, useState } from 'react'
import { animate, motion, useReducedMotion } from 'motion/react'
import { GlassCard } from '@/shared/ui'
import { cn } from '@/shared/lib'
import { MOOD, VALUES } from '@/shared/config'
import { useAppearance } from '@/entities/appearance'
import { VizStar } from '@/entities/star'
import { VizSynapse } from '@/entities/synapse'
import { TheoryBadge } from './TheoryBadge'

const ACCENT = MOOD.violet

/** 야간 공고화 단계 — change 20 재설계. 반경 스코프 안의 별만 정돈하고(멀리 표류한 별은 그대로),
 *  시간 기반 연결은 약화·의미 기반은 강화, 성단을 겹치지 않게 흩고, 잊혀가는 별은 형태를 한 단계
 *  추상화(요지)하고, 약한 선은 *밝기만* 낮추되 별마다 선 하나는 지키고(삭제 아님 — 헌법2), 외톨이
 *  별은 닮은 기억과 다시 잇는다(재-KNN). */
const STAGES = [
  { label: '잠들기 전 — 낮에 담은 두 작은 성단', tag: '대기' },
  { label: '다시 깜빡여요 — 낮의 별들이 깨어나요', tag: '1 · 재활성화' },
  { label: '시간으로 맺힌 선은 옅어지고, 의미로 닿은 선은 굵어져요', tag: '2 · 재가중' },
  { label: '겹치지 않게 자리를 골라요 — 성단끼리 살짝 흩어져요', tag: '3 · 자리 고르기' },
  { label: '멀리 잊혀가는 별은 형태가 한 단계 단순해져요 — 줄거리만', tag: '4 · 요지' },
  { label: '약한 선은 빛만 낮추되 별마다 하나는 지켜요 — 외톨이는 다시 이어줘요', tag: '5 · 가지치기·재연결' },
] as const

// 가지치기 후에도 약한 선이 가닿는 최소 밝기(바닥). 0이 아니라 floor라, 선은 사라지지 않고
// 어두워질 뿐이다(헌법2 — 별·선은 우주에서 삭제하지 않는다). 서버 weakEdgeFloor의 시연 대응.
const PRUNE_FLOOR = 0.16
// 재가중: 시간 기반 연결이 줄어드는 하한 / 의미 기반이 강화되는 상한(서버 TEMPORAL_LINK_DECAY·SEMANTIC_LINK_GAIN의 시연 대응).
const TEMPORAL_WEAK = 0.22
const SEMANTIC_STRONG = 0.85
// 자리 고르기: 두 성단이 서로 겹치지 않게 좌우로 벌어지는 양.
const SPREAD_DX = 13

// 반경 스코프(change 20): 야간 정돈은 이 반경 안의 별만 건드린다. 밖의 별(far)은 그대로 둔다.
const SCOPE = { cx: 78, cy: 56, r: 50 }

/** 별: 시작 좌표 + 소속 성단(A 왼쪽·B 오른쪽) + 역할 플래그.
 *  - forgotten: 요지(추상화)로 형태가 단순해지는, 멀리 잊혀가는 별.
 *  - lonely: 살아있는 연결이 없어 재-KNN으로 다시 이어지는 외톨이 별.
 *  - far: 반경 스코프 밖 — 야간에 건드리지 않는다. */
interface NightStar {
  x: number
  y: number
  r: number
  cluster: 'A' | 'B' | 'L' | 'F'
  forgotten?: boolean
  lonely?: boolean
  far?: boolean
}

const STARS: readonly NightStar[] = [
  { x: 52, y: 38, r: 6.5, cluster: 'A' },
  { x: 38, y: 64, r: 5.5, cluster: 'A' },
  { x: 58, y: 82, r: 5, cluster: 'A', forgotten: true },
  { x: 104, y: 42, r: 6.5, cluster: 'B' },
  { x: 116, y: 70, r: 5.5, cluster: 'B' },
  { x: 96, y: 92, r: 4.5, cluster: 'L', lonely: true },
  { x: 146, y: 16, r: 4, cluster: 'F', far: true },
]

/** 연결: 두 별 인덱스 + 종류. temporal=시간으로 맺힌 선(재가중에서 약화), semantic=의미로 닿은 선(강화).
 *  weakIdle=약하고 안 쓰여 가지치기 대상. protect=그 별의 마지막 살아있는 선(보호). */
interface NightLink {
  a: number
  b: number
  type: 'semantic' | 'temporal'
  weakIdle?: boolean
  protect?: boolean
}

const LINKS: readonly NightLink[] = [
  { a: 0, b: 1, type: 'semantic' },
  { a: 0, b: 2, type: 'semantic', protect: true }, // 별2의 마지막 살아있는 선 — 가지치기에도 지켜진다
  { a: 1, b: 2, type: 'temporal', weakIdle: true }, // 약·idle → 밝기만 floor로
  { a: 3, b: 4, type: 'semantic' },
  { a: 0, b: 3, type: 'temporal' }, // 성단 사이 시간 연결 — 재가중에서 약화
]

// 재-KNN: 외톨이 별(5)이 닮은 기억(3)과 새로 잇는 의미 연결 — 5단계에서 떠오른다.
const REKNN = { a: 5, b: 3 }

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

/** target으로 부드럽게 따라가는 값. 별과 시냅스가 이 값을 공유해 같은 좌표로 그려지므로 절대 어긋나지 않는다. */
function useEased(target: number, duration: number) {
  const [v, setV] = useState(target)
  useEffect(() => {
    const controls = animate(v, target, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: setV })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration])
  return v
}

export function NightlyConsolidationCard() {
  const reduce = useReducedMotion()
  const concept = useAppearance((s) => s.object)
  const [stage, setStage] = useState(0)
  const [running, setRunning] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [])

  const runNight = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (reduce) {
      setStage(5)
      setRunning(false)
      return
    }
    setRunning(true)
    setStage(1)
    ;[2, 3, 4, 5].forEach((next, i) => {
      timers.current.push(
        setTimeout(
          () => {
            setStage(next)
            if (next === 5) setRunning(false)
          },
          (i + 1) * 1100,
        ),
      )
    })
  }

  const dur = reduce ? 0 : 0.9
  const reweight = useEased(stage >= 2 ? 1 : 0, dur) // 시간↓·의미↑
  const spread = useEased(stage >= 3 ? 1 : 0, dur) // 성단끼리 벌어짐
  const gist = useEased(stage >= 4 ? 1 : 0, dur) // 잊혀가는 별 형태 단순화(요지)
  const prune = useEased(stage >= 5 ? 1 : 0, reduce ? 0 : 0.6) // 약한 선 밝기↓
  const reknn = useEased(stage >= 5 ? 1 : 0, reduce ? 0 : 0.7) // 외톨이 재연결
  const pulse = stage === 1 // 재활성화 깜빡

  // 단일 좌표 소스 — 별과 시냅스가 동일 positions를 참조하므로 어떤 단계에서도 정확히 붙어 움직인다.
  // 자리 고르기: 성단 A는 왼쪽으로, B는 오른쪽으로 흩어진다(far는 스코프 밖이라 불변). 요지: 잊혀가는 별만 줄어든다.
  const positions = STARS.map((s) => {
    const dir = s.cluster === 'A' ? -1 : s.cluster === 'B' ? 1 : 0
    const moved = s.far ? 0 : spread * SPREAD_DX * dir
    return {
      x: s.x + moved,
      y: s.y,
      r: s.r * (s.forgotten ? 1 - gist * 0.4 : 1),
      dim: s.forgotten ? 1 - gist * 0.5 : s.far ? 0.5 : 1,
    }
  })

  /** 링크 종류·단계별 유효 강도. temporal은 재가중에서 약해지고 semantic은 강해진다. */
  const strengthOf = (l: (typeof LINKS)[number]) =>
    l.type === 'semantic'
      ? lerp(0.5, SEMANTIC_STRONG, reweight)
      : lerp(0.5, TEMPORAL_WEAK, reweight)

  return (
    <GlassCard className="flex flex-col gap-4 p-6 sm:p-8" style={{ borderColor: `${ACCENT}33` }}>
      <div className="bg-space-900/60 overflow-hidden rounded-2xl border border-white/10">
        <svg
          viewBox="0 0 160 112"
          className="block w-full"
          role="img"
          aria-label="야간 공고화 시뮬레이션"
        >
          {/* 반경 스코프(change 20) — 이 안의 별만 정돈한다. 정돈이 시작되면 옅게 떠오른다. */}
          <circle
            cx={SCOPE.cx}
            cy={SCOPE.cy}
            r={SCOPE.r}
            fill="none"
            stroke={ACCENT}
            strokeOpacity={reweight * 0.18}
            strokeDasharray="2 4"
          />

          {/* 시냅스 — positions 공유. 약한 idle 선은 가지치기에서 PRUNE_FLOOR까지만 흐려진다(보호 선은 그대로). */}
          {LINKS.map((l, i) => {
            const a = positions[l.a]
            const b = positions[l.b]
            // 약·idle 선만 밝기 바닥으로 — 어두워질 뿐 사라지지 않는다(헌법2). 보호 선은 가지치기 대상이 아니다.
            const opacity = l.weakIdle ? 1 - prune * (1 - PRUNE_FLOOR) : 1
            return (
              <g key={`l-${i}`} opacity={opacity}>
                <VizSynapse
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  color={ACCENT}
                  strength={strengthOf(l)}
                  arc={0.1}
                  active={reweight > 0.4 && l.type === 'semantic'}
                  concept={concept}
                />
              </g>
            )
          })}

          {/* 재-KNN — 외톨이 별이 닮은 기억과 새로 잇는 의미 선. 5단계에서 떠오른다(끊김의 짝, 재연결 안전망). */}
          <g opacity={reknn}>
            <VizSynapse
              x1={positions[REKNN.a].x}
              y1={positions[REKNN.a].y}
              x2={positions[REKNN.b].x}
              y2={positions[REKNN.b].y}
              color={ACCENT}
              strength={lerp(0.2, 0.7, reknn)}
              arc={0.12}
              active={reknn > 0.5}
              concept={concept}
            />
          </g>

          {/* 별 — positions 공유. 재활성화 때 스코프 안 별이 함께 깜빡이고, 요지화로 잊혀가는 별이 작아진다. */}
          <motion.g
            animate={pulse && !reduce ? { opacity: [0.55, 1, 0.55] } : { opacity: 1 }}
            transition={
              pulse && !reduce
                ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.3 }
            }
          >
            {positions.map((p, i) => (
              <g key={`s-${i}`} opacity={p.dim}>
                <VizStar
                  cx={p.x}
                  cy={p.y}
                  r={p.r}
                  color={ACCENT}
                  concept={concept}
                  seed={i * 53 + 11}
                  active={!STARS[i].far && (pulse || reweight > 0.6)}
                />
              </g>
            ))}
          </motion.g>
        </svg>
      </div>

      {/* 4단계 뒤 생물학적 근거: 성단 흥분성은 저장 컬럼을 쓰지 않고 최근 활성 시각에서 자연 감쇠한다. */}
      <p className="text-[11px] leading-relaxed text-white/35">
        그리고 성단 흥분성은 별과 시냅스의 최근 활성 시각에서 τ≈{VALUES.excitability.tauHours}h로
        자연 감쇠해요 — 다음 날의 기억이 어제에 눌리지 않고 새로 자리를 얻도록. 24시간을 주기로 도는{' '}
        <span className="text-white/50">엔그램 회전</span>이에요.
      </p>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-white/40">{STAGES[stage].label}</p>
        <TheoryBadge status="done" plan="27" className="shrink-0" />
        <button
          type="button"
          onClick={runNight}
          disabled={running}
          className={cn(
            'border-mood-violet/40 shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium text-white/90 transition',
            running
              ? 'cursor-default opacity-50'
              : 'hover:border-mood-violet/70 hover:bg-mood-violet/10',
          )}
        >
          {stage === 0 ? '밤 보내기' : running ? STAGES[stage].tag : '다시'}
        </button>
      </div>
    </GlassCard>
  )
}
