import { useEffect, useState } from 'react'

/**
 * 터치(coarse pointer) 기기 여부 — `(pointer: coarse)`. 오버레이가 모바일(바텀시트)과
 * 데스크톱(사이드 패널)을 가르는 분기에 쓴다(spec 31, 헌법4 — 플랫폼 분기는 ui 레이어).
 * SSR/matchMedia 부재 환경은 false(데스크톱 가정). entities/theory·landing의 hover 기반
 * 변형과 달리, 여기선 입력 장치(터치 vs 마우스) 자체를 본다.
 */
export function useCoarsePointer(): boolean {
  // 초기값을 matchMedia로 시드한다 — false로 시작하면 모바일 딥링크(`?panel=…`)가 첫 페인트에서
  // 데스크톱 사이드 패널을 그렸다가 바텀시트로 깜빡인다(SSR/matchMedia 부재면 false).
  const [coarse, setCoarse] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(pointer: coarse)')
    const sync = () => setCoarse(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return coarse
}
