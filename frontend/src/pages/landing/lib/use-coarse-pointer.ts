import { useEffect, useState } from 'react'

/**
 * hover가 없는 터치 기기 여부(`(hover: none)`). 모바일에선 hover 대신 다른 트리거(예: in-view)로
 * 인터랙션을 대체할 때 쓴다. SSR/`matchMedia` 부재 환경에선 false.
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
