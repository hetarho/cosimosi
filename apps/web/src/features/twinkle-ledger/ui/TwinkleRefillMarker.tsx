import { todayRefillMarker } from '@cosimosi/twinkle'

import { m } from '../../../shared/i18n/index.ts'

// The daily SMALL refill, stated once at the head of the history. Its own component, taking NO
// EntryReason and NO entry id — that is the structural half of [G7]: the refill is a derivation, so it
// cannot be produced from a ledger row or mistaken for one, and distinct chrome says so visually. The
// note states plainly that it leaves no record, because a reader who scrolls looking for it deserves
// to know why it is not there.
//
// Exactly one, and only for today: a past day's refill anchor is unrecoverable client-side, so
// repeating this down the list would fabricate history.
export function TwinkleRefillMarker() {
  const marker = todayRefillMarker()

  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-dashed border-border bg-surface/60 px-3 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-text">{m.me_stardust_refill_marker()}</span>
        <span className="text-sm text-text tabular-nums">{`+${String(marker.amount)}`}</span>
      </div>
      <span className="text-xs text-text-muted">{m.me_stardust_refill_note()}</span>
    </div>
  )
}
