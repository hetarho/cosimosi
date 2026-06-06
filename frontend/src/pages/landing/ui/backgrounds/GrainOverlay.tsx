import { useMemo } from 'react'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/shared/lib'

interface GrainOverlayProps {
  /** feTurbulence 주파수 — 높을수록 고운 그레인. */
  baseFrequency?: number
  /** 합성 모드. screen이 어두운 배경에서 그레인을 빛 알갱이처럼 보이게 한다(기본). */
  blendMode?: 'soft-light' | 'overlay' | 'screen'
  className?: string
}

/**
 * 필름 그레인 오버레이. SVG feTurbulence 노이즈를 data-URI로 타일링해 화면 전체에 깐다.
 * 불투명도는 테마 토큰 --ld-grain-opacity가 결정(.ld-grain). 모션 허용 시 미세하게 지터링하고
 * prefers-reduced-motion이면 정적. 자산 없이 순수 CSS/SVG라 가볍다. (-z 영역, pointer-events none)
 */
export function GrainOverlay({ baseFrequency = 0.85, blendMode = 'screen', className }: GrainOverlayProps) {
  const reduce = useReducedMotion()
  const backgroundImage = useMemo(() => {
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>` +
      `<filter id='n'>` +
      `<feTurbulence type='fractalNoise' baseFrequency='${baseFrequency}' numOctaves='2' stitchTiles='stitch'/>` +
      `<feColorMatrix type='saturate' values='0'/>` +
      `</filter>` +
      `<rect width='100%' height='100%' filter='url(#n)'/>` +
      `</svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  }, [baseFrequency])

  return (
    <div
      aria-hidden
      className={cn('ld-grain', !reduce && 'ld-grain--animated', className)}
      style={{ backgroundImage, backgroundSize: '200px 200px', mixBlendMode: blendMode }}
    />
  )
}
