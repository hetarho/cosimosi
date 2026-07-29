# policy: achievements

> Domain policy for 업적 — what an achievement may measure, what it may pay, and what achieving one may change.
> Owned by plan [74.achievement-catalog-model](../../plan/74.achievement-catalog-model.md) (the catalog, the counter
> vocabulary, the two tables, the read contract); progress recording and the claim are
> [75.achievement-tracking-usecase](../../plan/75.achievement-tracking-usecase.md), and the tab is
> [76.achievement-ui](../../plan/76.achievement-ui.md). The as-built context rules live in
> [tech/achievements.md](../../tech/achievements.md). Reinforces PRD §5.10 [A1][A1a][A2][A3][A4][A6], §5.7 [P10][P11],
> §5.9 [G3], §7 [I1][I4][I11].

## The rule

**A condition is a cumulative counter or a reached stage — never a real-world-time fact** ([A1a]). cosimosi has one
clock and it is universe time; a streak achievement would create a second clock the user competes against. The ban is
made unsayable rather than reviewed: a `Condition` is exactly `(counter key, integer target)` with no third field, so a
duration, a window, a rate, a comparison operator and a second counter have nowhere to live; the comparison is fixed at
`counter >= target`; the service receives **no clock port and no `Now`**; both timestamps are stamped by SQL `now()`
inside the statement, so no Go call site in the context can read a clock at all; and the store holds **aggregates, never
events**, so "how many days in a row" has no query that could answer it. This is not deferred to a later version — it
is excluded.

**An achievement is reached by using the product normally** ([A1]). Every target is a count of something a diarist does
anyway — writing, launching, recalling, viewing a gist, letting go, decorating, inviting. No row rewards abnormal
behavior, no row asks for a daily visit, and no row can be farmed by a loop that writes nothing.

**The counter vocabulary is a closed set, and each key's accumulation mode belongs to the definition** — not to the
call site. `accumulate` keys add their delta; `reach` keys keep `GREATEST(value, delta)`, which is how "단계 도달" is
expressed without a rate or a window. A producing context pushes `(counter key, delta)` and has no field in which to
invent a third semantics. An unknown key is a wiring fault that fails its transaction, and a composition-root
membership test makes a typo'd producer constant a test failure first.

**Counters only move forward, and an achievement is never revoked** ([I1]). No decrement path exists — the store
refuses a delta of zero or less, a reach counter never lowers, and `achieved_at` is never cleared. Letting go, releasing
a diary, or un-selecting an ornament therefore cannot lower a count or take an achievement back.

**Distinctness is counted inside the achievement context, not by producers.** `mood_variety` and
`ornament_kind_variety` are the closed exception to "producers push everything": the counter write is an
`INSERT … ON CONFLICT DO NOTHING` whose affected-row count **is** first touch, and the same transaction bumps the
family's variety counter by one. Every condition therefore stays a single-counter integer comparison, and each
variety ceiling is its family's length by construction — 13 for the moods, one per `OrnamentKind` for the kinds.

**군집(별자리) 크기 자체를 조건으로 삼지 않는다** ([I4]). A constellation is emergent, has no type and no table, and
counting it would promote a computed relationship to source-of-truth. The 별자리-규모 axis reads `neuron_share_depth`
— the most memories sharing **one** `Neuron`, a stored row — and 첫 별자리 형성 reads `neuron_shared`, a neuron
reaching two activations. No condition references a cluster or a connected component.

**No condition reads a mood's identity.** The `mood_recorded:<MOOD>` family feeds only the variety count, so no
achievement can privilege one emotion over another, and no reward is unlockable only by feeling a particular way.

**Rewards are `GENERAL` Twinkle or, rarely, an ornament — never `SMALL`** ([A3]). [A3]'s ban is unexpressible rather
than validated: a `Reward` has **no `TwinkleKind` field**, on the wire or in the catalog. A stardust reward names a
**tier** and the amount is resolved from `achievement.reward_tier_{1,2,3}`, so re-balancing rewards is a values edit and
no literal amount ever sits in a catalog row. Exactly one leg is set per reward — a tier, or an ornament id, never both
and never neither.

**Exactly two rewards are ornaments, and both are achievement-only** ([P11]). They pair 1:1 with the ornament catalog's
two unbuyable rows, asserted in both directions at the composition root — the one place that sees both catalogs. Every
other reward, including the 13-mood variety capstone, is `GENERAL` Twinkle: **감정 색은 보상이 아니다** ([P10] as
amended — no palette is ever a reward).

**Achieving and claiming change no meaning-layer field** ([A6][I11]). The context's only tables are its own two, it
declares no port into `memory`/`twinkle`/`store`/`account`, and the recorded payload has no field for a memory id, a
strength, a mood, a position, a forgetting stage or any text. An achievement literally cannot name an
`EpisodicMemory`, so a reward that moved a star is not something a reviewer has to catch.

**The claim is explicit, and it is paid at most once** ([A4]). Nothing is auto-granted. The claim sets
`claimed_at`/`claim_id` only `WHERE claimed_at IS NULL`, so a second claim affects **zero rows before any credit
moves**; `PRIMARY KEY (user_id, achievement_id)` is the double-payout guard, and `claim_id` is the dedup key both
reward legs carry.

**Progress is derived, never stored.** `Progress = min(counter, target)` and `Achieved = counter >= target` are
computed at read; `achievement_progress` stores only what cannot be derived — when the condition was first met and when
the reward was received. A user who has never achieved anything has **zero rows** in it and still gets the whole
catalog at zero progress. Once an `achieved_at` row exists, the stored fact wins: no counter reading can un-achieve it.

**There is no `achievements` table.** The catalog is a Go table — ids, axes, targets, the axis→counter mapping and the
two ornament capstones are **content**, and its total is the table's length, derived and never declared. Only the tier
amounts and `achievement.recovery_decay_stage_min` are values.

**The server is the only evaluator.** No condition table, target or evaluation is mirrored client-side, and no golden
fixture pairs the two: the response carries `progress`, `achieved` and `reward_twinkle` already resolved, plus a
server-fixed order, so no client sorts or recomputes anything. Every user-facing string is resolved from the
achievement id / axis enum on the client — the wire carries no copy.

## Why

[A1a] is the load-bearing one, and prose bans drift. A "7일 연속" achievement is the single most likely feature request
here and the single most damaging: it turns a diary a user keeps for themselves into an attendance sheet, and it makes
forgetting — the product's whole thesis — into a penalty. Making the condition shape unable to express it costs one
struct field's worth of restraint and removes the decision from every future reviewer.

The second reason is the economy. v2 is unmonetized, so achievements are one of only three supply lines for the
currency that buys ornaments; a reward that could be paid in `SMALL` would let a daily refill fund decoration, and a
reward that could name a palette would put a feeling's color behind a wall. Both are unrepresentable instead of
forbidden.

## What this does NOT decide

- **The producer call sites, the recorder ports and the claim use-case** — the six sanctioned pushes, `RecordProgress`,
  `ClaimAchievement`, both reward legs and the fail-closed boot gate are plan 75's.
- **Copy, the tab, the claim affordance and the unlock notice** — plan 76's, in
  [policy/ux/achievements.md](../ux/achievements.md) when it lands.
- **The ledger reason** — `achievement_claim` and every `twinkle_ledger_entries` rule belong to
  [twinkle-economy](twinkle-economy.md).
- **Which ornaments exist** — [ornament-catalog](ornament-catalog.md) owns membership, price and the two
  achievement-only rows; this policy only pays them.
