import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/shared/lib'
import { MOOD, VALUES } from '@/shared/config'
import { useStage, type StageScene } from '../../model/stage'
import { useResetOnActive } from '../../lib/use-reset-on-active'

const ACCENT = MOOD.violet
// 가지치기 후 약한 선이 가닿는 최소 밝기(바닥) — 0이 아니라 floor라 선은 어두워질 뿐 사라지지 않는다(헌법 §2).
const PRUNE_FLOOR = 0.16

const STAGES = [
  { tag: '대기', label: '잠들기 전 — 낮에 담은 두 작은 성단' },
  { tag: '1 · 재활성화', label: '다시 깜빡여요 — 낮의 별들이 깨어나요' },
  { tag: '2 · 재분배', label: '겹치지 않게 자리를 골라요 — 성단끼리 살짝 흩어져요' },
  { tag: '3 · 요지', label: '멀리 잊혀가는 별은 형태가 단순해지고 내용이 흐려져요 — 줄거리만' },
  { tag: '4 · 가지치기', label: '약한 선은 빛만 낮추되 별마다 하나는 지켜요 — 삭제는 없어요' },
] as const

/** 단계별 무대 장면 — 별·선은 어느 단계에서도 사라지지 않는다(밝기·크기만 변함, 헌법 §2). */
function sceneFor(stage: number): StageScene {
  const spread = stage >= 2 ? 1 : 0
  const gist = stage >= 3 ? 1 : 0
  const prune = stage >= 4 ? 1 : 0
  const lively = stage === 1 // 재활성화 — 또렷하게
  const dx = spread * 7
  const b = lively ? 1 : 0.9
  return {
    stars: [
      { id: 'a0', x: 38 - dx, y: 38, size: 0.6, color: ACCENT, seed: 11, brightness: b },
      { id: 'a1', x: 30 - dx, y: 58, size: 0.55, color: ACCENT, seed: 23, brightness: b },
      { id: 'b0', x: 64 + dx, y: 36, size: 0.6, color: ACCENT, seed: 37, brightness: b },
      { id: 'b1', x: 72 + dx, y: 56, size: 0.55, color: ACCENT, seed: 53, brightness: b },
      // 멀리 잊혀가는 별 — 요지화로 형태가 작아지고(단순화) 내용이 흐려진다(밝기↓, 사라지진 않음).
      { id: 'fg', x: 50, y: 70, size: 0.5 * (1 - gist * 0.4), color: ACCENT, seed: 71, brightness: 1 - gist * 0.5 },
    ],
    synapses: [
      // 의미로 닿은 선 — 강화/유지.
      { id: 'a0a1', a: 'a0', b: 'a1', color: ACCENT, strength: 0.8, active: true },
      { id: 'b0b1', a: 'b0', b: 'b1', color: ACCENT, strength: 0.8, active: true },
      // 잊혀가는 별의 마지막 살아있는 선 — 가지치기에도 지켜진다(보호).
      { id: 'a1fg', a: 'a1', b: 'fg', color: ACCENT, strength: 0.7 },
      // 성단 사이 시간으로 맺힌 약한 선 — 가지치기에서 밝기 바닥까지만(삭제 없음).
      { id: 'a0b0', a: 'a0', b: 'b0', color: ACCENT, strength: 0.5 - prune * (0.5 - PRUNE_FLOOR) },
    ],
  }
}

/**
 * "밤마다 우주가 정리돼요" (nightly, 공고화·수면 §5.1) — "밤 보내기"로 무대에서 재활성화 → 재분배 →
 * 요지화(형태 단순화·내용 흐려짐) → 가지치기(약한 링크 밝기↓·마지막 링크 보호·삭제 없음) 단계가 펼쳐진다.
 */
export function NightlyConsolidationCard() {
  const reduce = useReducedMotion()
  const isActive = useStage((s) => s.activeAct === 'nightly')
  const setScene = useStage((s) => s.setScene)
  const [stage, setStage] = useState(0)
  const [running, setRunning] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clear = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  // 비활성/언마운트 시 진행 중인 단계 타이머 정리(부수효과만 — 상태 초기화는 useResetOnActive가).
  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [isActive])

  // 스크롤 진입 시 첫 단계로 되돌린다(다시 시연 가능).
  useResetOnActive(isActive, () => {
    setStage(0)
    setRunning(false)
  })

  useEffect(() => {
    if (isActive) setScene(sceneFor(stage))
  }, [isActive, stage, setScene])

  const runNight = () => {
    clear()
    if (reduce) {
      setStage(4) // 정적 안착 — 마지막 단계
      return
    }
    setRunning(true)
    setStage(1)
    ;[2, 3, 4].forEach((next, i) => {
      timers.current.push(
        setTimeout(() => {
          setStage(next)
          if (next === 4) setRunning(false)
        }, (i + 1) * 1100),
      )
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runNight}
          disabled={running}
          className={cn(
            'border-mood-violet/40 rounded-full border px-4 py-2 text-sm font-medium text-white/90 transition',
            running ? 'cursor-default opacity-50' : 'hover:border-mood-violet/70 hover:bg-mood-violet/10',
          )}
        >
          {stage === 0 ? '밤 보내기' : running ? STAGES[stage].tag : '다시'}
        </button>
        <span className="text-xs text-white/45">{STAGES[stage].label}</span>
      </div>

      <p className="text-[11px] leading-relaxed text-white/35">
        그리고 성단 흥분성은 별과 시냅스의 최근 활성 시각에서 τ≈{VALUES.excitability.tauHours}h로 자연 감쇠해요 —
        다음 날의 기억이 어제에 눌리지 않고 새로 자리를 얻도록. 약한 선도 빛만 낮출 뿐, 별도 선도 우주에서 사라지지 않아요.
      </p>
    </div>
  )
}
