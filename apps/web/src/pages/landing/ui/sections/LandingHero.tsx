import type { CSSProperties } from 'react'

import { BrandMark, useReducedMotion } from '@cosimosi/ui'

import { useMarkRecede } from '../../lib/use-mark-recede.ts'
import { LandingScrollCue } from '../LandingScrollCue.tsx'
import { m } from '../../../../shared/i18n/index.ts'

// The first screen: one sentence under the mark, centered in a full viewport of the empty sky. The
// sky itself is the page-level backdrop (LandingBackdrop) — this section contributes the mark, the
// words, and the height that lets the sky be alone with them for one screen.
//
// The mark turns above the headline and is the trademark, not a memory: it takes no GPU context, and
// nothing about it is read from the domain. The stars on this page that DO mean something are in the
// walkthrough, where the captions name what each one is saying.
//
// Scrolling sends it away rather than merely off: it shrinks toward its own centre and winks out, so
// the last of it is a point in a sky already full of them (useMarkRecede). Only the transform moves,
// so the box keeps its size and the headline under it never shifts.
const RECEDE_STYLE: CSSProperties = {
  transform: 'scale(var(--mark-scale, 1))',
  opacity: 'var(--mark-opacity, 1)',
  willChange: 'transform, opacity',
}

export function LandingHero() {
  const reducedMotion = useReducedMotion()
  const markRef = useMarkRecede<HTMLDivElement>(!reducedMotion)

  return (
    <section className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
      {/* A soft local floor under the words only — not the whole viewport — so the headline stays
          legible over whichever sky the visitor gets while the sky stays bare around it. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-104 w-208 max-w-[150vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg/35 blur-3xl"
      />
      <div className="relative flex max-w-2xl flex-col items-center gap-5 text-center">
        <div ref={markRef} style={RECEDE_STYLE} className="size-24 sm:size-28">
          <BrandMark />
        </div>
        <h1 className="text-3xl font-medium leading-tight text-text sm:text-4xl">
          {m.landing_hero_title()}
        </h1>
        <p className="text-base leading-7 text-text-muted">{m.landing_hero_body()}</p>
      </div>
      {/* The one gesture the layout asks for — and the shortcut for taking it. */}
      <LandingScrollCue />
    </section>
  )
}
