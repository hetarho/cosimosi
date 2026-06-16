import { useEffect, useRef } from 'react'
import { cn } from '@/shared/lib'

/**
 * "밤사이 우주가 한 번 정리됐어요" — 야간 공고화(spec 27) 후 처음 우주를 열 때 1회 뜨는
 * 잔잔한 안내(morning diff). 순수 표시 컴포넌트 — 표시 여부(`show`)는 호출부가 소유하고
 * (라이브: 하루 첫 접속 / 데모: "밤 보내기"), 여기선 잠깐 떠 있다 스스로 사라진다. 캔버스
 * 위 DOM 오버레이라 헌법4(캔버스에 DOM 미주입)와 무관하고, pointer-events 없어 HUD를 안 가린다.
 */
export function MorningDiffNote({
  show,
  onDismiss,
  durationMs = 5200,
}: {
  show: boolean
  onDismiss: () => void
  durationMs?: number
}) {
  // onDismiss는 호출부가 인라인 화살표로 넘겨 매 렌더 identity가 바뀐다. 타이머 effect의 deps에
  // 넣으면 부모 리렌더(데모 시간 머신은 75ms마다 틱)마다 타이머가 리셋돼 노트가 영영 안 닫힌다.
  // 최신 콜백을 ref에 (effect에서) 담아 두고, 타이머는 show/durationMs에만 의존시킨다(단발).
  const dismissRef = useRef(onDismiss)
  useEffect(() => {
    dismissRef.current = onDismiss
  }, [onDismiss])
  useEffect(() => {
    if (!show) return
    const id = setTimeout(() => dismissRef.current(), durationMs)
    return () => clearTimeout(id)
  }, [show, durationMs])

  return (
    <div
      aria-hidden={!show}
      className={cn(
        'pointer-events-none absolute inset-x-0 top-[calc(1.5rem+env(safe-area-inset-top))] z-20 flex justify-center transition-opacity duration-700',
        show ? 'opacity-100' : 'opacity-0',
      )}
    >
      <p className="rounded-full border border-mood-violet/30 bg-black/55 px-4 py-2 text-xs text-white/80 backdrop-blur">
        밤사이 우주가 한 번 정리됐어요
      </p>
    </div>
  )
}
