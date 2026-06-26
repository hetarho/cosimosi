// 데모 가상 시계 읽기값(change 24) — 배속 흐름이 눈에 보이도록 "며칠째 · 오전/오후 N시"를 1초마다 다시
// 읽어 상단에 띄운다. 분은 일부러 빼는데, 배속이 1시간/초만 돼도 1초에 60분이 지나가 분 단위는 노이즈가
// 되기 때문이다(시 단위가 또렷이 오른다). 04:00을 지날 때 날짜가 오르며 야간 공고화가 돈다 — 시간이
// 흐른다는 직접 신호. 자체 ticker라 무거운 HomePage를 리렌더하지 않고 이 작은 pill만 갱신된다.
import { useEffect, useState } from 'react'
import { demoClock, getDemoClockSpeed } from '@/shared/lib/demo'

/** 24시간 → "오전/오후 N시"(12시간제, 0시=오전 12시·정오=오후 12시). */
function hourLabel(hour: number): string {
  const ampm = hour < 12 ? '오전' : '오후'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${ampm} ${h12}시`
}

export function DemoClockReadout() {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const { day, hour } = demoClock()
  const paused = getDemoClockSpeed() === 'paused'
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/65 backdrop-blur"
      aria-live="off"
      title="체험 가상 시계 — 배속만큼 흘러가고, 04:00마다 우주가 스스로 정리돼요"
    >
      <span className="tabular-nums">
        {day}일째 · {hourLabel(hour)}
      </span>
      {paused && <span className="text-white/40">· 정지</span>}
    </div>
  )
}
