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
  /** 깊이(0=먼 별, 1=가까운 별). 시차(parallax) 오프셋 배율. */
  z: number
}

export interface StarFieldProps {
  /** 별 개수. */
  count?: number
  className?: string
  /** 별 색(기본 SPACE.star). */
  color?: string
  /** 반지름 배율(밀도 높은 딥필드용으로 작게/크게). */
  sizeScale?: number
  /** 최대 알파 상한(0~1). */
  maxAlpha?: number
  /**
   * 마우스 시차 강도(px). 0이면 비활성. 깊이(z)에 비례해 별이 커서를 거슬러 떠
   * "유리창 너머 우주" 같은 입체감을 준다. reduced-motion이면 무시.
   */
  parallax?: number
}

/**
 * 가벼운 배경 별 필드. requestAnimationFrame으로 명멸하고, 탭이 백그라운드면 멈춘다.
 * prefers-reduced-motion이면 정적으로 1회만 그린다. (Canvas 2D, three 미사용)
 * 깊이(z)·시차·색·밀도는 옵션이며, 기본값은 기존 동작과 동일하다.
 */
export function StarFieldCanvas({
  count = 130,
  className,
  color = SPACE.star,
  sizeScale = 1,
  maxAlpha = 1,
  parallax = 0,
}: StarFieldProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const useParallax = parallax > 0 && !reduce
    let stars: Star[] = []
    let raf = 0
    // 시차: 현재/목표 마우스 오프셋(부드럽게 보간).
    let px = 0
    let py = 0
    let tpx = 0
    let tpy = 0

    const resize = () => {
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: (Math.random() * 1.2 + 0.3) * dpr * sizeScale,
        baseA: Math.random() * 0.5 + 0.2,
        tw: Math.random() * 0.6 + 0.2,
        ph: Math.random() * Math.PI * 2,
        z: Math.random(),
      }))
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      px += (tpx - px) * 0.06
      py += (tpy - py) * 0.06
      for (const s of stars) {
        const a = reduce ? s.baseA : s.baseA + Math.sin(t * 0.001 + s.ph) * s.tw * 0.35
        ctx.globalAlpha = Math.max(0, Math.min(maxAlpha, a))
        ctx.beginPath()
        const ox = useParallax ? px * dpr * (0.3 + s.z) : 0
        const oy = useParallax ? py * dpr * (0.3 + s.z) : 0
        ctx.arc(s.x + ox, s.y + oy, s.r, 0, Math.PI * 2)
        ctx.fillStyle = color
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
    const onMouse = (e: MouseEvent) => {
      tpx = (e.clientX / window.innerWidth - 0.5) * parallax
      tpy = (e.clientY / window.innerHeight - 0.5) * parallax
    }

    resize()
    start()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    if (useParallax) window.addEventListener('mousemove', onMouse, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('mousemove', onMouse)
    }
  }, [count, reduce, color, sizeScale, maxAlpha, parallax])

  return <canvas ref={ref} aria-hidden className={className} />
}
