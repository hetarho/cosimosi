import { useTwinkleBalanceStore } from '@cosimosi/twinkle'
import { useTwinkleBalanceQuery } from '@cosimosi/twinkle/react'

import { m } from '../../../shared/i18n/index.ts'

// The two kinds, each labeled, with NO SUMMED FIGURE. A total belongs on the universe HUD, where the
// paying actions are recalls and a recall really can draw SMALL→GENERAL ([G2][G5]). Here — on the
// surface a purchase is contemplated from — a total would overstate spending power, because an ornament
// prices against GENERAL alone ([P9]). The guard is the ABSENT number, not an annotation explaining it.
//
// It reads the same shared store and query as the HUD and does not mount the HUD itself: a feature may
// not import a feature (§3.1), and the HUD's over-canvas chrome has no business in a page tab.
export function TwinkleBalanceSummary() {
  const small = useTwinkleBalanceStore((state) => state.small)
  const general = useTwinkleBalanceStore((state) => state.general)
  const loaded = useTwinkleBalanceStore((state) => state.loaded)
  // The tab is its own reader — mounted without the overlay, nothing else would fetch the balance.
  useTwinkleBalanceQuery()

  return (
    <section aria-label={m.twinkle_balance_title()} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-text-muted">{m.twinkle_balance_small_label()}</span>
        <span className="text-base text-text tabular-nums">{loaded ? String(small) : '—'}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-text-muted">{m.twinkle_balance_general_label()}</span>
        <span className="text-base text-text tabular-nums">{loaded ? String(general) : '—'}</span>
      </div>
    </section>
  )
}
