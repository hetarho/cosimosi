import { useEffect, useRef, useState } from 'react'

/**
 * 뷰포트 근처 진입을 관찰한다. `mounted`는 한 번 들어오면 래치(true 유지) — 무거운 WebGL 캔버스를
 * 지연 장착하되 재마운트 스터터는 피한다. `visible`은 현재 화면에 보이는 동안만 true — 렌더 루프를
 * 켜고 끄는(frameloop) 데 쓴다. rootMargin로 화면에 닿기 직전 미리 장착한다.
 * IntersectionObserver가 없는 환경(SSR 등)에선 처음부터 mounted/visible=true로 둔다.
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
