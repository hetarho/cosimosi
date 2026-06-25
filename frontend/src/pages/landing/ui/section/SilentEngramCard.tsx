import { useCallback, useEffect, useState } from 'react'
import { MOOD } from '@/shared/config'
import { A_MIN, HALF_LIFE_DAYS } from '@/entities/memory'
import { useStage, type StageStar } from '../../model/stage'
import { useResetOnActive } from '../../lib/use-reset-on-active'
import { TryInUniverse } from './TryInUniverse'

/**
 * "잊어도 사라지지 않아요" (forgetting, 망각·침묵 엔그램 §4.1–4.2) — "시간 흐르기"로 무대 별이
 * 밝기 바닥(A_MIN)까지 어두워지되 사라지지 않고(헌법 §2), 연결도 함께 옅어질 뿐 남는다. 어두운 별을
 * 클릭하면 다시 밝아진다(재점화). 감쇠는 정전 상수(A_MIN·HALF_LIFE_DAYS) import — 표류 방지.
 */

interface Node {
  id: string
  x: number
  y: number
  color: string
  seed: number
  /** 마지막 회상 이후 흐른 날 — 0이면 갓 떠올린 별. */
  days: number
}

const INITIAL: Node[] = [
  { id: 'f-a', x: 32, y: 42, color: MOOD.teal, seed: 13, days: 0 },
  { id: 'f-b', x: 58, y: 38, color: MOOD.violet, seed: 41, days: 0 },
  { id: 'f-c', x: 48, y: 64, color: MOOD.coral, seed: 73, days: 0 },
]

const LINKS = [
  { id: 's-ab', a: 'f-a', b: 'f-b' },
  { id: 's-bc', a: 'f-b', b: 'f-c' },
]

// activation(Δt) = 2^(-Δt/halfLife); 밝기는 A_MIN 바닥에서 멈춘다(사라지지 않음).
function brightnessOf(days: number): number {
  return Math.max(A_MIN, Math.pow(2, -days / HALF_LIFE_DAYS))
}

// 눈에 띄게 어두워진 별만 클릭(재점화)을 권한다. 한 반감기(첫 클릭)면 밝기 0.5 — 그 이하를 "어두움"으로 본다.
const DIM_THRESHOLD = 0.55

export function SilentEngramCard() {
  const isActive = useStage((s) => s.activeAct === 'forgetting')
  const setScene = useStage((s) => s.setScene)
  const setStarClick = useStage((s) => s.setStarClick)
  const [nodes, setNodes] = useState<Node[]>(INITIAL)

  useResetOnActive(isActive, () => setNodes(INITIAL))

  // 어두운 별 클릭 → 재점화(그 별만 days=0). 무대(StageLayer)가 clickable 별에 이 핸들러를 건다.
  const reignite = useCallback(
    (id: string) => setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, days: 0 } : n))),
    [],
  )

  useEffect(() => {
    if (!isActive) return
    setStarClick(reignite)
    return () => setStarClick(null)
  }, [isActive, reignite, setStarClick])

  useEffect(() => {
    if (!isActive) return
    const stars: StageStar[] = nodes.map((n) => {
      const brightness = brightnessOf(n.days)
      return {
        id: n.id,
        x: n.x,
        y: n.y,
        size: 0.6,
        color: n.color,
        brightness,
        seed: n.seed,
        clickable: brightness < DIM_THRESHOLD, // 어두워진 별만 클릭(재점화)을 권한다
      }
    })
    setScene({
      stars,
      synapses: LINKS.map((l) => ({ id: l.id, a: l.a, b: l.b, color: MOOD.violet, strength: 0.7 })),
    })
  }, [isActive, nodes, setScene])

  const anyDim = nodes.some((n) => brightnessOf(n.days) < DIM_THRESHOLD)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setNodes((prev) => prev.map((n) => ({ ...n, days: n.days + HALF_LIFE_DAYS })))}
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:border-white/35 hover:text-white"
        >
          시간 흐르기
        </button>
        {anyDim && <span className="text-xs text-white/45">위 무대에서 어두워진 별을 클릭하면 다시 깨어나요.</span>}
      </div>

      <p className="text-xs leading-relaxed text-white/45">
        오래 떠올리지 않은 별은 어두워질 뿐, 연결을 품은 채 그 자리에 남아요 — 밝기는 바닥
        (A_MIN&nbsp;{A_MIN})에서 멈추고 사라지지 않아요. 잊는다는 건 지우는 게 아니라 길을 잃는 일이에요.
        회상 한 번이면 다시 깨어나요.
      </p>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <TryInUniverse sim="dormant" />
      </div>
    </div>
  )
}
