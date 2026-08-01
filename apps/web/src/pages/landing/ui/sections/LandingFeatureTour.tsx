import { Card } from '@cosimosi/ui'

import { m } from '../../../../shared/i18n/index.ts'
import { LANDING_TOUR_ITEMS } from '../../config/theory-cards.ts'

// What happens to you, in the order it happens — five plain statements, no canvas. Glass rather
// than solid cards: the veiled sky stays visible through them, so the list reads as floating in
// the same night it describes.
export function LandingFeatureTour() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <h2 className="text-xl font-medium text-text">{m.landing_tour_title()}</h2>
      <ol className="flex flex-col gap-4">
        {LANDING_TOUR_ITEMS.map((item) => (
          <li key={item.id}>
            <Card
              variant="glass"
              className="flex flex-col gap-2 transition duration-300 motion-safe:hover:-translate-y-1 hover:shadow-lg"
            >
              <h3 className="text-base font-medium text-text">{item.title()}</h3>
              <p className="text-sm leading-6 text-text-muted">{item.body()}</p>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  )
}
