# ACH achievements
> r1 | the achievement catalog, how progress is counted from other contexts' facts, and how a met condition becomes a claimed reward and a quiet notice

## decisions
- ACH-1 [o] an achievement condition is a point reached by using the product normally: every target counts something a diarist does anyway (write, launch, recall, view a gist, release a diary, decorate, invite)
  - no condition rewards abnormal behavior (N recalls in a day, repeated visits) and none asks for a daily visit
  - no condition can be farmed by a loop that writes nothing: a counter moves only inside a real product write →!ACH-15
  - achievements are one of the `GENERAL` Twinkle earn paths, so normal use is what funds decoration →=TWINK-3
  - unachieved rows stay listed with their progress, so the user sees where normal use is taking them →~ACH-32
- ACH-2 [o] the catalog spans nine closed axes: one row per first experience, then tiers over one counter per axis (three for decoration); the rows are content in `catalog.go` →!ACH-8
  | axis (`AchievementAxis`) | counter | targets | reward per target |
  |---|---|---|---|
  | `FIRST_EXPERIENCE` | one row each: `diary_written`, `episodic_memory_launched`, `recall_performed`, `gist_viewed`, `neuron_shared`, `episodic_memory_released`, `decoration_saved`, `invite_settled` | 1 | tier 1 |
  | `DIARY_TOTAL` | `diary_written` | 5, 20, 50, 200 | tier 1, 2, 2, 3 |
  | `STAR_TOTAL` | `episodic_memory_launched` | 10, 50, 200, 500 | tier 1, 2, 3, ornament |
  | `RECALL_TOTAL` | `recall_performed` | 10, 50, 200, 500 | tier 1, 2, 2, 3 |
  | `GIST_DEPTH` | `semantic_stage_depth` | 1, 2, 3, 4 | tier 1, 2, 2, 3 |
  | `FORGETTING_RECOVERY` | `decay_recovered` | 1, 5, 20 | tier 1, 2, 3 |
  | `NEURON_SHARING` | `neuron_share_depth` | 3, 5, 8 | tier 2, 3, ornament |
  | `MOOD_VARIETY` | `mood_variety` | 5, 9, 13 | tier 1, 2, 3 |
  | `DECORATION` | `decoration_saved` / `ornament_owned` / `ornament_kind_variety` | 5, 20 / 3, 8, 15 / 2, 5 | tier 1, 2 / 1, 2, 2 / 1, 3 |
  - every counter belongs to the closed vocabulary →!ACH-10
  - targets are catalog content in code, not `values.yaml` keys; only the reward amounts and the recovery threshold are values →~ACH-3
  - `NEURON_SHARING` is the constellation-scale family, measured on one `Neuron`, never on a cluster →!ACH-12
  - `GIST_DEPTH` is the deepest gist stage viewed →=ACH-19; `FORGETTING_RECOVERY` counts recalls of visibly forgotten memories →=ACH-18
  - each variety capstone equals its family's length (all 13 moods →=MOOD-2, every `OrnamentKind` →=DECOR) →!ACH-11
- ACH-3 [o] a reward is `GENERAL` Twinkle by tier or, on exactly two rows, an ornament; never `SMALL` ← `SMALL` resets daily, so as a reward it means nothing and tangles the reset rule →=TWINK-2
  - exactly one leg per row: a tier (`RewardTier1`–`3`) or an ornament id, never both and never neither; catalog self-test plus boot check →=ACH-30
  - a tier resolves to `achievement.reward_tier_1`, `_2` or `_3`; no row carries a literal amount, so rebalancing is a values edit
  - sizing: `reward_tier_1` stays below `twinkle.earn_write`, `reward_tier_3` below `twinkle.earn_invite_inviter`, so a first reward never outpays writing and the deepest row stays below the social path
  - `SMALL` is unexpressible: no `TwinkleKind` field on `Reward`, on the `TwinkleGranter` port or on any achievement proto message; the earn credits `GENERAL` by construction →=TWINK-19
  - the ornament leg pays only the `STAR_TOTAL` and `NEURON_SHARING` capstones (`star_shader.spire`, `background.floating-lines`), pairing 1:1 with the ornament catalog's two achievement-only rows →=DECOR-11
  - no palette and no emotion colour is ever a reward; the 13-mood capstone pays stardust →=DECOR-10
- ACH-4 [o] a met condition pays nothing until the user presses the claim button; the press records the claim, then pays (`ClaimAchievement`) ← the user should notice what they received and how much
  - no auto-grant and no auto-claim path exists: the claim fires only from a press handler →=ACH-34
  - the claim lives in the `/me` achievements tab →=ACH-32
  - claim order, at-most-once and at-least-once payment →=ACH-21–23
