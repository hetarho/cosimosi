import { useCallback, useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { MOOD } from '@/shared/config'
import { useStage, type StageScene } from '../../model/stage'
import { STAGE_SEED_COLOR } from '../../lib/stage-projection'
import { TryInUniverse } from './TryInUniverse'

// 무대 위 두 별 — 첫 별(seed)과 닮은 기억 하나. 곡선 시냅스로 자연스럽게 이어진다.
const SEED = { id: 'seed', x: 50, y: 46, size: 0.85, color: STAGE_SEED_COLOR, seed: 7 }
const NEIGHBOR = { id: 'concept-b', x: 26, y: 34, size: 0.6, color: MOOD.teal, seed: 23 }

const sceneSeedOnly: StageScene = { stars: [{ ...SEED, brightness: 1 }], synapses: [] }
const sceneTwoStars: StageScene = {
  stars: [
    { ...SEED, brightness: 1 },
    { ...NEIGHBOR, brightness: 1 },
  ],
  synapses: [],
}
const sceneConnected: StageScene = {
  stars: sceneTwoStars.stars,
  synapses: [{ id: 'concept-syn', a: SEED.id, b: NEIGHBOR.id, color: MOOD.teal, strength: 0.85, active: true }],
}

/**
 * "뇌가 곧 우주예요" (concept, §1.1) — 무대에 별 하나가 추가되며 뉴런(곡선 시냅스)으로 자연스럽게
 * 이어지는 장면. 콘텐츠 트리거는 스크롤 진입(자동 1회) + "다시 이어보기" 버튼.
 */
export function ConceptSection() {
  const reduce = useReducedMotion()
  const isActive = useStage((s) => s.activeAct === 'concept')
  const setScene = useStage((s) => s.setScene)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clear = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const connect = useCallback(() => {
    clear()
    if (reduce) {
      setScene(sceneConnected) // 정적 안착 — 단계 애니메이션 없이 최종 장면
      return
    }
    setScene(sceneSeedOnly)
    timers.current.push(setTimeout(() => setScene(sceneTwoStars), 450))
    timers.current.push(setTimeout(() => setScene(sceneConnected), 950))
  }, [reduce, setScene])

  // 스크롤 진입 시 자동 1회 — 들어올 때마다 연결이 다시 그려진다.
  useEffect(() => {
    if (isActive) connect()
    return clear
  }, [isActive, connect])

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed text-white/55">
        기억 하나가 별이 되고, 닮은 기억이 다가오면 둘은 빛의 선(시냅스)으로 이어져요. 위 무대를 보세요 —
        별 하나가 더해지며 자연스럽게 연결돼요.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={connect}
          className="glass rounded-full px-4 py-2 text-sm text-white/80 transition hover:text-white"
        >
          다시 이어보기
        </button>
        <TryInUniverse sim="engram" />
      </div>
    </div>
  )
}
