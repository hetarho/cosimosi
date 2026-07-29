# tech: achievement — the catalog and the counter store

> As-built rules for the `internal/achievement` bounded context and its storage. The architecture frame is
> [ARCHITECTURE.md](../ARCHITECTURE.md) §2.2–§2.7 and §4; plan
> [74.achievement-catalog-model](../plan/74.achievement-catalog-model.md) owns the product shape and the domain policy is
> [policy/domain/achievements.md](../policy/domain/achievements.md). The ornament catalog its two capstones pay is
> [tech/store-ornaments.md](store-ornaments.md); the currency they pay in is
> [tech/twinkle-economy.md](twinkle-economy.md).

## 1. Boundaries

`internal/achievement` is a **supporting context** and imports **no other `internal/` context**; nothing imports it
either. Its one live cross-context edge — account's withdrawal sweep calling the purge leg — is closed at the
composition root (`cmd/api/achievement.go`, wired in `cmd/api/memory.go` for the API and `cmd/api/worker.go` for the
sweep that actually runs). It ships as one package plus its two seams:

- `internal/achievement` — `CounterKey`, `CounterMode`, `Condition`, `Reward`, `RewardTier`, `Axis`, `Achievement`,
  `ProgressRecord`, `Entry`; the in-code catalog (`catalog.go`); the closed counter vocabulary (`counters.go`); the read
  (`ListAchievements`), the purge (`PurgeUser`), the pure `Achieved`/`Progress`; the consumer-owned ports; the declared
  errors. No proto, sqlc or pgx import.
- `internal/achievement/pg` — the context's **only** sqlc/pgx package: the concrete `Store` over
  `achievement_counters` + `achievement_progress`, row↔domain mapping at this edge. It declares no repository
  interface — the ports are consumer-owned.
- `internal/achievement/rpc` — thin Connect handlers for `achievement.v1.AchievementService`: `ListAchievements`
  (`NO_SIDE_EFFECTS`) and `ClaimAchievement` (a mutation, so it carries no client-cache classification). Enum map +
  call, no policy. Five refusals: `ACHIEVEMENT_SCOPE_REQUIRED`, `_INPUT_REQUIRED`, `_NOT_FOUND`, `_NOT_ACHIEVED`,
  `_REWARD_UNAVAILABLE`.