- ACH-5 [o] a newly reached achievement is announced by a quiet toast after the action that reached it; confirming and claiming happen only in the tab ← the notice must not interrupt the universe →!ACH-32
  - the notice is a diff of the list read, never a push: ids that flipped to achieved since the previous resolution and are still unclaimed (`newlyAchieved`, `packages/achievement`)
  - the recorder returns `error` only, so no write pushes an outcome back; no subscription, no polling, no extra fetch →!ACH-15
  - every in-session progress-recording action invalidates the list on success through `useInvalidateAchievements`: launch, recall, whole-diary recall, gist view, diary release, decoration save; a failed action recorded nothing and refetches nothing
  - the first resolution of a session announces nothing, so a returning user with unclaimed rewards sees no burst at sign-in
  - at most `achievement.unlock_notice_max` notices per resolution; the rest are dropped, not queued
  - content: the achievement's title and where it waits (`achievement_notice`); no reward figure, no button, no navigation
  - dwell `achievement.claim_toast_ms`, shorter than `errors.toast_auto_dismiss_ms`: an error must be read, an achievement only noticed
  - it pushes into the app's single toast queue →=UI; entries carry `ACHIEVEMENT_NOTICE_TOAST_OWNER` and are dropped at the session boundary →=CLIENT
  - `AchievementNoticeHost` mounts once inside the authenticated subtree (web `AuthenticatedLayout`, mobile authenticated navigator), so signed-out visitors and `/demo` never fetch the list
  - the previous snapshot is a ref inside the host, never a store: sign-out unmounts it and no achievement state outlives the session that earned it
  - no badge, dot or count on the tab label or the universe HUD
