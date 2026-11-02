import type { ReactNode } from 'react'

import { TwinkleBalance } from '../../../entities/twinkle/index.ts'
import { m } from '../../../shared/i18n/index.ts'

function BalanceHudFrame({
  className,
  onOpenDetail,
  children,
}: {
  readonly className: string
  readonly onOpenDetail?: () => void
  readonly children: ReactNode
}) {
  if (!onOpenDetail) return <div className={className}>{children}</div>
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={m.twinkle_balance_title()}
      onClick={onOpenDetail}
      className={className}
    >
      {children}
    </button>
  )
}

// The persistent, restrained balance reading over the canvas. The reading IS the way in: pressing
// anywhere on it opens what the figures are about — how much is held, how to come by more — because a
// separate mark beside the numbers asking "what is this?" put a second thing in the corner to aim at,
// and the numbers themselves were the thing the reader was already looking at.
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
export function BalanceHud({ onOpenDetail }: { readonly onOpenDetail?: () => void }) {
  return (
    <>
      <BalanceHudFrame
        onOpenDetail={onOpenDetail}
        className="pointer-events-auto hidden items-center gap-4 rounded-md py-1.5 pl-1 pr-1 drop-shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:flex"
      >
        <TwinkleBalance form="inline" />
      </BalanceHudFrame>

      {/* The phone form stays as narrow as its widest figure, because the clock is centred on the same
          line: a labelled row is wider than the corner it would have to fit in and would run into it. */}
      <BalanceHudFrame
        onOpenDetail={onOpenDetail}
        className="pointer-events-auto flex flex-col items-end gap-0.5 rounded-md px-1 py-1.5 drop-shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:hidden"
      >
        <TwinkleBalance form="stacked" />
      </BalanceHudFrame>
    </>
  )
}
