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
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-medium text-text">{m.landing_theory_title()}</h2>
        <p className="text-base leading-7 text-text-muted">{m.landing_theory_intro()}</p>
      </div>
      <ul className="flex flex-col gap-4">
        {LANDING_THEORY_CARDS.map((card) => (
          <li key={card.id}>
            <Card className="flex flex-col gap-2">
              <h3 className="text-base font-medium text-text">{card.title()}</h3>
              <p className="text-sm leading-6 text-text-muted">{card.body()}</p>
              {/* A plain anchor with an absolute path, never a router link: `/blog/` is static HTML the
                  Worker serves, and a client navigation would land in the SPA fallback. */}
              <a
                href={card.blogAnchor}
                className="self-start text-sm text-primary underline-offset-4 hover:underline"
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