- ACH-6 [o] achieving and claiming change no meaning-layer field: no `EpisodicMemory`'s position, strength, emotion, forgetting state or gist stage →!INV-11
  - the recorder payload is `(scope, tx, counterKey, delta)` and returns `error` only: nothing can name an `EpisodicMemory`, a mood, a strength, a stage, a text or a timestamp, and no outcome flows back into the producing write →=ACH-15
  - the context's only tables are its own two; it declares no port into `memory`, `twinkle`, `store` or `account` and reads none of their tables →=ACH-29
  - no column, type or proto field carries a memory id, strength, mood, position, stage or text →=ACH-27
  - no achievement or reward revives a faded memory →~FORGET-15, or moves a gist stage, timer or rise →~CONSOL-9
  - a claim writes no meaning-layer row: only `achievement_progress`, its settle job, and either one ledger earn row or one ownership row (with that grant's `ornament_owned` report); it deletes nothing →~INV-1
  - FE: `@cosimosi/achievement` depends on no meaning-layer package; its manifest is the guard →=ACH-37
- ACH-7 [o] no condition measures real-world time: no streak, consecutive day, consecutive visit, rate or window; only cumulative counts, cumulative quantities and reached stages ← cosimosi has one clock, universe time; a real-time metric would add a second clock the user competes against →!TIME-5
  - excluded in every version, not deferred
  - unexpressible by shape: a condition is exactly `(counter, target)` →=ACH-9
  - the context owns no clock: `AchievementServiceDeps` has no clock, `Now`, zone reader or id minter, and no file in `internal/achievement` (tests included) calls `time.Now`
  - every timestamp (`achieved_at`, `claimed_at`, `paid_at`, `updated_at`) is stamped by SQL `now()` inside its statement
  - the store keeps aggregates only: no per-event row, no event timestamp, no date arithmetic in any achievement query, so "how many days in a row" has no query that could answer it
  - no condition reads universe time either, and the FE unlock diff reads no clock: a notice means "changed since the last read", not "recent"
- ACH-8 [o] the catalog is Go code (`internal/achievement/catalog.go`), not a table: there is no `achievements` table ← nothing per-user decides which achievements exist, so a table would be a second place for rows to drift
  - a row is `{ID, Axis, Condition, Reward}`; the catalog's size is the table's length, derived and never declared
  - the slice order is the server-fixed answer order: axis order as in →~ACH-2, then target ascending within a counter (test-asserted); no client sorts
  - ids are stable snake_case strings (`first_diary`, `diary_50`) that key the FE copy, the progress row, the claim id and the ledger dedup key: a shipped id is never renamed, because a rename orphans its progress and pays the reward again under a new dedup key
  - self-test (`catalog_test.go`): unique ids, non-empty axis, `Target >= 1`, every counter in the closed set, one reward leg per row, exactly two ornament rewards, the answer order, each variety capstone equal to its family's length
  - a new tier or a lowered target leaves users achieved by derivation with no row; the claim promotes them →=ACH-21
  - changing a shipped row's reward is a data change: a re-tiered claimed row replays at today's amount, and a capstone re-pointed at another ornament would grant that one too, so it needs a migration and a backfill decision
  - dropping a row closes its unsettled claims without payment →~ACH-23
  - no admin surface: an operator gift stays `admin_grant` →=ADMIN
- ACH-9 [o] a condition is exactly one counter and an integer target ≥ 1, evaluated `Achieved = counter >= target`; progress is `min(counter, target)`, computed at read and never stored →!ACH-7
  - `Condition` has no time, duration, window, comparison operator or second-counter field, so "N per day", "within 7 days" and "counter A while counter B" have nowhere to live
  - `achievement_progress` stores only what cannot be derived: when the condition was first met, when the user claimed, when the reward landed →=ACH-27
- ACH-10 [o] counters form a closed vocabulary: 12 reported keys, 2 reported key families and 2 derived variety counters; each key's mode lives in its definition (`counters.go`), never at the call site →!ACH-15
  | key | mode | counted fact | reported by | value per report |
  |---|---|---|---|---|
  | `diary_written` | accumulate | a diary that launched ≥1 `EpisodicMemory` | `memory.PersistEncoded` | +1 per launched diary, never per memory |
  | `episodic_memory_launched` | accumulate | `EpisodicMemory` rows launched | `memory.PersistEncoded` | +launched count |
  | `neuron_shared` | accumulate | a neuron crossing to ≥2 memories | `memory.PersistEncoded` | +neurons whose membership crossed 2 in this launch |
  | `neuron_share_depth` | reach | the most memories sharing one `Neuron` | `memory.PersistEncoded` | deepest membership among this launch's neurons |
  | `mood_recorded:<MOOD>` | accumulate, family of 13 | memories recorded with that mood | `memory.PersistEncoded` | +memories per mood |
  | `recall_performed` | accumulate | one recall of one memory | `memory.Recall`, `memory.RecallDiaryStars` | +recalled memories (a whole-diary recall counts per member) |
  | `decay_recovered` | accumulate | a recall of a visibly forgotten memory | `memory.Recall`, `memory.RecallDiaryStars` | +recalled memories past the stage minimum →=ACH-18 |
  | `gist_viewed` | accumulate | one gist view | `memory.ViewSemantic` | +1 |
  | `semantic_stage_depth` | reach | the deepest gist stage viewed (1–4) | `memory.ViewSemantic` | the stage served →=ACH-19 |
  | `episodic_memory_released` | accumulate | an `EpisodicMemory` removed by a whole-diary release | `memory.Release` | +released memories |
  | `decoration_saved` | accumulate | a save that changed something | `store.Decorate` | +1 |
  | `ornament_owned` | reach | ornaments owned | `store.Decorate`, `store.GrantOwnership` | the ownership total after the save or grant |
  | `ornament_kind_decorated:<KIND>` | accumulate, family of one per `OrnamentKind` | a save that changed that kind | `store.Decorate` | +1 per changed kind |
  | `invite_settled` | accumulate | a settled valid signup, for the inviter | account invite settlement | +1 under the inviter's scope →=ACH-20 |
  | `mood_variety` | accumulate, derived | distinct moods recorded | `achievement` itself →=ACH-11 | +1 on a family member's first touch |
  | `ornament_kind_variety` | accumulate, derived | distinct kinds decorated | `achievement` itself →=ACH-11 | +1 on a family member's first touch |
  - a whole-diary recall (`RecallDiaryStars`) reports once through `recordRecallProgress`: `recall_performed` += its live members, `decay_recovered` += the members whose forgetting it recovered, matching the ledger's one row per member →~DIARY-3
  - accumulate adds the delta; reach keeps `GREATEST(value, level)`, the high-water mark that expresses a reached stage without a rate or a window
  - a statement is bound to its key's declared mode (`RequireCounterMode`): adding to a reach key would let four stage-1 gist views unlock the stage-4 row
  - one key per observable fact, many rows per key: tiers are catalog rows, never new keys, and a first row and a totals row may share a counter
  - `ornament_owned` may lag the ownership table by one after two concurrent saves, accepted: a high-water mark can only be late, never overstated, and closing the gap would serialize every save
  - every key is reachable: read by a condition, or a family member feeding a variety counter →=ACH-30
  - keys are snake_case canonical nouns; no rendering word (`star`, `constellation`, `nebula`) appears in a key →=UL
  - a family member is built from the producer's closed enum (`memory.AllMoods`, `store.AllOrnamentKinds`), never from user data
  - the call-site list is exhaustive: `LetGo` reports nothing (it seals neurons and releases no memory), and no worker, cron or read reports progress
- ACH-11 [o] `mood_variety` and `ornament_kind_variety` are derived inside the achievement context: each rises by one when a member of its key family is first touched ← only the counter table's owner can prove a first touch; a producer could count thirteen `JOY` entries as thirteen moods
  - the first-touch signal is the affected-row count of the insert-if-absent on the counter row, in the report's own transaction
  - a producer reporting a derived key is refused at runtime (`ErrDerivedCounterNotReportable`) and at boot →=ACH-30
  - every condition stays a single-counter integer comparison →!ACH-9
  - a family's length is the variety ceiling, so a new mood or `OrnamentKind` moves the capstone review (test-asserted)
- ACH-12 [o] no condition counts an emergent structure: no cluster, constellation or connected component of the synapse graph ← counting a computed relationship would promote it to a stored fact →!INV-4
  - "largest cluster" is not an axis: the constellation-scale family reads `neuron_share_depth`, the most memories sharing one `Neuron`, a fact stored in `NeuronActivation` rows
  - "first constellation" is the first neuron reaching two activations (`neuron_shared`, row `first_shared_neuron`)
- ACH-13 [o] no condition reads a mood's identity: the `mood_recorded:<MOOD>` family feeds only `mood_variety` ← no achievement may privilege one emotion or make a reward reachable only by feeling a certain way →~MOOD-3
- ACH-14 [o] counters only move forward and an achievement is never revoked →!INV-1
  - no decrement path: an accumulate report must be > 0 (`RequireForwardDelta`); a reach report admits 0 (a user owning no ornament) and never lowers the mark; `CHECK (value >= 0)`
  - `achieved_at` is written once (insert-if-absent) and never cleared; re-crossing a threshold changes nothing
  - releasing or restoring a diary, letting go, un-selecting an ornament and a withdrawal-restore cycle lower no counter and un-achieve nothing
  - a neuron that falls below two memories and is shared again counts a second `neuron_shared`: the fact happened twice
- ACH-15 [o] progress is pushed by the producing context from inside the transaction that made the fact true, as a counter key and a delta ← there is no event bus, and a rolled-back launch, recall, view, release or save must advance nothing →!ACH-6
  - each producer declares its own `AchievementRecorder` port (`memory`, `store`, `account`): `RecordProgress(ctx, scope, tx, counterKey, delta) error`
  - the producer reduces its measurement (decay stage, gist stage, mood, kind) to a count before the port; `achievement` never receives a measurement
  - a recorder error aborts the causing transaction: a counter that silently diverged could never be recomputed, so loud failure beats silent loss
  - no pull, recompute, backfill or cron: nothing reads another context's tables to derive progress
  - a replayed paid action (same `operation_id`) returns its stored response before any effect and records nothing again
  - `NoAchievementRecorder` exists for tests only; every producing service requires a bound recorder →=ACH-30
- ACH-16 [o] `RecordProgress` composes each report on the caller's transaction: validate, touch the counter, write it by its mode, mark reached rows →!ACH-10
  - refuses an empty scope, an unknown key (`ErrUnknownCounterKey`), a derived key, an accumulate delta ≤ 0 or a reach level < 0 (`ErrProgressDeltaInvalid`); each is a wiring fault that fails the producer's transaction
  - touch first (a family member's first touch bumps its variety counter →=ACH-11), then add or raise by the key's declared mode, never by anything the caller passed
  - mark every catalog row on that counter whose target the returned value meets (`MarkAchieved`, insert-if-absent); a progress write for an id the catalog does not publish is refused (`RequireCatalogID`)
  - it opens no transaction of its own: the store arrives bound to the producer's
- ACH-17 [o] a past-dated diary advances no counter: launch reports run after the monotonic launch guard, at the point where the write earn sits ← a save that launches nothing earns nothing, and counting it would reopen the farm the launch requirement closes for invites →!TIME-1
  - the `Diary` lands; no `EpisodicMemory`, no counter, no earn →~TWINK-3
  - only a launch with ≥1 memory reports
- ACH-18 [o] `decay_recovered` is judged at the recall moment: a recalled memory counts when its pre-recall `DecayStage` is at least `achievement.recovery_decay_stage_min` (`recallRecoversDecay`, `internal/memory`) ← the reinforce resets the stage and nothing can recompute it afterwards →!FORGET-1
  - the stage is forgetting's own function, never a copy: `DecayStage(EffectiveElapsedDays(…), arousal, EffectiveStrength(…))` over the pre-recall anchors at the post-sync clock →~TIME-15
  - it reads the same anchor snapshot the spend is priced from, with no extra read →~FORGET-4
  - a whole-diary recall judges each live member from its own pre-recall snapshot →~DIARY-3
  - only the count crosses the port, never the stage
  - the threshold is a values key because `memory` reads it at its own call site
- ACH-19 [o] gist depth is observed at view time: `ViewSemantic` reports the stage it served to `semantic_stage_depth` as a reach level, keeping the deepest stage viewed ← consolidation raising a stage reports nothing, so a stage nobody has viewed is not a depth reached →~CONSOL-6
  - the served stage is the memory's risen `semantic_stage`, server-derived and clamped to the pregenerated texts (`viewableGistStage`), never client-supplied →=RECALL-8
  - an unrisen memory is refused before any spend and reports nothing
  - every view also adds 1 to `gist_viewed`
  - no advance-hook, consolidation or worker path reports progress →~CONSOL-1
- ACH-20 [o] `invite_settled` belongs to the inviter: the settlement reports +1 under a scope minted from the resolved inviter id, and the invitee gets no invite counter →=ACCT-8
  - account's settlement is a locked sequence of statements, not one transaction: its report is written over the pool and lands before `rewarded_at` is stamped
  - a failed report leaves the invite settleable and the next settlement heals it; a retry counting twice is harmless because the only row reading this counter targets 1
  - this is the one transaction-less report; a transactional producer's handle-less tx is refused →=ACH-30
- ACH-21 [o] `ClaimAchievement` stamps the claim in the achievement context's own transaction, commits, then pays: an idempotent pairing, never one cross-context transaction ← a joint transaction would make `achievement` the owner of the ledger's and the ornament catalog's tables →!ACH-4
  | step | what happens |
  |---|---|
  | 1 | resolve the catalog row; an unknown id ⇒ `ACHIEVEMENT_NOT_FOUND` |
  | 2 | `MarkClaimed` sets `claimed_at` and `claim_id` only `WHERE claimed_at IS NULL`; the row is the lock, so concurrent claims serialize and one wins |
  | 3 | zero rows changed: already claimed ⇒ replay (re-arm the drain if unsettled); no row and counter ≥ target ⇒ promote (mark achieved, then claim); no row and counter short ⇒ `ACHIEVEMENT_NOT_ACHIEVED`, nothing written |
  | 4 | arm the settle drain inside the same transaction →=ACH-23 |
  | 5 | commit, then pay the row's one leg: `GENERAL` earn or ornament grant |
  | 6 | on success stamp `paid_at` (`SettleClaim`) and return the granted ornament, or the granted amount with the `GENERAL` total after it |
  - promotion exists because the read derives `achieved` from the counter: rows are written only when a counter is next reported, so a new tier or a lowered target would otherwise show a button that answers "not achieved"
  - a pay-leg failure ⇒ `ACHIEVEMENT_REWARD_UNAVAILABLE`: the claim stands and the next press or the drain replays it
  - a settle-stamp failure after a successful credit is not reported: the reward arrived, and the drain re-runs an idempotent leg and re-stamps
- ACH-22 [o] a reward is paid at most once: one progress row per achievement, the claim stamp committed before any credit, and both pay legs idempotent on the claim →!ACH-21
  - `PRIMARY KEY (user_id, achievement_id)` is the double-payout guard
  - the claim id is derived, not minted: it is the achievement id, so every replay recomputes the same dedup key; a random id would buy no uniqueness
  - `UNIQUE (user_id, claim_id)` and a non-blank `claim_id` (DB `CHECK`, and `MarkClaimed`/`SettleClaim` refuse an empty id): two claims cannot share a key, and an empty key cannot collapse every claim into one identity
  - the `GENERAL` leg dedups on `achievement:<claimID>` in the ledger as an ordinary `achievement_claim` earn →=TWINK-19; the ornament leg is idempotent on the ownership row `(user_id, ornament_id)` →=DECOR-9
- ACH-23 [o] a claimed reward is paid at least once: claimed-but-unpaid is a recoverable state the read reports and a worker drains, so recovery never depends on the user noticing the gap →!ACH-21
  - `paid_at` is stamped only after a leg returns; `CHECK (paid_at IS NULL OR claimed_at IS NOT NULL)` keeps the lifecycle one-way
  - the read reports it as `reward_settled = false` and the tab keeps a retry button →=ACH-33
  - the drain is a `memory` user job of kind `achievement_settle`, enqueued inside the claim transaction and deduped per claim (`achievement_settle:<user>:<achievement>`): a per-user key would let one finished drain swallow the next claim's
  - `SettleClaims` replays the pay leg for every claimed, unsettled row of that user, attempting all before reporting the first failure
  - no attempt cap, no claim ceiling and no dead-letter except the unregistered-kind stop: the kind retries indefinitely →=AI-36; boot checks make every claimable row payable, so each failure is transient →!ACH-30
  - a claimed, unsettled row whose achievement left the catalog is skipped: the read answers no entry for it, so no affordance points at it (`TestSettleSkipsAnAchievementThatLeftTheCatalog`)
  - user-scoped by construction: no `globalQueries` exemption is added
  - both worker roots register the handler (`cmd/worker`, `cmd/api`'s dev worker)
- ACH-24 [o] the achievement RPCs refuse with five reasons, and a repeat claim is never one of them: it is a replay that returns the same reward ← refusing a repeat would strand the reward in the window between the stamp and the credit →=ERR
  | reason | code | when | client |
  |---|---|---|---|
  | `ACHIEVEMENT_SCOPE_REQUIRED` | Unauthenticated | no user scope | reason copy |
  | `ACHIEVEMENT_INPUT_REQUIRED` | InvalidArgument | blank `achievement_id` | reason copy |
  | `ACHIEVEMENT_NOT_FOUND` | NotFound | id not in the catalog | toast and refetch the list |
  | `ACHIEVEMENT_NOT_ACHIEVED` | FailedPrecondition | no row and the counter is short | toast and refetch the list |
  | `ACHIEVEMENT_REWARD_UNAVAILABLE` | Unavailable | claim recorded, pay leg failed | toast saying the reward is kept, refetch, the button stays enabled |
  - no `ALREADY_CLAIMED` reason exists
  - the `REWARD_UNAVAILABLE` copy (`error_achievement_reward_unavailable`) must not read as a loss
  - any other error stays internal; a withdrawn scope never reaches these handlers →=ACCT-10
- ACH-25 [o] `ListAchievements` answers every catalog row for the caller in the server-fixed order, free and without side effects →!ACH-9
  - `NO_SIDE_EFFECTS`, empty request, scope from `platform.UserScope`; classified once in `packages/client-cache/src/http-policy.ts` as a user-scoped GET, never shared-CDN →=CLIENT
  - progress is read before counters: counters are monotonic, so a later counter snapshot can never contradict an existing achieved row, with no read transaction needed
  - where a progress row exists the stored fact wins: `achieved` true, `progress` = target, `achieved_at`, `claimed` and `reward_settled` from the row →!ACH-14
  - no rows ⇒ the full catalog at zero progress; a progress row whose id left the catalog is answered nowhere
  - it advances no clock and spends nothing →~TIME-3
- ACH-26 [o] the `cosimosi.achievement.v1` contract carries ids, integers, enums and flags only: no `user_id`, no `TwinkleKind`, no user-facing string
  - `AchievementEntry`: `achievement_id`, `axis`, `target`, `progress`, `reward_twinkle` (int64 `GENERAL`, 0 for an ornament), `reward_ornament_id` (empty for stardust), `achieved`, `claimed`, `achieved_at` (RFC3339 UTC, empty while unachieved), `reward_settled`
  - `claimed && !reward_settled` is the recoverable window: clients render it as a retry, never as received
  - `ClaimAchievementRequest` is `{achievement_id}` only: no amount, reward, ornament or counter, so a client cannot propose what it earned, and no RPC accepts a counter
  - `ClaimAchievementResponse`: `granted_twinkle` or `granted_ornament_id` (exactly one set) and `twinkle_total`, the `GENERAL` balance after the credit (0 for an ornament reward)
  - `ClaimAchievement` is a mutation with no cache classification
  - `AchievementAxis` is achievement-owned with `ACHIEVEMENT_AXIS_UNSPECIFIED = 0`; a test drives axis totality from `Catalog()`, so a new axis without a proto arm fails CI
- ACH-27 [o] achievement state is two tables, both keyed by user, with no FK to `users`
  | table | key | constraints |
  |---|---|---|
  | `achievement_counters` | `PRIMARY KEY (user_id, counter_key)` | `value BIGINT`, `CHECK (value >= 0)`; one aggregate per key |
  | `achievement_progress` | `PRIMARY KEY (user_id, achievement_id)` | `UNIQUE (user_id, claim_id)`; `claimed_at` and `claim_id` both null or both set; `claim_id` non-blank; `paid_at` only on a claimed row |
  - load-bearing absences: no per-event row or event timestamp →!ACH-7, no `progress` column →!ACH-9, no meaning-bearing column →!ACH-6
  - the four write guards decide by affected-row count (first touch, newly achieved, newly claimed, newly paid); upserts are `ON CONFLICT DO NOTHING`, never `DO UPDATE`
  - every statement is plain sqlc in `db/queries/achievement/` (directory = context name), conjunctively `user_id`-scoped; `pnpm lint:persistence` passes with no `globalQueries` or `platformTables` entry →=ACCT-1
  - rows are deleted only by the withdrawal purge →=ACH-28
- ACH-28 [o] the user's own withdrawal sweep is the only delete: `PurgeUser` removes both tables for that user in one transaction →=ACCT-10
  - the leg is `WithdrawalPurger` (`PurgeName() == "achievement"`), registered in both `cmd/api` and `cmd/worker`; its two statements sit on the persistence gate's hard-delete allowlist
  - the tx-bindable `Store` has no delete; only `Repo` (via `UserPurgeRepo`) purges, so a counter write cannot erase history
  - during the restore window a withdrawn scope reaches no achievement RPC and the rows stay intact, `claimed_at` included; a restore writes no achievement compensation, so a restored account cannot be paid twice
- ACH-29 [o] `internal/achievement` is a supporting context: one package plus `pg` (its only sqlc/pgx package) and `rpc` (thin handlers); it imports no other `internal/` context and none imports it →=ARCH
  - plain product English: the neuroscience vocabulary rule does not apply, one concept one name does →=UL
  - consumer-owned ports live in the context: `Store`, `Repo`, `UserPurgeRepo`, `TwinkleGranter`, `OrnamentGranter`, `SettlementScheduler` (over an opaque `ClaimTx`); recorder ports live in each producer
  - every cross-context edge is an adapter in `cmd/api/achievement.go`, the one place that sees every context
  - three recorder adapters bind `achievementpg.NewStore` onto the producer's tx through `interface{ DB() dbgen.DBTX }`: the two contexts share the transaction, never the queries
  - two granter adapters wrap `twinkle.Service.EarnAchievementReward` (narrowed to the `GENERAL` total) and `store.Service.GrantOwnership`; one scheduler adapter binds `memory`'s user-job store onto the claim tx
  - the recorder binding is late (`achievementRecorderBinding`): producers are built before the service, and an unbound recorder refuses rather than drops the fact
  - `cmd/worker` builds its own settler over the same twinkle and store behavior, and binds an account recorder and a settlement scheduler that refuse
- ACH-30 [o] the composition root refuses to start on achievement wiring drift →!ACH-10
  - counter keys: the union of the producers' exported key sets (`AchievementCounterKeys` in `memory`, `store`, `account`) equals the keys the catalog reads, in both directions; a family member may be emitted unread, a derived counter read unemitted, and a producer declaring a derived key is refused
  - rewards (`reconcileAchievementRewards`): exactly one leg per row, and every ornament reward resolves in the store catalog as achievement-only; a neither-leg row would leave every claimer unpaid forever
  - tests (`cmd/api/catalog_consistency_test.go`): the mood family equals `memory.AllMoods()`, the kind family equals `store.AllOrnamentKinds()` (the declared set), every store key is a member with the agreeing mode, the ornament rewards pair 1:1 with the store's achievement-only rows
  - `achievement.NewService` refuses a nil repo, granter or scheduler in every environment, and every producing context requires its recorder: a silent no-op would lose a context's counters with no repair path
  - a transactional producer's handle-less tx is refused rather than written through the pool
- ACH-31 [o] the server is the only evaluator: no TS mirror of the catalog, targets, counters or evaluation, and no golden fixture ← the response carries everything resolved, and a second evaluator would drift
  - `@cosimosi/achievement` holds the DTO mirror (`AchievementView`), display helpers and the React seam only
  - its pure functions (`claimState`, `newlyAchieved`, `groupByAxis`) work over server values and have no Go counterpart
- ACH-32 [o] the `/me` achievements tab (`/me?tab=achievements`) renders the whole catalog in the server's order under axis headings →=ACCT-9
  - grouping is derived from the response (`groupByAxis`): it never reorders and never drops an axis the client does not know; an unknown axis renders under `achievement_axis_other`
  - unachieved rows are present and readable
  - the list is neither paged nor windowed: its length is the catalog's, content rather than history, so it cannot grow with use and a windowing layer would be pure cost
  - a row shows title, body, a determinate meter reading `progress`/`target` verbatim (`Progress` primitive →=UI), the reward line and the affordance
  - one summary above the list counts rewards waiting, claimable plus unpaid (`achievement_claimable_count`), so the number matches the buttons; no badge, dot or count anywhere else
  - a failed read raises the error toast rather than passing silently
  - the stardust earn guide's achievement entry links here →=TWINK
- ACH-33 [o] a row is exactly one of four states, derived by `claimState` from the server's `achieved`, `claimed` and `reward_settled`
  | state | condition | affordance |
  |---|---|---|
  | `locked` | not achieved | meter, no button |
  | `claimable` | achieved, not claimed | claim button `achievement_claim` |
  | `unpaid` | claimed, not settled | retry button `achievement_claim_retry` with `achievement_reward_pending`; never the received line |
  | `claimed` | claimed and settled | `achievement_claimed` line, no button |
  - no optimistic state anywhere: a failed claim leaves the row where the server says it is
  - `unpaid` copy says the reward has not arrived yet, never that it was lost
  - the reward line shows `achievement_reward_twinkle` with the server amount, or `achievement_reward_ornament`
- ACH-34 [o] one claim is in flight at a time: one `asyncCommandMachine` instance (`@cosimosi/state-machine`), keyed on the pressed id, disables every claim button while it submits →=CLIENT
  - the mutation fires from the press handler only, never from an effect, a mount or a focus
  - `useClaimAchievement` invalidates only the achievement read; the feature adds the Twinkle balance, and the decoration catalog (`GetCatalog`) only for an ornament reward
  - every refusal toasts and refetches the list →=ACH-24
  - no new XState machine file exists in either app
- ACH-35 [o] a successful claim opens `RewardRevealDialog`, a dialog that waits to be closed, not a toast ← a self-dismissing toast is a moment that can be missed, and the recognition is half the reward
  - it names the amount and the new `GENERAL` total (`achievement_reveal_twinkle`) or that an ornament was granted (`achievement_reveal_ornament`)
  - one dismissal (`achievement_reveal_dismiss`) and no navigation: a link into decoration would turn claiming into a funnel
  - an ornament reward is never named on this surface and no `store_*` key is read; the item's identity lives beside its acquisition condition in decoration →=DECOR-11
  - `/me` is an account surface, so a modal here interrupts no universe →~ACH-5
- ACH-36 [o] every achievement string is resolved on the client from the achievement id or the axis enum; the wire carries no copy →=CLIENT
  - keys: `achievement_<id>_title` and `_body`, `achievement_axis_<axis>`, and the surface's own `achievement_*` lines, present in both `en.json` and `ko.json`
  - `achievement-copy.ts` is a `Record` of static `m.*` accessors: a constructed key would be invisible to `gen:messages`, `check:gen` and `lint:raw-strings`
  - an id with no copy entry renders `achievement_untitled` and keeps its meter and claim button: copy completeness is a content gate, claimability a correctness one
  - the claim button `achievement_claim` reads "받기", the claim's own product word
  - voice: plain, no exclamation, no decorative emoji, no unearned congratulation
- ACH-37 [o] FE placement: `packages/achievement` (`@cosimosi/achievement`) holds the mirror, copy projection, claim state, unlock diff and React hooks, consumed verbatim by web and mobile; only `ui` is forked →=ARCH
  - `features/achievement-list` is the tab body composed by `pages/me`; `features/achievement-notice` is `AchievementNoticeHost`, mounted by the app shell; both hosts are shells over the package
  - the package depends only on `@cosimosi/api-client`, `@cosimosi/config` and `@cosimosi/i18n` (plus Connect and React Query peers): no memory, universe, emotion, store or renderer package →!ACH-6
  - the web landing and `/demo` pages cannot import `@cosimosi/achievement/react` (eslint `no-restricted-imports`) →~DEMO-8
  - no web↔mobile parity waiver applies

## flow
- record: product write tx → `RecordProgress(key, delta)` → touch counter(first touch of a family member: variety +1) → add | raise by mode → mark rows with counter ≥ target → commit with the write(rollback: nothing counted)
- claim: claim press → `ClaimAchievement{achievement_id}` → own tx: `MarkClaimed`(claimed | already claimed: replay | no row: promote | counter short: `ACHIEVEMENT_NOT_ACHIEVED`) → arm settle job → commit → pay leg(ok: `paid_at` → reveal dialog | fail: `ACHIEVEMENT_REWARD_UNAVAILABLE` → `unpaid` row → retry press or drain)
- notice: progress-recording action resolves → `useInvalidateAchievements` → list refetch → diff against the previous snapshot(first resolution: silent) → at most `achievement.unlock_notice_max` toasts

## constraints
- `values.yaml` group `achievement` holds `reward_tier_1`, `reward_tier_2`, `reward_tier_3`, `recovery_decay_stage_min`, `claim_toast_ms` and `unlock_notice_max`; catalog rows, targets, counter keys and modes, formulas, the axis and tier enums and the achievement count are code, never values
- the demo carries no achievement data and no achievement surface →=DEMO-8

## chg
- r1 261102 initial
