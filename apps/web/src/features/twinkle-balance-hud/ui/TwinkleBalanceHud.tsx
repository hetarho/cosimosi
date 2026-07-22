import { twinkleTotal, useTwinkleBalanceStore } from '@cosimosi/twinkle'
import { m } from '../../../shared/i18n/index.ts'

// features/twinkle-balance-hud ui ([G2][G5]): the persistent, restrained balance overlay.
// basic (today's daily-reset allowance) and additional (the permanent reserve) are shown
// distinctly so the diarist reads both at a glance; the derived total is the headline.
// basic is always granted ([G5]), so once the read resolves the HUD holds a figure, never
// an empty state — a placeholder shows only until the first GetBalance settles. Figures
// only: no meaning-layer or placement control ([I11]).
export function TwinkleBalanceHud() {
  const basic = useTwinkleBalanceStore((state) => state.basic)
  const additional = useTwinkleBalanceStore((state) => state.additional)
  const loaded = useTwinkleBalanceStore((state) => state.loaded)
  const total = twinkleTotal({ basic, additional })

  return (
    <section
      aria-label={m.twinkle_balance_title()}
      className="pointer-events-auto flex flex-col gap-1 rounded-md border border-border bg-surface/95 px-3 py-2 text-right backdrop-blur"
    >
      <span className="text-base font-medium text-text tabular-nums">
        {loaded ? String(total) : '—'}
      </span>
      <span className="flex justify-end gap-3 text-xs text-text-muted tabular-nums">
        <span>
          {m.twinkle_balance_basic_label()} {loaded ? String(basic) : '—'}
        </span>
        <span aria-hidden>·</span>
        <span>
          {m.twinkle_balance_additional_label()} {loaded ? String(additional) : '—'}
        </span>
      </span>
    </section>
  )
}
