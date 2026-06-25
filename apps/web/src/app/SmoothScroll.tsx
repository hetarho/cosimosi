import type { ReactNode } from 'react'
import { ReactLenis } from 'lenis/react'
import { useReducedMotion } from 'motion/react'

/** Lenis 관성 스무스 스크롤. prefers-reduced-motion이면 네이티브 스크롤로 폴백. */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>
  return (
    <ReactLenis root options={{ lerp: 0.1, smoothWheel: true }}>
      {children}
    </ReactLenis>
  )
}
