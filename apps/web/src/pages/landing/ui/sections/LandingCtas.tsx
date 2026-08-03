import { Button } from '@cosimosi/ui'

import { m } from '../../../../shared/i18n/index.ts'
import type { LandingSectionProps } from '../../model/sections.ts'

// The two asks, and the order between them.
//
// A stranger has no reason to trust a signup form yet, and the product's whole claim is that it only
// reads in motion — so the demo goes first, both times. `LandingClosing` hardcodes that order and
// **exposes no ordering prop**, which is what makes "demo before signup" something a call site cannot
// get wrong rather than something a reviewer has to check.

// Outlined, because the ask that matters is the signup below — the demo is the low-stakes side door.
export function DemoCta({ onTryDemo }: Pick<LandingSectionProps, 'onTryDemo'>) {
  return (
    <Button color="primary" variant="outlined" onClick={onTryDemo}>
      {m.landing_cta_demo()}
    </Button>
  )
}

function SignUpCta({ onSignUp }: Pick<LandingSectionProps, 'onSignUp'>) {
  return (
    <Button color="primary" onClick={onSignUp}>
      {m.landing_cta_signup()}
    </Button>
  )
}

/** The `'demo-cta-top'` section: the invitation above the fold, on its own. */
export function LandingDemoCtaSection({ onTryDemo }: LandingSectionProps) {
  return (
    <section className="flex justify-center px-6 py-10">
      <DemoCta onTryDemo={onTryDemo} />
    </section>
  )
}

/** The `'closing-cta'` section: the same invitation, then the ask. */
export function LandingClosing({ onTryDemo, onSignUp }: LandingSectionProps) {
  return (
    <section className="flex flex-col items-center gap-6 px-6 py-20">
      <h2 className="max-w-xl text-center text-2xl font-medium text-text">
        {m.landing_closing_title()}
      </h2>
      <div className="flex flex-col items-center gap-4">
        <DemoCta onTryDemo={onTryDemo} />
        <SignUpCta onSignUp={onSignUp} />
      </div>
    </section>
  )
}
