import { useEffect, useState } from 'react'
import { cn } from '@/shared/lib'
import { MOOD } from '@/shared/config'
import { CO_RECALL_DELTA } from '@/features/recall'
import { useStage } from '../../model/stage'
import { useResetOnActive } from '../../lib/use-reset-on-active'
import { TryInUniverse } from './TryInUniverse'

/**
 * "함께 떠올린 기억은 단단해져요" (hebbian, 헵 LTP/LTD §2.1 + 시간 창 §2.2) — 구 HebbianCard +
 * TimeWindowCard. 콘텐츠 버튼이 무대 두 별 사이 시냅스를 실제 규칙대로 강화한다(+CO_RECALL_DELTA,
 * 상한 1.0, 단조). 같은 날이면 시간 창이 열려 보너스가 더 굵게 — 날이 지나면 창이 닫힌다.
 */

const BASE = 0.18
// 같은 날(시간 창 안)이면 더해지는 시간 보너스 — 서버 측 same-day 시간 가중의 시연 값(FE 도메인 상수 없음, 무대 로컬).
const SAME_DAY_BONUS = 0.3

export function HebbianCard() {
  const isActive = useStage((s) => s.activeAct === 'hebbian')
  const setScene = useStage((s) => s.setScene)
  const [recalls, setRecalls] = useState(0)
  const [sameDay, setSameDay] = useState(true)

  // 누적 가중(단조 ↑, 상한 1.0) — 정전 상수 import.
  const weight = Math.min(1, BASE + recalls * CO_RECALL_DELTA)
  // 같은 날이면 시간 창이 열려 보너스가 얹힌다(표시 강도; 창이 닫히면 보너스 없음).
  const strength = Math.min(1, weight + (sameDay ? SAME_DAY_BONUS : 0))

  useResetOnActive(isActive, () => {
    setRecalls(0)
    setSameDay(true)
  })

  useEffect(() => {
    if (!isActive) return
    // 자주 함께 떠올린 별은 서로 더 가까이 머문다(거리 = 연결의 힘).
    const pull = weight * 6
    setScene({
      stars: [
        { id: 'h-a', x: 33 + pull, y: 46, size: 0.62, color: MOOD.teal, seed: 13, brightness: 1 },
        { id: 'h-b', x: 67 - pull, y: 46, size: 0.62, color: MOOD.pink, seed: 41, brightness: 1 },
      ],
      synapses: [{ id: 'h-syn', a: 'h-a', b: 'h-b', color: MOOD.teal, strength, active: strength > 0.5 }],
    })
  }, [isActive, weight, strength, setScene])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setRecalls((n) => n + 1)}
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:border-white/35 hover:text-white"
          style={{ boxShadow: `0 0 22px -10px ${MOOD.teal}` }}
        >
          함께 떠올리기
        </button>
        <button
          type="button"
          onClick={() => setSameDay((v) => !v)}
          aria-pressed={sameDay}
          className={cn(
            'rounded-full border px-4 py-2 text-sm transition',
            sameDay ? 'border-mood-teal/50 text-white' : 'border-white/15 text-white/55 hover:text-white/80',
          )}
        >
          {sameDay ? '같은 날 (창 열림)' : '며칠 뒤 (창 닫힘)'}
        </button>
        {recalls > 0 && (
          <button
            type="button"
            onClick={() => setRecalls(0)}
            className="text-xs text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
          >
            되돌리기
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/3 px-4 py-3">
        <span className="text-[11px] text-white/40">연결 강도</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${strength * 100}%`, background: MOOD.teal }}
          />
        </div>
        <span className="font-mono text-sm text-white/85">{Math.round(strength * 100)}%</span>
      </div>

      <p className="text-xs leading-relaxed text-white/45">
        {recalls === 0
          ? '함께 떠올릴 때마다 둘을 잇는 선이 +5%p씩 굵어지고(상한 100%), 둘은 서로 더 가까이 머물러요.'
          : sameDay
            ? `${recalls}번 함께 떠올렸어요 — 같은 날이라 시간 창이 열려 보너스가 더 굵게 얹혔어요.`
            : `${recalls}번 함께 떠올렸어요 — 날이 지나 시간 창은 닫혔고, 누적 가중만 남았어요(단조 강화).`}
      </p>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <TryInUniverse sim="hebbian" />
      </div>
    </div>
  )
}
