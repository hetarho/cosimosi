// Film-grain overlay for the universe view — a DOM/SVG layer ON TOP of the WebGPU canvas
// (NOT inside the bloom pipeline), so it can never blank the 3D scene. Reuses the global
// `.ld-grain` CSS shell (position/size/animation) from app/styles, but supplies its own
// opacity + blend inline so it doesn't depend on the landing-only `--ld-grain-*` theme
// tokens. `screen` blend over the dark space background reads as fine light-grain speckle;
// pointer-events:none (in the class) keeps the HUD fully interactive.
import { useMemo } from 'react'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/shared/lib'

/** Grayscale feTurbulence noise as a data-URI (asset-free). Same args → same texture. */
function noiseUrl(baseFrequency: number, numOctaves: number, size: number): string {
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

export interface UniverseGrainProps {
  /** Overlay strength (0..1). Subtle by default. */
  opacity?: number
  /** feTurbulence frequency — higher = finer grain. */
  baseFrequency?: number
}

export function UniverseGrain({ opacity = 0.12, baseFrequency = 0.9 }: UniverseGrainProps) {
  const reduce = useReducedMotion()
  const grain = useMemo(() => noiseUrl(baseFrequency, 2, 200), [baseFrequency])
  return (
    <div
      aria-hidden
      className={cn('ld-grain', !reduce && 'ld-grain--animated')}
      style={{ backgroundImage: grain, backgroundSize: '200px 200px', mixBlendMode: 'screen', opacity }}
    />
  )
}
