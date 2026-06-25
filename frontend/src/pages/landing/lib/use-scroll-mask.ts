import { useEffect, useState, type RefObject } from 'react'
import { useScroll, useTransform, useMotionTemplate, type MotionValue } from 'motion/react'

/**
 * 상단 고정 무대(투명) 아래로 스크롤되어 들어가는 콘텐츠를 **마스킹**으로 부드럽게 가린다(change 31 후속).
 * 무대가 불투명하면 배경+그림자로 덮으면 되지만 무대는 투명하므로, 콘텐츠 자체를 화면 상단 띠에서 점진적으로
 * 투명하게 만든다 — div 통째 페이드가 아니라 **위에서부터 조금씩** 사라진다(부드러운 occlusion).
 *
 * 원리: 요소-로컬 세로 그라디언트 마스크의 transparent→opaque 경계를 스크롤로 이동시켜, 그 경계가 늘
 * 화면 상단 띠(viewport [FADE_START, FADE_END])에 머물게 한다. 요소가 띠 아래에 있으면 경계가 음수라 전부 불투명.
 * window(Lenis) 스크롤을 그대로 쓰므로 스크롤 모델을 바꾸지 않는다.
 */
const FADE_START = 0.14 // viewport 비율 — 이 위(상단)는 완전 투명
const FADE_END = 0.46 // 이 아래는 불투명 — 그 사이가 부드러운 그라디언트(투명 영역을 넉넉히)

export function useScrollMask(ref: RefObject<HTMLElement | null>): MotionValue<string> {
  const [docTop, setDocTop] = useState(0)
  const [vh, setVh] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight))
  useEffect(() => {
    const measure = () => {
      const el = ref.current
      if (!el) return
      // 문서 기준 top(스크롤 위치와 무관) — 매 스크롤 a/b 계산의 기준점.
      setDocTop(el.getBoundingClientRect().top + window.scrollY)
      setVh(window.innerHeight)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [ref])

  const { scrollY } = useScroll()
  // 요소 윗머리가 화면 상단 위로 올라간 양(아직 아래면 음수) + 띠 오프셋 = 요소-로컬 마스크 경계 위치.
  const a = useTransform(scrollY, (sy) => sy - docTop + vh * FADE_START)
  const b = useTransform(scrollY, (sy) => sy - docTop + vh * FADE_END)
  return useMotionTemplate`linear-gradient(to bottom, transparent ${a}px, #000 ${b}px)`
}
