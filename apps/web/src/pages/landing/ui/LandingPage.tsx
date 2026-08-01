import type { ComponentType } from 'react'

import { m, type Locale } from '../../../shared/i18n/index.ts'
import {
  LANDING_SECTIONS,
  type LandingSectionId,
  type LandingSectionProps,
} from '../model/sections.ts'
import { LandingBackdrop } from './LandingBackdrop.tsx'
import { LandingLocaleSwitch } from './LandingLocaleSwitch.tsx'
import { LandingBlogLink } from './sections/LandingBlogLink.tsx'
import { LandingClosing, LandingDemoCtaSection } from './sections/LandingCtas.tsx'
import { LandingFeatureTour } from './sections/LandingFeatureTour.tsx'
import { LandingHero } from './sections/LandingHero.tsx'
import { LandingMirror } from './sections/LandingMirror.tsx'
import { LandingPlayground } from './sections/LandingPlayground.tsx'
import { LandingTheory } from './sections/LandingTheory.tsx'

// The section→component map, exhaustive over the id union. Together with the tuple it is the page's ONLY
// render path: there is no second place a section could be rendered from, and no id can be mapped to
// nothing, so the prescribed order is a compile-time fact rather than the current shape of some JSX.
const SECTION_VIEWS: Readonly<Record<LandingSectionId, ComponentType<LandingSectionProps>>> = {
  hero: LandingHero,
  playground: LandingPlayground,
  'demo-cta-top': LandingDemoCtaSection,
  'feature-tour': LandingFeatureTour,
  mirror: LandingMirror,
  theory: LandingTheory,
  blog: LandingBlogLink,
  'closing-cta': LandingClosing,
}

export interface LandingPageProps {
  readonly locale: Locale
  readonly onSelectLocale: (next: Locale) => void
  readonly onTryDemo: () => void
  readonly onSignUp: () => void
}

// pages/landing: the product's front door, and the only screen a stranger sees before deciding anything.
//
// It composes and holds no logic — no session, no product read, and no way to obtain either: the public
// import closure puts the transport, the generated clients and the query seam out of reach, so "the front
// door called the server" is not expressible here regardless of who is looking at it.
//
// Both destinations arrive as callbacks, because a page may not import the router (§3.1) — the same seam
// the universe page uses for the archive and the account home.
export function LandingPage({ locale, onSelectLocale, onTryDemo, onSignUp }: LandingPageProps) {
  return (
    <main className="min-h-dvh text-text">
      {/* The live sky behind everything, veiled as the visitor scrolls — see LandingBackdrop. The main
          itself paints no background: an opaque floor here would wall the fixed scene off. */}
      <LandingBackdrop />
      {/* The header is chrome, not one of the prescribed sections — it carries the language switch and
          nothing that competes with the page's first sentence. */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-4">
        <p className="text-sm text-text-muted">{m.landing_wordmark()}</p>
        <LandingLocaleSwitch locale={locale} onSelectLocale={onSelectLocale} />
      </header>
      <div className="relative z-10">
        {LANDING_SECTIONS.map((id) => {
          const Section = SECTION_VIEWS[id]
          return <Section key={id} onTryDemo={onTryDemo} onSignUp={onSignUp} />
        })}
      </div>
    </main>
  )
}
