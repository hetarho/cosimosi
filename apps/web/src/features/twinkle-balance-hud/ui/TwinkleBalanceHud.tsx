import { useState, type ReactNode } from 'react'

import { useTwinkleBalanceStore } from '@cosimosi/twinkle'
import { TwinkleGeneralIcon, TwinkleSmallIcon } from '@cosimosi/ui'
import { m } from '../../../shared/i18n/index.ts'

// A placeholder rather than a false zero, until the first GetBalance settles ([G5]).
const figure = (loaded: boolean, value: bigint) => (loaded ? String(value) : '—')

// features/twinkle-balance-hud ui ([G2][G5]): the persistent, restrained balance reading. SMALL
// (today's recall-only allowance) and GENERAL (the universal permanent reserve) are always distinct —
// the same glyph at two densities — and the derived total is not shown, because beside the two figures
// it only repeats them. Figures only: no meaning-layer or placement control ([I11]).
//
// TWO compositions, not one that reflows:
//
// - **Wide**: one pill, both labels inline. There is room to name what each figure is.
// - **Phone**: no surface at all, and the two readings stacked — icons and figures alone, drawn
//   straight over the sky like the numbers in a game's HUD. A pill wide enough for two labelled
//   figures cannot share a line with the centred clock on a phone, and a phone has room for the
//   numbers a diarist glances at rather than the words naming them. The names are one tap away: the
//   stack is a disclosure, and expanding it puts each label beside its own figure.
//
// Both forms are the same region to assistive tech. Legibility without a surface comes from ink weight
// plus a drop shadow, because the sky underneath is bright wherever the nebula is.
//
// `action` is a slot for one control the figures belong to (the earn guide) — inside the pill when
// there is one, beside the stack when there is not.
export function TwinkleBalanceHud({ action }: { readonly action?: ReactNode }) {
  const small = useTwinkleBalanceStore((state) => state.small)
  const general = useTwinkleBalanceStore((state) => state.general)
  const loaded = useTwinkleBalanceStore((state) => state.loaded)
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <section
        aria-label={m.twinkle_balance_title()}
        className="pointer-events-auto hidden items-center gap-4 rounded-full border border-border bg-surface/95 py-1.5 pl-3 pr-1.5 backdrop-blur sm:flex"
      >
        <span className="flex items-center gap-1.5">
          <TwinkleSmallIcon className="shrink-0 text-text-muted" />
          <span className="whitespace-nowrap text-xs text-text-muted">
            {m.twinkle_balance_small_label()}
          </span>
          <span className="text-sm font-medium tabular-nums text-text">
            {figure(loaded, small)}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <TwinkleGeneralIcon className="shrink-0 text-text-muted" />
          <span className="whitespace-nowrap text-xs text-text-muted">
            {m.twinkle_balance_general_label()}
          </span>
          <span className="text-sm font-medium tabular-nums text-text">
            {figure(loaded, general)}
          </span>
        </span>
        {action}
      </section>

      {/* The disclosure carries the region's name here, rather than a wrapper naming it a second
          time: with no surface there is no card for a label to belong to.
          The summary stays as narrow as its widest figure and the names arrive BENEATH it rather than
          beside it, because the clock is centred on the same line: a labelled row is wider than the
          corner it would have to fit in, and would run into the clock. The action goes under both for
          the same reason. */}
      <div className="pointer-events-auto flex flex-col items-end drop-shadow-md sm:hidden">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={m.twinkle_balance_title()}
          onClick={() => setExpanded((value) => !value)}
          className="flex flex-col items-end gap-0.5 rounded-md px-1 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <span className="flex items-center gap-1.5">
            <TwinkleSmallIcon className="shrink-0 text-text-muted" />
            <span className="text-sm font-medium tabular-nums text-text">
              {figure(loaded, small)}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <TwinkleGeneralIcon className="shrink-0 text-text-muted" />
            <span className="text-sm font-medium tabular-nums text-text">
              {figure(loaded, general)}
            </span>
          </span>
        </button>
        {/* Which figure is today's allowance and which is the permanent reserve, in the order the
            summary shows them. */}
        {expanded ? (
          <dl className="flex flex-col items-end gap-0.5 px-1 pb-1">
            <div className="flex items-center gap-1.5">
              <dt className="whitespace-nowrap text-xs text-text-muted">
                {m.twinkle_balance_small_label()}
              </dt>
              <dd className="text-xs tabular-nums text-text">{figure(loaded, small)}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="whitespace-nowrap text-xs text-text-muted">
                {m.twinkle_balance_general_label()}
              </dt>
              <dd className="text-xs tabular-nums text-text">{figure(loaded, general)}</dd>
            </div>
          </dl>
        ) : null}
        {action}
      </div>
    </>
  )
}
