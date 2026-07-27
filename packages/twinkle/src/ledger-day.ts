import { VALUES } from '@cosimosi/config'

// The history's shape, as pure data. It groups by the date the SERVER already resolved in the user's
// timezone (`occurredOn`) and performs no timezone arithmetic of its own: the server is the
// day-boundary authority ([U7]), so a device-local grouping would draw headers that disagree with the
// SMALL reset boundary the same user just watched refill. There is no economy math here and no Go
// twin, so nothing in this module carries a golden-parity obligation.

// One entry as the history reads it — the subset of the wire row this layer needs. Deliberately no
// memory id and no diary id: with no field to carry one, a jump from a ledger row into a memory is
// unrepresentable rather than merely unwired ([I11]).
export interface LedgerDayEntry {
  readonly id: string
  readonly occurredOn: string
}

export interface LedgerDay<Entry extends LedgerDayEntry> {
  readonly occurredOn: string
  readonly entries: readonly Entry[]
}

// The daily refill, as its own model rather than a row. It carries no reason and no entry id — the
// structural half of [G7]: the refill is a derivation, so it cannot be produced from a ledger row or
// mistaken for one.
//
// It carries no DATE either, and that is the point. The marker's place is positional — always the head
// of the history — so it needs no "is the newest group today?" comparison, which is the one question
// the client cannot answer honestly: it has no server-supplied notion of the user's today, and reading
// the device clock is exactly the arithmetic [U7] forbids. `amount` is the refill GRANTED, not the
// amount remaining; the balance summary above the list already shows that.
export interface RefillMarker {
  readonly amount: number
}

// groupLedgerByDay preserves the server's newest-first order — both across days and within one — so
// the list never reorders what the keyset already decided. Entries arrive already sorted; this only
// segments them, which is why a page arriving out of order cannot silently interleave.
export function groupLedgerByDay<Entry extends LedgerDayEntry>(
  entries: readonly Entry[],
): readonly LedgerDay<Entry>[] {
  const days: { occurredOn: string; entries: Entry[] }[] = []
  for (const entry of entries) {
    const last = days.at(-1)
    if (last && last.occurredOn === entry.occurredOn) {
      last.entries.push(entry)
      continue
    }
    days.push({ occurredOn: entry.occurredOn, entries: [entry] })
  }
  return days
}

// Exactly one marker, ever. A past day's refill anchor is unrecoverable client-side, so repeating this
// down the list would fabricate history — the head of the list is the one place the client can state
// the fact without inventing a date for it.
export function todayRefillMarker(): RefillMarker {
  return { amount: VALUES.twinkle.smallDailyAmount }
}