The frontend has **no mirror of the catalog, the targets or the evaluation** — `packages/api-client/src/achievement.ts`
carries the generated client, the query key/options and a mock transport, and nothing else. The server sends
`progress`/`achieved`/`reward_twinkle` resolved, so there is no formula to mirror and no golden fixture to keep in step
(contrast the ledger's price curves, which the FE must recompute pre-spend).

## 2. The two tables (migration `00025_achievement_progress.sql`)

```
achievement_counters (user_id, counter_key, value, updated_at)
    PRIMARY KEY (user_id, counter_key)
    CHECK (value >= 0)

achievement_progress (user_id, achievement_id, achieved_at, claimed_at, claim_id)
    PRIMARY KEY (user_id, achievement_id)
    CHECK ((claimed_at IS NULL) = (claim_id IS NULL))
```

Three load-bearing absences and two load-bearing constraints:

- **No per-event row and no event timestamp** — the schema half of the [A1a] guard. `achievement_counters` holds one
  aggregate per key, so "how many days in a row" is not a query someone forgot to forbid; it is unanswerable from this
  schema.
- **No `progress` column** — progress is `min(counter, target)` at read (§2.9 #3). What is stored is only what cannot
  be derived: _when_ the condition was first met, and _when_ the reward was received.
- **No meaning-bearing column of any kind** — no memory id, strength, mood, position, stage or text, which is the
  schema half of [A6]/[I11].
- **`CHECK (value >= 0)`** plus the domain's refusal of a backwards write: counters cannot go backwards.
- **`CHECK ((claimed_at IS NULL) = (claim_id IS NULL))`** — a claim stamp and its dedup key exist together or not at
  all, so a paid-but-unkeyed row cannot be written. Two more carry the same weight the ledger's `dedup_key` carries,
  because `claim_id` **is** that key: **`UNIQUE (user_id, claim_id)`** (two achievements claimed under one key would
  make the second reward vanish into the ledger's replay check) and **`CHECK (claim_id IS NULL OR btrim(claim_id) <> '')`**
  (the pairing CHECK accepts `''` on its own, which would collapse every claim into one dedup identity). Multiple NULLs
  remain fine — an unclaimed row has neither column.

Both timestamps are written by **SQL `now()`** — the DDL default on insert, `SET claimed_at = now()` on claim. That is
not stylistic: it is what lets the Go context own no clock. No index beyond the two primary keys exists; every read is
`WHERE user_id = $1`, which the PK prefix serves.

## 3. sqlc statements (`db/queries/achievement/achievement.sql`)

Nine statements, plain static sqlc, all conjunctively `user_id`-scoped, **no date arithmetic on any column**:

| statement                                                       | kind        | purpose                                                            |
| --------------------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| `ListAchievementCounters`                                       | `:many`     | every counter for the caller — the read's single counter fetch     |
| `ListAchievementProgress`                                       | `:many`     | every progress row for the caller                                  |
| `GetAchievementProgress`                                        | `:one`      | one row (the claim precondition)                                   |
| `CreateAchievementCounter`                                      | `:execrows` | `VALUES ($1,$2,0) ON CONFLICT DO NOTHING` — the first-touch signal |
| `AddAchievementCounter`                                         | `:one`      | `value + $1 RETURNING value` (accumulate keys)                     |
| `RaiseAchievementCounter`                                       | `:one`      | `GREATEST(value, $1) RETURNING value` (reach keys)                 |
| `MarkAchievementAchieved`                                       | `:execrows` | `ON CONFLICT DO NOTHING` — the PK keeps the first `achieved_at`    |
| `ClaimAchievementReward`                                        | `:execrows` | `… AND claimed_at IS NULL` — a second claim affects 0 rows         |
| `PurgeUserAchievementCounters` / `PurgeUserAchievementProgress` | `:exec`     | the withdrawal sweep's purge, allowlisted in the [I1] delete gate  |

`:execrows` on the three write guards is **load-bearing, not diagnostic**: the affected-row count is the first-touch
signal, the not-yet-achieved answer and the not-yet-claimed answer respectively. Both upserts use
`ON CONFLICT … DO NOTHING` (never `DO UPDATE`), so the isolation gate's conflict-target rule is satisfied by the primary
key itself, and `pnpm lint:persistence` passes with no `globalQueries` or `platformTables` entry.

## 4. The catalog (`catalog.go`)

39 rows across the nine [A2] axes, each `{ID, Axis, Condition, Reward}` — **content, not values**. The slice order **is**
the server-fixed answer order (axis order, then target ascending within a counter), asserted by a test, so no client
sorts and no second sort key is kept. The total is `len(catalog)` — derived, never declared.

`Condition{Counter CounterKey; Target int64}` is exactly two fields, forever. `Reward{Tier RewardTier; OrnamentID
string}` has no `TwinkleKind` field and no amount; `Reward.Twinkle()` resolves the tier through
`values.AchievementRewardTier{1,2,3}`.

Exactly two rows carry an ornament — the `STAR_TOTAL` capstone (`star_shader.spire`) and the `NEURON_SHARING` capstone
(`background.floating-lines`). The ids are opaque strings here; that they exist and are achievement-only is the store
catalog's fact.

The catalog self-test (`catalog_test.go`) asserts unique ids, non-empty axis, `Target >= 1`, every counter in the closed
set, exactly one reward leg per row (`Tier == None` iff `OrnamentID != ""`), exactly two ornament rewards, the answer
order, and that each variety capstone equals its family's length.

## 5. The counter vocabulary (`counters.go`)

Fourteen named keys plus two key families — **16 counters in the closed set**. The **mode** lives in the definition,
never at the call site.

| counter key                      | mode                            | the fact it counts                                    | [A2] axis                          |
| -------------------------------- | ------------------------------- | ----------------------------------------------------- | ---------------------------------- |
| `diary_written`                  | accumulate                      | a diary that launched at least one star               | 일기 누적 · 첫 경험                |
| `episodic_memory_launched`       | accumulate                      | `EpisodicMemory` rows created                         | 별 누적 · 첫 경험                  |
| `recall_performed`               | accumulate                      | one 회고 (재공고화)                                   | 회상 누적 · 첫 경험                |
| `gist_viewed`                    | accumulate                      | one 요지 별 열람                                      | 첫 경험                            |
| `semantic_stage_depth`           | reach                           | the deepest gist stage actually viewed (1..4)         | 요지화 도달                        |
| `decay_recovered`                | accumulate                      | a recall whose pre-recall decay stage was deep enough | 망각·회복                          |
| `neuron_shared`                  | accumulate                      | a neuron reaching ≥2 activations                      | 첫 공유 뉴런                       |
| `neuron_share_depth`             | reach                           | the most memories sharing one `Neuron`                | 별자리 규모 (as [A2] redefines it) |
| `episodic_memory_released`       | accumulate                      | a letting-go                                          | 첫 경험                            |
| `decoration_saved`               | accumulate                      | a `Decorate` save                                     | 꾸미기 · 첫 경험                   |
| `ornament_owned`                 | reach                           | ornaments owned after a save                          | 꾸미기                             |
| `invite_settled`                 | accumulate                      | a settled valid signup                                | 첫 경험                            |
| `mood_recorded:<MOOD>`           | accumulate (family, 13 members) | a memory recorded with that mood                      | feeds 감정 수집                    |
| `ornament_kind_decorated:<KIND>` | accumulate (family, 2 members)  | a save that changed that kind                         | feeds 꾸미기                       |
| `mood_variety`                   | accumulate (derived)            | distinct moods recorded — ceiling 13                  | 감정 수집                          |
| `ornament_kind_variety`          | accumulate (derived)            | distinct ornament kinds decorated — ceiling 2         | 꾸미기                             |

The two derived counters are maintained **inside** this context: the first-touch `:execrows` on a family member is the
distinctness proof, so every condition stays a single-counter integer comparison. Each family's arity is what sets its
variety ceiling — `ornament_kind_decorated` has two members because `OrnamentKind` is closed at two.

Membership, mode and family lookup are exported (`KnownCounterKey`, `CounterModeOf`, `MoodRecordedFamily`,
`OrnamentKindDecoratedFamily`, `MoodRecordedCounterKey`, `OrnamentKindDecoratedCounterKey`, `VarietyCounterFor`,
`DerivedCounterKey`) so the composition root can assert 1:1 agreement with the mood vocabulary and the ornament kinds
**without** any context importing another. At runtime an unknown key is `ErrUnknownCounterKey` and fails its transaction.
Every family and index is built once at import — `VarietyCounterFor` sits on the path of every counter write, so
rebuilding a slice to answer it would allocate on each diary, launch and save.

`cmd/api/catalog_consistency_test.go` is where the drift actually gets caught, because a producing context cannot import
these constants and its own are plain strings nothing checks. It asserts: the mood family equals `memory.AllMoods()`; the
kind family equals `store.AllOrnamentKinds()` — the **declared** set, not the kinds the ornament catalog happens to have
rows for, since a kind added to the enum with no row yet is exactly what a derived set waves through; and every key
`store` declares and pushes (`CounterDecorationSaved`, `CounterOrnamentOwned`, `CounterOrnamentKindDecorated(kind)`) is a
member **with the agreeing mode** — `ornament_owned` reports a total, which is only a fact if the counter keeps a
high-water mark rather than summing. The no-op default recorder is what makes this drift silent otherwise: a renamed key
passes every test until a real recorder is bound.

## 6. Ports and the service

```go
type Store interface {           // tx-bindable: NewStore(dbgen.DBTX)
    ListCounters / ListProgress / GetProgress
    TouchCounter (created bool) / AddCounter / RaiseCounter
    MarkAchieved (marked bool) / MarkClaimed (claimed bool)
}
type Repo interface { Store; UserPurgeRepo; InAchievementTx(ctx, func(tx Store) error) error }
```

**`Store` carries no purge**, and that absence is the point: a counter write composed inside `InAchievementTx` would
otherwise be able to delete the caller's whole history — not a mistake a recorder should be able to make, so it cannot
express it (the shape `store.DecorateTx` already uses). The purge arrives through `UserPurgeRepo`, and only `Repo`
carries both.

`achievementpg.NewStore(db dbgen.DBTX)` mirrors `twinklepg.NewStore`, and `Store.DB()` exposes the bound handle so the
composition root can bind a counter write onto a producer's own transaction through the
`interface{ DB() dbgen.DBTX }` assertion — the same seam the decoration save's debit uses.

`AchievementServiceDeps` is **`{Repo}` and nothing else**: no clock, no `Now`, no id minter. `twinkle.ServiceDeps` does
carry a zone reader because a daily reset window needs one; achievement has no legitimate use for a clock, so it is not
given one.

`ListAchievements` answers every catalog row for the caller: two reads, then `Progress = min(counter, target)` and
`Achieved = counter >= target` derived per row. Where an `achievement_progress` row exists, the **stored fact wins** —
`Achieved` is forced true and `AchievedAt`/`Claimed` come from the row, so a row is never un-achieved by a counter
reading. A user with rows in neither table gets the full catalog at zero progress.

**Progress is read before counters, and the order is load-bearing.** These are two statements, so a recorder committing
between them is visible to one and not the other. Reading progress first makes the counter read a strictly later
snapshot, and counters are monotonic — so any achievement whose row already exists must also satisfy
`counter >= target` in that later read. The contradiction "achieved, 0/5" is therefore unrepresentable rather than
merely unlikely, with no read transaction and no isolation-level dependency; the worst a race produces is a
just-achieved row whose `achieved_at` arrives on the next read.

Four domain functions own the write rules, so no adapter decides them:

- `RequireForwardDelta` — an accumulate write must move forward. Zero is a caller mistake: a producer with nothing to
  add should not be reporting.
- `RequireReachLevel` — a reach write admits **zero**, deliberately. A high-water mark of zero is a fact a producer can
  legitimately observe (a user owning no ornaments yet reports `ornament_owned = 0`) and `GREATEST(value, 0)` can only
  be a no-op; refusing it would roll back the save that reported it while lowering nothing.
- `RequireCounterMode` — a statement is bound to its key's declared mode. Without it, adding to a reach key would let
  four stage-1 gist views unlock the stage-4 row.
- `RequireCatalogID` — an unpublished id cannot leave a durable row no read will ever answer for.

`MarkClaimed` additionally refuses an empty claim id (the Go half of the DDL guards above).

Both counter writes are `:one` UPDATEs, so a first-ever write for a key would surface `pgx.ErrNoRows`. `writeCounter`
creates the row and retries once — the twinkle balance store's shape, and for the same reason: without it a user's
**first** diary, launch or save would roll back the very fact it was reporting. The retry does not weaken
`TouchCounter`'s first-touch signal; the recorder still touches first, and this only catches a caller that did not.

`PurgeUser` deletes both tables for the caller in one transaction, and `WithdrawalPurger` (`PurgeName() == "achievement"`)
is the leg account's sweep registers. The sweep runs in the worker, so the leg is registered in **both** composition
roots.

## 7. The contract (`proto/cosimosi/achievement/v1/achievement.proto`)

One unary `NO_SIDE_EFFECTS` method, `ListAchievements`, with an **empty request** — scope comes from
`platform.UserScope`, never the wire. `AchievementEntry` carries `achievement_id`, `axis`, `target`, `progress`,
`reward_twinkle`, `reward_ornament_id`, `achieved`, `claimed`, `achieved_at` (RFC3339 UTC, empty while unachieved).

**No `user_id` field on any message, no `TwinkleKind` field, and no user-facing string** — titles, bodies and axis labels
are resolved client-side from the id / the axis enum, following the `mood_<value>` + `moodLabel` precedent.
`AchievementAxis` uses the `ACHIEVEMENT_AXIS_UNSPECIFIED = 0` prefix form.

Classified exactly once in `packages/client-cache/src/http-policy.ts` (`achievementRpcCachePolicies`) as an
authenticated, user-scoped, non-shared-CDN GET; the transport hard-fails on a missing or duplicate classification
before any I/O, and the coverage test's explicit read count is the second guard.

## 8. Values

`spec/values.yaml` `achievement`: `reward_tier_1` (50), `reward_tier_2` (150), `reward_tier_3` (400) — sized against
`twinkle.earn_write` = 100 so a first reward reads as meaningful but never as a shortcut past writing, and the deepest
row stays below the 500 an invite pays; and `recovery_decay_stage_min` (2), the minimum **pre-recall** decay stage for a
recall to count as 망각·회복. That last one is a value rather than catalog content precisely because it is read at a
`memory` call site, and `values.yaml` is the only cross-context config channel. `claim_toast_ms` and
`unlock_notice_max` belong to this group but are owned by the UI plan.

Deliberately **not** values: the catalog rows (ids, axes, targets, the axis→counter mapping, the two ornament
capstones), the counter-key strings and their modes, the `Achieved`/`Progress` formulas, the achievement count, the
`AchievementAxis`/`RewardTier` enum members, the DDL, and the proto contract.

## 9. Tracking — the two write use-cases

`RecordProgress(ctx, scope, store Store, counterKey, delta)` takes a store **already bound to the caller's
transaction** (the shape twinkle's `CheckAndSpend` uses), which is what makes "a rolled-back launch advances no counter"
structural: there is no path in it that opens a transaction of its own. It refuses a non-positive delta
(`ErrProgressDeltaInvalid` — a wiring fault, since no axis is decrementable), refuses an unknown key, and refuses a
**derived** key: a producer pushing `mood_variety` would be counting distinctness it cannot prove. Then
`TouchCounter` (whose `created` return raises the family's variety counter in the same transaction) →
`AddCounter`/`RaiseCounter` **dispatched on the key's declared mode, never on anything the caller said** → `MarkAchieved`
for every catalog row on that counter whose target the returned value now meets. Evaluation is `counter >= target` over
two integers with no time input.

`ClaimAchievement(ctx, scope, achievementID) (ClaimResult, error)` is the explicit claim, and its ORDER is the design:

1. Resolve the catalog row (`ErrAchievementNotFound`).
2. In this context's own transaction, one conditional update through `MarkClaimed`. The row is the lock, so concurrent
   claims serialize and exactly one sees a change. Zero rows changed has two causes and only the row distinguishes them:
   **already claimed** → fall through as a replay; **absent** → check the counter and **promote**. The promotion is not a
   convenience: the READ derives `achieved` from the counter, so anything it displays as achieved must be claimable, and
   the two legitimately disagree whenever a release adds a tier on an existing counter or lowers a target — rows are
   written only when a counter is next reported, so every qualifying user would otherwise be shown a claim button that
   answers "not achieved". A counter still short of its target is the genuine refusal: nothing is promoted and nothing
   credited, because a met condition is a precondition and an unmet one is not a payout waiting to happen.
3. Commit, **then** pay through the two granter ports — an idempotent pairing, not one cross-context transaction, which
   would make this context the transaction owner of the ledger's and the ornament catalog's tables.

That leaves exactly one intermediate state — claimed but uncredited, after a crash — and it is **recoverable rather than
lost**: a repeat claim replays and pays through the same dedup keys, so the ledger credits once and the reward arrives.
This is why a second claim is a replay returning the same reward and **not** an `ALREADY_CLAIMED` refusal: refusing would
strand the reward in precisely the window this pairing exists to heal. A granter refusal surfaces as
`ACHIEVEMENT_REWARD_UNAVAILABLE` rather than an internal error, because the claim stands and the client should retry.

The claim id is **derived, not minted** — it is the achievement id, already unique per user under the progress table's
primary key and the ledger's `UNIQUE (user_id, dedup_key)`. A random id would buy no uniqueness the pair does not already
have, and every replay would recompute a different key. The ledger entry is an ordinary append-only `achievement_claim`
earn, so `/me`'s stardust history shows it like everything else.

**A replay resolves the reward from the catalog as it is NOW**, because the reward is not stored — only `claimed_at` and
`claim_id` are. Within one deployment that is exactly right (the catalog cannot change under a running server) and the
ledger row stays the authoritative record of what was credited. Across deployments it has one consequence worth naming:
**changing a shipped row's reward is a data change, not a content edit.** Re-tiering a claimed row makes a later replay
report today's amount (the credit itself is dedup-guarded, so nothing is paid twice), and re-pointing a claimed capstone
at a different ornament would grant that second ornament too, since ownership is idempotent on `(user_id, ornament_id)`
rather than on the claim. Storing the resolved reward on `achievement_progress` would close this, at the cost of the
columns plan 74 deliberately does not have; until a reward is actually re-pointed, the cheaper guard is knowing that such
an edit needs a migration and a backfill decision.

## 10. The composition root's four edges (`cmd/api/achievement.go`)

- **Three recorder adapters** (`memory`/`store`/`account`), each type-asserting the producer's opaque tx to
  `interface{ DB() dbgen.DBTX }` and binding `achievementpg.NewStore(handle)` onto it — the shipped economy-seam pattern:
  the two contexts share the transaction and never the queries. A handle-less tx is a wiring fault, refused rather than
  silently written through the pool. Account's settlement is the one caller that passes no tx (it is a locked sequence of
  statements, not one transaction), so its report is written over the pool and heals by replay instead of by rollback.
- **The binding is late** (`achievementRecorderBinding`): the producing services are constructed before the achievement
  service exists, because a claim pays through twinkle and store, which are built after account. The root hands the
  producers a holder and binds the service once — the same shape the invite-reward granter uses for the twinkle↔account
  cycle. An unbound recorder **refuses**, so a producer reporting too early fails its transaction rather than dropping
  the fact.
- **Two granter adapters** over `twinkle.Service.EarnAchievementReward` (narrowing its `Balance` to the `GENERAL` total)
  and `store.Service.GrantOwnership`. Neither carries a kind parameter, which is where "no `SMALL` reward" holds.
  `ornament_owned` is reported from the save's own view of ownership — the list it read plus what it acquired — so two
  concurrent saves both report the smaller total and the counter lags the table by one until the next save. Left alone
  deliberately: a high-water mark can only be late, never wrong, and closing it would serialize every decoration save
  behind an advisory lock for the sake of a count.

- **Two boot reconciliations**, both of which can only run here: the counter-key set equality in both directions (a
  producer emitting a _derived_ key is refused too — the recorder rejects it at runtime, so it would fail every
  transaction it reported from), and every reward ornament resolving in the store catalog as achievement-only.
  `achievement.NewService` additionally refuses a nil granter **unconditionally, in every environment** — a service that
  records claims it cannot pay would strand rewards — and every producing context now requires its recorder for the same
  reason, `store` included: a root that silently defaulted to the no-op would lose that context's counters entirely,
  which is exactly the drift these guards exist to prevent.

**There are two composition roots, and both must carry every leg.** `cmd/api` serves requests (and runs a dev worker);
`cmd/worker` is the binary the container runs the job queue with, including the withdrawal sweep. A seam bound in one and
forgotten in the other is invisible to a build: `cmd/worker` settles no signup, so it binds an account recorder that
refuses, and it registers **all four** purge legs (memory · twinkle · store · achievement) because it is the sweep that
actually runs — a missing leg there leaves that context's rows behind a hard-deleted account ([I1][U1]). Its own test
constructs the runner so that a forgotten required seam fails CI rather than the deploy.

## 11. What is deliberately absent

- **No `achievements` table** and no admin surface — a stardust gift stays `admin_grant`.
- **No TS mirror of the catalog, the targets or the evaluation**, and no golden fixture.
- **No clock, in any file — tests included.** `grep -rn 'time.Now' internal/achievement` matches only the comments
  that say so; even the integration tests derive their user ids from `t.Name()` plus a counter rather than from
  nanotime, so the grep needs no test exception to stay meaningful.
