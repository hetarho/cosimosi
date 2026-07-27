# policy: twinkle economy

> Domain policy for the 별가루 (Twinkle) recall economy. Owned by plans
> [43.stardust-ledger](../../plan/43.stardust-ledger.md) (ledger/balance/curves) and
> [44.earn-spend-usecase](../../plan/44.earn-spend-usecase.md) (earn/spend/quote), and
> [61.signup-and-invite-usecase](../../plan/61.signup-and-invite-usecase.md) (signup settlement); the as-built
> context rules live in [tech/twinkle-economy.md](../../tech/twinkle-economy.md). Reinforces PRD
> §5.9 [G1][G2][G2a][G3][G4][G5][G6], and [65.twinkle-kind-redefinition](../../plan/65.twinkle-kind-redefinition.md)
> (the two kinds, the user-timezone day boundary, the purpose restriction).

## The rule

**Recall always costs Twinkle — and the daily SMALL grant must never block everyday recall** ([G1][G5]). Every 회고
(reconsolidation) and every 요지 별 열람 (gist view) is priced; the free surface is exactly the meta info (모양·감정·
작성일·강도·망각 상태), the forgotten current text, and reading the original diary ([G1]) — a use-case gating decision,
never a price curve.

**Twinkle is the product's only currency, and its two kinds are distinguished by PURPOSE, not by provenance**
([G2][G2a]) — 작은 별가루 is not a second currency but a use-restricted sub-kind of the one:

- **`SMALL`** — a fixed daily grant (`twinkle.small_daily_amount`) that refills at the start of the **user's own local
  calendar day** (`User.Timezone`, [U7]) and never carries unspent remainder forward. It may pay **only for the recall
  family** — `RECALL`, `GIST_VIEW`, `DIARY_RECALL`. It is a **derivation** against "now", not a stored counter, and it
  is never earned, credited or refunded.
- **`GENERAL`** — the universal, permanent carrying balance every earn path credits (invite / write / one-time signup
  rewards / achievement rewards, [G3]). A stored counter, decremented by any spend it covers.

**The spend order depends on the purpose** ([G2][G5][P9]): for the recall family `SMALL` is exhausted first and
`GENERAL` covers the overflow; for **every other purpose `SMALL` contributes zero** and `GENERAL` pays alone. The
eligible set is a **closed** list whose default answer is _ineligible_, so a purpose nobody has classified yet — an
ornament purchase, or whatever comes later — can never reach today's recall allowance ([I11]). That is the whole point
of the split: decoration spending must be structurally incapable of eating 회상. Neither kind ever goes negative: an
unaffordable spend is rejected, never partially applied.

**A quote counts only the kinds that may actually pay.** A shortfall for a `SMALL`-ineligible purpose never reports
itself covered by an allowance that purpose cannot spend ([G4][P9]).

**The prices are monotone in their domain signals** ([G4]): 회고 cost is **non-decreasing** in decay-depth (a
more-faded memory costs at least as much to pull back [F4], capped so a silent engram stays recallable [G5]); gist-view
cost is **non-increasing** in gist-depth (deeper abstraction is cheaper to skim [R8], floored above zero — cheap but
never free). "이 일기로 태어난 별 보기" is priced as the **sum of the per-star recall costs** ([D3]), not a separate
curve.

**The balance is server-authoritative** — the server is the single ledger writer; the FE reads and displays the
balance and prices pre-spend with the mirrored curves, but never advances the balance itself.

**The reset day is real time, deliberately** — the one intentional real-time crossing in the otherwise diary-driven
engine, isolated to the twinkle context: the economy paces the user's real-world daily habit ([M5][G5]), and a
universe-time refill would never refill a user who only views. Real time may **pace a grant** here; it is never a
measured condition ([I10]).

**The day that turns is the user's own** ([G2][U7]). The boundary is the local calendar date in `User.Timezone`, and:

- **An unresolvable zone reads as UTC and never blocks a refill** ([G5]). An empty, blank or unknown zone — a user with
  no profile row yet, a name the runtime cannot load — derives exactly the pre-timezone behavior. A missing zone may
  never deny someone their day's recall.
- **The stored window anchor never moves backward.** It advances monotonically, so changing timezone cannot produce two
  refills for one date: moving east can bring the _next_ refill forward once, by at most the offset span; moving west
  keeps the current window. No rate limit on the timezone control is needed, and none is specified.
- **The refill is lazy and writes nothing on read.** A balance read derives the fresh grant; the anchor rolls forward on
  the next write. There is no cron and no grant row ([G7] — the daily refill is a derivation, not a ledger event).

**Twinkle earns only via write / invite-both-sides / one-time signup / verified payment — there is no login or
attendance bonus** ([G3]); the daily `SMALL` reset plays that role by design. Every earn credits **`GENERAL`** only —
`SMALL` is the daily derivation and is never earned:

- **Write** — `twinkle.earn_write` once **per launched diary** (not per memory, so splitting a diary into more
  memories inflates nothing), granted inside the launch transaction; a past-dated diary that launches no episodic
  memory earns nothing (the grant rides the monotonic launch guard, [I10]).
- **Invite** — an opaque invite code carries no value by itself. Account settlement requires a distinct live
  inviter, a launched-star trigger, a verified invitee email (`GOOGLE` is implicit), and fewer than
  `twinkle.invite_reward_max_per_inviter` prior rewarded invites. Both sides then credit atomically and exactly once
  for the bound invite identity with keys `invite:<inviteID>` and `invite_signup:<inviteID>`.
- **Signup bonus** — `twinkle.earn_signup_bonus` credits once per account with reason `signup_bonus` and key
  `signup_bonus:<userID>`. It is reachable only from the same post-launch settlement hook; signup and login pay
  nothing.
- **Payment** — `Charge` credits only from a store-verifier claim binding the normalized provider transaction,
  provider, known pack, authoritative amount, and authenticated beneficiary. A provider transaction is globally
  single-use across users. No configured verifier means an explicit unavailable refusal; arbitrary receipt text can
  never mint Twinkle.

**The spend is a consequence of the memory action, never a separate step**: recall and gist-view hand the gate a
`SpendIntent` (kind + depth signal + the paid action's client operation id — **never a price**); the gate prices it via
the cost curves, checks the balance, and deducts `SMALL`→`GENERAL` **inside the caller's transaction** — no charge
without the recall, no recall without the charge. **The spend is idempotent per operation**: its ledger row carries an
operation-derived dedup key (per-member for a whole-diary recall), so a retried or concurrently-duplicated action draws
the balance exactly once (A3) — backstopping the memory-side receipt that already replays a committed action's result.
An unaffordable action returns the canonical insufficient-twinkle refusal and writes nothing; nothing is ever deleted
by a refusal ([I1]).

**Quotes are server-priced, read-only previews** ([G4]): `QuoteSpend` resolves the authoritative depth signal
server-side, prices with the same curves, and returns `{cost, covered, shortfall}` without writing a row or moving a
clock. A gist quote carries and validates the exact selected stage, so quote and spend use the same depth signal; the
real spend still re-derives everything at action time, so any stale quote is simply refused.

**Core-loop protection is a relationship, not a constant** ([G5]): `small_daily_amount ≥ expected_daily_ruminations ×
cheap_recall_cost` — everyday rumination ([M5]) always fits the daily SMALL grant at the cheap end of the recall
curve; the gate bites only excess. The relationship is enforced by a test over the generated constants.
