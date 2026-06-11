import { useEffect, useState } from 'react'

/**
 * hover가 없는 터치 기기 여부(`(hover: none)`) — 모바일에선 hover 대신 in-view 트리거로
 * 대체할 때 쓴다(pages/landing/lib에서 이식). SSR/matchMedia 부재 환경은 false.
 */
export function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(hover: none)')
    const sync = () => setCoarse(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return coarse
}
