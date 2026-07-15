# policy: twinkle economy

> Domain policy for the 별가루 (Twinkle) recall economy. Owned by plans
> [43.stardust-ledger](../../plan/43.stardust-ledger.md) (ledger/balance/curves) and
> [44.earn-spend-usecase](../../plan/44.earn-spend-usecase.md) (earn/spend/quote); the as-built
> context rules live in [tech/twinkle-economy.md](../../tech/twinkle-economy.md). Reinforces PRD
> §5.9 [G1][G2][G3][G4][G5][G6].

## The rule

**Recall always costs Twinkle — and the daily basic grant must never block everyday recall** ([G1][G5]). Every 회고
(reconsolidation) and every 요지 별 열람 (gist view) is priced; the free surface is exactly the meta info (모양·감정·
작성일·강도·망각 상태), the forgotten current text, and reading the original diary ([G1]) — a use-case gating decision,
never a price curve.

**The balance is two-tier, and the tiers have different lifetimes** ([G2]):

- **Basic** — a fixed daily grant (`twinkle.basic_daily_amount`) that refills at the start of each **real UTC calendar
  day** and never carries unspent remainder forward. It is a **derivation** against "now", not a stored counter.
- **Additional** — the permanent, carrying balance charges accumulate (payment / invite / write rewards, [G3]). A
  stored counter, decremented only by spend overflow.

**The spend order is fixed: basic first, additional only for the overflow** ([G2]). Everyday recall inside the daily
grant never touches the paid wallet ([G5]). Neither tier ever goes negative: an unaffordable spend is rejected (or
routed to charge by the use-case), never partially applied.

**The prices are monotone in their domain signals** ([G4]): 회고 cost is **non-decreasing** in decay-depth (a
more-faded memory costs at least as much to pull back [F4], capped so a silent engram stays recallable [G5]); gist-view
cost is **non-increasing** in gist-depth (deeper abstraction is cheaper to skim [R8], floored above zero — cheap but
never free). "이 일기로 태어난 별 보기" is priced as the **sum of the per-star recall costs** ([D3]), not a separate
curve.

**The balance is server-authoritative** — the server is the single ledger writer; the FE reads and displays the
balance and prices pre-spend with the mirrored curves, but never advances the balance itself.

**The reset day is real time, deliberately** — the one intentional real-time crossing in the otherwise diary-driven
engine, isolated to the twinkle context: the economy paces the user's real-world daily habit ([M5][G5]), and a
universe-time refill would never refill a user who only views.

**Twinkle earns only via write / invite-both-sides / verified payment — there is no login or attendance bonus**
([G3]); the daily basic reset plays that role by design. Every earn credits **additional** only — basic is the daily
derivation and is never earned:

- **Write** — `twinkle.earn_write` once **per launched diary** (not per memory, so splitting a diary into more
  memories inflates nothing), granted inside the launch transaction; a past-dated diary that launches no episodic
  memory earns nothing (the grant rides the monotonic launch guard, [I10]).
- **Invite** — on a **valid signup**, the inviter earns `twinkle.earn_invite_inviter` and the new friend
  `twinkle.earn_invite_invitee`, each **exactly once per signup**: a signup is claimable once (any code), and the
  (inviter, invitee) pair credits once. The invite code is the inviter's user id; self-invite is refused. The
  concrete anti-abuse criteria are a **reserved seam** ([G6]) behind the `valid-signup` predicate — its permissive
  default (a real, distinct signup) tightens later with no change to the invite earn.
- **Payment** — `Charge` credits only after the store receipt is **verified** through the payment-verifier port; the
  verifier's amount and idempotency key are authoritative, so a replayed receipt credits exactly once. No
  verification, no value.

**The spend is a consequence of the memory action, never a separate step**: recall and gist-view hand the gate a
`SpendIntent` (kind + depth signal — **never a price**); the gate prices it via the cost curves, checks the balance,
and deducts basic→additional **inside the caller's transaction** — no charge without the recall, no recall without
the charge. An unaffordable action returns the canonical insufficient-twinkle refusal and writes nothing; nothing is
ever deleted by a refusal ([I1]).

**Quotes are server-priced, read-only previews** ([G4]): `QuoteSpend` resolves the authoritative depth signal
server-side, prices with the same curves, and returns `{cost, covered, shortfall}` without writing a row or moving a
clock; the real spend re-derives everything at action time, so a stale quote is simply refused.

**Core-loop protection is a relationship, not a constant** ([G5]): `basic_daily_amount ≥ expected_daily_ruminations ×
cheap_recall_cost` — everyday rumination ([M5]) always fits the daily basic grant at the cheap end of the recall
curve; the gate bites only excess. The relationship is enforced by a test over the generated constants.
