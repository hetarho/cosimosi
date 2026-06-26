import { useEffect, useRef, useState } from 'react'

/**
 * 뷰포트 근처 진입 관찰(pages/landing/lib에서 이식 — 이론 데모가 entity로 내려오며 함께).
 * `mounted`는 한 번 들어오면 래치, `visible`은 보이는 동안만 true. IO 부재 환경은 즉시 true.
 */
export function useInView<T extends HTMLElement>(rootMargin = '300px') {
  const ref = useRef<T>(null)
  const noIO = typeof IntersectionObserver === 'undefined'
  const [mounted, setMounted] = useState(noIO)
  const [visible, setVisible] = useState(noIO)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting)
        if (entry.isIntersecting) setMounted(true)
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])

  return { ref, mounted, visible }
}
