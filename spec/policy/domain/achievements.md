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

**A claim that is paid at most once must also be paid at least once.** The stamp commits before any credit moves, so
"the user pressed the button" and "the reward landed" are separate facts and the row carries both: `paid_at` is stamped
only once a reward leg returns. A claimed-and-unsettled row is a state the read reports, not a gap the surface hides —
and it is drained by a worker job the claim transaction itself enqueues, so recovery does not depend on the user
noticing. Both legs stay idempotent on `claim_id`, so a replay credits once however it is triggered.

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

## Who reports what, and when

Progress arrives by **push**, from inside the transaction that made the fact true — so a rolled-back
launch, recall, view, release or save advances nothing. Each producing context declares its own port,
whose entire payload is `(scope, tx, counterKey, delta)` and whose only return is `error`: no signature
on the path can carry a memory id, a name, a mood, a strength, a stage, a text or a timestamp, and no
value can flow back into the producing write.

| Counter                          | Reported by                                 | Δ per event                                                       |
| -------------------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| `diary_written`                  | `memory.PersistEncoded`                     | +1 per launched diary — never per memory                          |
| `episodic_memory_launched`       | `memory.PersistEncoded`                     | +the launched row count                                           |
| `neuron_shared`                  | `memory.PersistEncoded`                     | +1 per neuron reaching its 2nd membership                         |
| `neuron_share_depth`             | `memory.PersistEncoded`                     | the most memories now sharing one `Neuron` (**reach**)            |
| `mood_recorded:<MOOD>`           | `memory.PersistEncoded`                     | +1 per memory, key built from the closed mood enum                |
| `recall_performed`               | `memory.Recall` · `memory.RecallDiaryStars` | +1 **per recalled memory**                                        |
| `decay_recovered`                | `memory.Recall` · `memory.RecallDiaryStars` | +1 per memory whose pre-recall stage ≥ `recovery_decay_stage_min` |
| `gist_viewed`                    | `memory.ViewSemantic`                       | +1                                                                |
| `semantic_stage_depth`           | `memory.ViewSemantic`                       | the stage just served (**reach**)                                 |
| `episodic_memory_released`       | `memory.Release`                            | +1 per soft-deleted memory                                        |
| `decoration_saved`               | `store.Decorate`                            | +1 per save that changed something                                |
| `ornament_owned`                 | `store.Decorate` · `store.GrantOwnership`   | the ownership count after the save or grant (**reach**)           |
| `ornament_kind_decorated:<KIND>` | `store.Decorate`                            | +1 per kind whose applied id actually changed                     |
| `invite_settled`                 | `account`'s invite settlement               | +1, under the **inviter's** scope                                 |

Five decisions are embedded in that table:

**A past-dated diary advances nothing** ([I10][T1]). The launch reports sit after the monotonic launch
guard, at the same point as the write-earn grant: the diary is saved — the objective record always
lands — and grants and counts nothing. Anything else is the invite farm with a different name.

**`decay_recovered` is judged at the recall moment**, from the same pre-recall anchor snapshot the spend
is priced from, before the reinforce resets it. There is no recompute path afterwards, which is the
single reason progress is pushed rather than derived on a later read.

**요지화 도달 is observed at the VIEW moment**, not when a worker raises a stage: `ViewSemantic` reports
the stage it actually served and the reach mode keeps the high-water mark. The call-site list above is
exhaustive and contains no worker-side site, so a stage nobody has read is not a depth anyone reached.
(This amends [A2], which described the axis as the risen stage.)

**The inviter's counter is reported under a scope minted from the resolved inviter id**, and the invitee
gets none: the axis is 친구 초대 성공, an inviter fact. The report lands **before** `rewarded_at` is
stamped, so a report failure leaves the invite settleable and the next settlement heals it — the credit
is dedup-keyed and replays as a no-op. Stamping first would make a failed report unrecoverable, and the
only row reading this counter has a target of one, so a retry counting twice costs nothing while losing
the count would cost the achievement.

**A recorder error aborts the causing transaction**, deliberately. A counter that can silently diverge
from the facts is unfixable later, because there is nothing to recompute from — loud failure beats
silent loss, and the economy-less write-earn's silent-nothing is not the model to copy.

**A renamed key cannot start the server.** Each producing context exports its emitted key set and the
catalog exposes the keys its rows read; the composition root — the one place that sees every context —
asserts set equality in **both** directions at wiring time. A renamed key, an orphan key, and a
condition reading a key nobody emits are all boot failures rather than a silently frozen counter or an
unreachable achievement. The same wiring refuses a reward naming an ornament the store catalog does not
publish as achievement-only, and refuses to construct the service at all with any recorder or granter
unbound.

## What this does NOT decide

- **Copy, the tab, the claim affordance and the unlock notice** — plan 76's, in
  [policy/ux/achievements.md](../ux/achievements.md) when it lands.
- **The ledger reason** — `achievement_claim` and every `twinkle_ledger_entries` rule belong to
  [twinkle-economy](twinkle-economy.md).
- **Which ornaments exist** — [ornament-catalog](ornament-catalog.md) owns membership, price and the two
  achievement-only rows; this policy only pays them.
