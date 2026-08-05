import { Card } from '@cosimosi/ui'

import { m } from '../../../../shared/i18n/index.ts'
import { LANDING_THEORY_CARDS } from '../../config/theory-cards.ts'

// Where the ideas come from, in the register a non-specialist reads. Five strands, one paragraph each.
//
// No citations here by rule, not by omission: the card type has no field for one, and the framing is
// "inspired by" throughout — the product is not a model of anyone's brain and this section is the one
// most likely to be read as claiming it is. Whoever wants the papers follows the link, one tier down.
export function LandingTheory() {
  return (
    // The top inset is the walkthrough screen's, not a tighter one of its own: the two read as two
    // rooms of one page, and a heading that started 16px from the top landed flush against the
    // viewport edge when the visitor arrived here from the cue (ui-principles §2 — a gap that differs
    // without meaning reports the wrong structure).
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 pb-16 pt-14 sm:pt-20">
      <div className="flex flex-col gap-3">
        <h2 className="break-keep text-2xl font-semibold tracking-tight text-text">
          {m.landing_theory_title()}
        </h2>
        <p className="max-w-measure text-base leading-7 text-text-muted">
          {m.landing_theory_intro()}
        </p>
      </div>
      <ul className="flex flex-col gap-6">
        {LANDING_THEORY_CARDS.map((card) => (
          <li key={card.id}>
            {/* No hover lift: the card itself is not a control — only the link inside is — and the
                design language's hover treatment never moves a surface anyway (§9). */}
            <Card variant="glass" className="flex flex-col gap-2">
              <h3 className="break-keep text-lg font-semibold text-text">{card.title()}</h3>
              <p className="max-w-measure text-sm leading-6 text-text-muted">{card.body()}</p>
              {/* A plain anchor with an absolute path, never a router link: `/blog/` is static HTML the
                  Worker serves, and a client navigation would land in the SPA fallback.
                  It is set one step below the body it follows: the accent already makes it the loudest
                  thing in the card, so at body size it out-shouted the title (ui-principles §1 —
                  emphasis is a budget). `py-1.5` keeps the hit area past the 24px floor. */}
              <a
                href={card.blogAnchor}
                className="self-start rounded-sm py-1.5 text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                {m.landing_theory_card_link()}
              </a>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}
