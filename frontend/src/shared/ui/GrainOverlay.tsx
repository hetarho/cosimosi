import { useMemo } from 'react'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/shared/lib'

interface GrainOverlayProps {
  /** feTurbulence 주파수 — 높을수록 고운 그레인. */
  baseFrequency?: number
  /** 필름 그레인(빛 알갱이) 레이어 합성 모드. screen이 어두운 배경에서 빛 알갱이처럼 보인다(기본). */
  blendMode?: 'soft-light' | 'overlay' | 'screen'
  className?: string
}

/** feTurbulence 그레이스케일 노이즈를 data-URI로. 같은 인자면 같은 텍스처. */
function noiseUrl(baseFrequency: number, numOctaves: number, size: number) {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>` +
    `<filter id='n'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='${baseFrequency}' numOctaves='${numOctaves}' stitchTiles='stitch'/>` +
    `<feColorMatrix type='saturate' values='0'/>` +
    `</filter>` +
    `<rect width='100%' height='100%' filter='url(#n)'/>` +
    `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/**
 * 필름 그레인 + 디밴딩 디더 오버레이. 두 겹을 깐다:
 *  1) **디밴딩 디더** — 더 고운 노이즈를 `overlay`로 합성해 밝기를 *양방향*으로 흔든다. 어두운
 *     그라디언트가 8비트 양자화로 만드는 동심원 띠("등고선")를 부숴 매끈하게 만든다. (overlay는
 *     중간회색 노이즈의 평균 밝기를 보존하므로 색을 뜨거나 탁하게 만들지 않고 계단만 깬다.)
 *  2) **필름 그레인** — 굵은 노이즈를 `screen`(기본)으로 합성해 사진 같은 빛 알갱이 질감을 더한다.
 * 둘 다 자산 없이 SVG/CSS라 가볍고, 모션 허용 시 미세 지터, reduced-motion이면 정적이다.
 * 세기는 테마 토큰 --ld-deband-opacity / --ld-grain-opacity가 결정한다(미설정 시 .ld-grain의
 * 폴백 — 랜딩 밖 표면(사인인·초대)에서도 과하지 않게). (-z 영역, pointer-events none)
 */
export function GrainOverlay({ baseFrequency = 0.85, blendMode = 'screen', className }: GrainOverlayProps) {
  const reduce = useReducedMotion()
  const grain = useMemo(() => noiseUrl(baseFrequency, 2, 220), [baseFrequency])
  // 디더는 더 곱게(고주파·옥타브↑) — 계단만 살살 부수고 눈에 띄는 노이즈로는 안 보이게.
  const dither = useMemo(() => noiseUrl(Math.min(baseFrequency * 1.7, 1.4), 3, 170), [baseFrequency])

  return (
    <>
      <div
        aria-hidden
        className={cn('ld-grain ld-grain--deband', !reduce && 'ld-grain--animated', className)}
        style={{ backgroundImage: dither, backgroundSize: '170px 170px', mixBlendMode: 'overlay' }}
      />
      <div
        aria-hidden
        className={cn('ld-grain', !reduce && 'ld-grain--animated', className)}
        style={{ backgroundImage: grain, backgroundSize: '220px 220px', mixBlendMode: blendMode }}
      />
    </>
  )
}
