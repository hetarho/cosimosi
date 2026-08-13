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
// The reading IS the way in. Pressing anywhere on it opens what the figures are about — how much is
// held, how to come by more — because a separate mark beside the numbers asking "what is this?" put a
// second thing in the corner to aim at, and the numbers themselves were the thing the reader was
// already looking at. Everything the two figures cannot say in a corner is said there instead, which
// is why nothing here unfolds in place any more.
//
// TWO compositions, not one that reflows — and NEITHER draws a surface. The universe is the subject
// of this screen; a bordered card floating over it reads as a panel laid on top of the sky rather
// than a reading taken from it, so both forms sit straight on the sky like the numbers in a game's HUD:
//
// - **Wide**: one line, both labels inline. There is room to name what each figure is.
// - **Phone**: the two readings stacked, icons and figures alone. Two labelled figures on one line
//   cannot share it with the centred clock on a phone, and a phone has room for the numbers a diarist
//   glances at rather than the words naming them — the names are one press away.
//
// Both forms are the same control to assistive tech, named by the region they read. Legibility without
// a surface comes from ink weight plus a drop shadow, because the sky underneath is bright wherever
// the nebula is.
export function TwinkleBalanceHud({ onOpenDetail }: { readonly onOpenDetail?: () => void }) {
  const small = useTwinkleBalanceStore((state) => state.small)
  const general = useTwinkleBalanceStore((state) => state.general)
  const loaded = useTwinkleBalanceStore((state) => state.loaded)

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={m.twinkle_balance_title()}
        onClick={() => onOpenDetail?.()}
        className="pointer-events-auto hidden items-center gap-4 rounded-md py-1.5 pl-1 pr-1 drop-shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:flex"
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
      </button>

      {/* The phone form stays as narrow as its widest figure, because the clock is centred on the same
          line: a labelled row is wider than the corner it would have to fit in and would run into it. */}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={m.twinkle_balance_title()}
        onClick={() => onOpenDetail?.()}
        className="pointer-events-auto flex flex-col items-end gap-0.5 rounded-md px-1 py-1.5 drop-shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:hidden"
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
    </>
  )
}

// The same two figures, at rest on a surface that has room for them: each named, each beside its own
// glyph, with NO SUMMED FIGURE — beside the two it only repeats them, and a total would overstate
// spending power anyway, since what an act costs is drawn from one kind or the other ([G5][P9]).
//
// It belongs to this slice rather than to the surface that shows it: the balance reading is one thing
// with two forms, and both take their figures — and their placeholder — from the same shared mirror.
export function TwinkleBalanceDetail() {
  const small = useTwinkleBalanceStore((state) => state.small)
  const general = useTwinkleBalanceStore((state) => state.general)
  const loaded = useTwinkleBalanceStore((state) => state.loaded)

  return (
    <dl className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <dt className="flex items-center gap-2 text-sm text-text-muted">
          <TwinkleSmallIcon className="shrink-0" />
          {m.twinkle_balance_small_label()}
        </dt>
        <dd className="text-lg font-medium tabular-nums text-text">{figure(loaded, small)}</dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="flex items-center gap-2 text-sm text-text-muted">
          <TwinkleGeneralIcon className="shrink-0" />
          {m.twinkle_balance_general_label()}
        </dt>
        <dd className="text-lg font-medium tabular-nums text-text">{figure(loaded, general)}</dd>
      </div>
    </dl>
  )
}
