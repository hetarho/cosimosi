import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { SPACE } from '@/shared/config'

interface Star {
  x: number
  y: number
  r: number
  baseA: number
  tw: number
  ph: number
}

/**
 * 가벼운 배경 별 필드. requestAnimationFrame으로 명멸하고, 탭이 백그라운드면 멈춘다.
 * prefers-reduced-motion이면 정적으로 1회만 그린다. (Canvas 2D, three 미사용)
 */
export function StarFieldCanvas({ count = 130, className }: { count?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let stars: Star[] = []
    let raf = 0

    const resize = () => {
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: (Math.random() * 1.2 + 0.3) * dpr,
        baseA: Math.random() * 0.5 + 0.2,
        tw: Math.random() * 0.6 + 0.2,
        ph: Math.random() * Math.PI * 2,
      }))
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const s of stars) {
        const a = reduce ? s.baseA : s.baseA + Math.sin(t * 0.001 + s.ph) * s.tw * 0.35
        ctx.globalAlpha = Math.max(0, Math.min(1, a))
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = SPACE.star
        ctx.fill()
      }
      ctx.globalAlpha = 1
      if (!reduce && document.visibilityState === 'visible') raf = requestAnimationFrame(draw)
    }

    const start = () => {
      cancelAnimationFrame(raf)
      if (reduce) draw(0)
      else raf = requestAnimationFrame(draw)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start()
      else cancelAnimationFrame(raf)
    }

    resize()
    start()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [count, reduce])

  return <canvas ref={ref} aria-hidden className={className} />
}
