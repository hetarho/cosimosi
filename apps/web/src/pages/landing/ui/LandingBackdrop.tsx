import type { CSSProperties, RefObject } from 'react'

import { EmptySky } from '../../../widgets/empty-sky/index.ts'
import { useScrollVeil } from '../lib/use-scroll-veil.ts'

// The veil's look at full strength; `--veil` (0..1, written by the scroll hook) scales both. The
// colour mixes from the theme's bg the same way the design system's glass does, so the veiled sky
// reads as the same material family as the cards floating over it.
const VEIL_STYLE: CSSProperties & Record<'--veil', string> = {
  '--veil': '0',
  backdropFilter: 'blur(calc(var(--veil) * 18px)) saturate(calc(1 + var(--veil) * 0.5))',
  WebkitBackdropFilter: 'blur(calc(var(--veil) * 18px)) saturate(calc(1 + var(--veil) * 0.5))',
  backgroundColor: 'color-mix(in oklab, var(--color-bg) calc(var(--veil) * 55%), transparent)',
}

/**
 * The page's floor: the live empty sky (`widgets/empty-sky`) pinned behind everything, and a
 * scroll-driven veil over it. At the top of the page the sky is bare; as the visitor scrolls, the veil blurs and dims it so the
 * sections arriving on top read like glass floating in front of a night that is still there — and
 * then, across `clearAnchor`, it lifts again and hands the sky back.
 *
 * The scene mounts once for the whole page — fixed, not per-section — so scrolling never restarts
 * the renderer, and the veil is a single element whose only moving part is a custom property.
 */
export function LandingBackdrop({
  clearAnchor,
}: {
  /** The section the veil lifts across; without one the veil rises and stays. */
  readonly clearAnchor?: RefObject<HTMLElement | null>
}) {
  const veilRef = useScrollVeil<HTMLDivElement>(clearAnchor)

  return (
    <div aria-hidden className="fixed inset-0">
      <EmptySky />
      <div ref={veilRef} className="absolute inset-0" style={VEIL_STYLE} />
    </div>
  )
}
