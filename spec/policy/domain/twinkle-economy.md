# policy: twinkle economy

> Domain policy for the 별가루 (Twinkle) recall economy. Owned by plan
> [43.stardust-ledger](../../plan/43.stardust-ledger.md); the as-built context rules live in
> [tech/twinkle-economy.md](../../tech/twinkle-economy.md). Reinforces PRD §5.9 [G1][G2][G4][G5].

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
