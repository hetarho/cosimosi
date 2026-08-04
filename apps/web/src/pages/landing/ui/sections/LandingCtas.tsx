import { Button } from '@cosimosi/ui'

import { m } from '../../../../shared/i18n/index.ts'
import type { LandingSectionProps } from '../../model/sections.ts'

// The two asks, and the order between them.
//
// A stranger has no reason to trust a signup form yet, and the product's whole claim is that it only
// reads in motion — so the demo goes first, both times. `LandingClosing` hardcodes that order and
// **exposes no ordering prop**, which is what makes "demo before signup" something a call site cannot
// get wrong rather than something a reviewer has to check.
//
// `DemoCta` is exported on its own because its first appearance belongs to the walkthrough screen it
// closes rather than to a section here; the pairing rule above only governs where both buttons meet.

// Outlined, because the ask that matters is the signup below — the demo is the low-stakes side door.
// Large, because it is the one thing a stranger is meant to reach for on a page they are still
// skimming; the two read as one pair, so the signup carries the same size rather than the default.
export function DemoCta({ onTryDemo }: Pick<LandingSectionProps, 'onTryDemo'>) {
  return (
    <Button color="primary" variant="outlined" size="lg" onClick={onTryDemo}>
      {m.landing_cta_demo()}
    </Button>
  )
}

function SignUpCta({ onSignUp }: Pick<LandingSectionProps, 'onSignUp'>) {
  return (
    <Button color="primary" size="lg" onClick={onSignUp}>
      {m.landing_cta_signup()}
    </Button>
  )
}

/** The `'closing-cta'` section: the same invitation, then the ask. */
export function LandingClosing({ onTryDemo, onSignUp }: LandingSectionProps) {
  return (
    <section className="flex flex-col items-center gap-6 px-6 py-20">
      <h2 className="max-w-xl text-center text-2xl font-medium text-text">
        {m.landing_closing_title()}
      </h2>
      {/* Side by side, demo on the left — the reading order is the same order the column had, and
          `flex-wrap` lets the pair fall back to stacked on a narrow phone rather than shrinking. */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <DemoCta onTryDemo={onTryDemo} />
        <SignUpCta onSignUp={onSignUp} />
      </div>
    </section>
  )
}
