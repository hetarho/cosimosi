# policy: universe clock

> Domain policy for the diary-driven universe clock. Owned by plan
> [29.universe-clock](../../plan/29.universe-clock.md); the as-built persistence rules live in
> [tech/memory-persistence.md](../../tech/memory-persistence.md) §6. Reinforces [I10] and PRD [T1]–[T6].

## The rule

**Universe time is monotonic and diary-driven.** The clock advances only on the two triggers — a star-launch (to the
diary's date) and a recall (to today) — and never on viewing ([T2][T3]). It never moves backward: the domain advance is
`max(current, target)` and the only SQL write path holds the stored value with `GREATEST`, so no caller can rewind time
([I10]).

**A diary before the clock saves but raises no star** ([T1]). The objective record always lands (the `Diary` is
append-only, [I2]); a past-dated diary simply launches no `EpisodicMemory` and leaves the clock unmoved. The predicate
is `CanLaunchAt(diaryDate, clock)`: on/after the clock → launch; before → saved-without-a-star.

**One clock per user, born lazily** ([T5]). An empty universe has no clock (nil universe time); the first launch births
the row at the first diary date. "우주의 시간" is the last date the clock was advanced to ([T6]).

**Universe time is a read-time "now", never a coordinate** ([T5][I7]). Elapsed-universe-day derivations (forgetting,
the semanticize timer, synapse decay) read it as a scalar; it has no path into layout — positions stay emergent from
graph structure alone ([I5]).

## The triggers (plan 30, as built)

**The clock advances on exactly two triggers, and nothing else** ([T2][T3]):

1. **Launch → the diary date, no warning.** `PersistEncoded` reads the clock in its transaction, applies
   `CanLaunchAt`, and — when launchable — advances the clock to the diary date as the transaction's last step. The
   pre-transaction future-date rejection (`diary_date > today + 1 day` of timezone slack) keeps a launch from ever
   advancing the clock past real time ([I10]).
2. **Recall → today, with consent.** `SyncToToday` is a *capability*, not a user action — no RPC, no button; Epic C's
   `Recall` composes it behind the sync-consent gate ([R1a], modal owned by plan 31). Idempotent within a day.

**Every advance fires the read-time progression hook, never a cron** ([T4]). `AdvanceProgression.OnAdvance(scope, tx,
from, to)` runs inside the advance transaction on both triggers; Epic B binds a no-op (forgetting is read-time), and
Epics C/E bind the real handler for the writes an interval implies. Viewing (`GetUniverse`) never advances the clock
and reads the stored value — with a one-release fallback to the latest launched memory while a pre-Epic-B user's clock
row is unborn.

## Non-rules (owned elsewhere)

The HUD, acceleration animation, and sync-consent modal are plan 31. The forgetting/consolidation rates that
read the clock own their values in Epics C–E; the real `AdvanceProgression` handler body is Epic E's.
