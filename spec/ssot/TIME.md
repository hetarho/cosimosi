# TIME universe time
> r1 | the diary-driven universe clock: what advances it, what reads it as "now", and how an advance is consented to and shown

## decisions
- TIME-1 [o] a diary dated before the universe clock is saved but launches no `EpisodicMemory`, and the clock stays unmoved →!INV-10
  | diary date vs clock | outcome |
  |---|---|
  | empty universe (no clock, no launched memory) | launches; this first advance births the clock →~TIME-9 |
  | on or after the clock (same day included) | launches; the clock advances to the diary date →~TIME-2 |
  | before the clock | past-dated: the `Diary` lands (readable in the archive and the original reader), no `EpisodicMemory`, no clock move |
  - the rule is the pure predicate `CanLaunchAt(diaryDate, clock)` (`internal/memory/clock.go`), applied inside the launch transaction →~TIME-8
  - "the clock" is the stored clock or, while the row is unborn, its baseline →!TIME-9
  - the server outcome is authoritative: `LaunchStarsResponse.past_dated` with the interval `{clock, clock}`; clients key off the flag, never off an empty `memory_ids`
  - the FE `isPastDated` (`packages/universe`) only predicts the outcome for the pre-launch notice →=WRITE
  - a past-dated save is not a launch: no Twinkle earn →=TWINK-3, no achievement counter →=ACH, no invite settlement →=ACCT
  - consequence: days written late but in date order each launch; a diary older than the clock (a retrospective years back) never raises memories
- TIME-2 [o] the clock advances on exactly two triggers: a launch moves it to the diary date with no warning, a recall moves it to today only with the user's consent ← moving forward to a diary date loses nothing, syncing to today closes off unwritten past dates
  - launch: the advance is the last step of the launch transaction, atomic with the launch rows →=ENC
  - recall: `Recall` and `RecallDiaryStars` (→~DIARY-3) sync to today inside their own transaction →!TIME-15, gated by consent →!TIME-16
  - `ViewSemantic` never advances the clock and takes no consent; its transaction surface has no clock advance →=RECALL-8
  - nothing else moves the clock: no read →=TIME-3, no cron or worker job →=TIME-4, no admin action, no onboarding step →=ONB
  - `SyncToToday` is a service capability, not a user action: no RPC and no button sync the clock on their own
  - every advance returns its interval: `previous_universe_time` / `universe_time` on `LaunchStarsResponse`, `RecallResponse`, `RecallDiaryStarsResponse` (empty `previous` = unborn clock) →~TIME-19
- TIME-3 [o] viewing never advances time: while the user only looks, the universe stays at its last clock value and nothing forgets →!INV-10
  - coming back after real-world days or weeks and only viewing leaves every memory exactly as bright as it was; forgetting follows universe time, never real time →=FORGET-1
  - viewing metadata and the current (forgotten) text is free and effect-free →~RECALL-1
  - read RPCs are `NO_SIDE_EFFECTS` and advance no clock: `GetUniverse`, `SyncStatus`, `GetProvenance`, `Export`, `GetDiaries`, `GetDiaryCalendar`
  - structural guard: read ports carry no clock-advance method (`AdvanceUniverseClock` exists only on `LaunchTx` and `ProgressionTx`); the archive reads' guard →=DIARY
- TIME-4 [o] forgetting and consolidation run with no batch job: they progress read-time at the moment the clock advances
  - read-time-only effects need no work at advance: the next read computes them against the later "now" (brightness and decay stage →=FORGET-1, effective synapse strength →=LINK-5)
  - write-producing effects of an interval (gist stage rise, replay marks, homeostatic `Downscale`) fire through the advance hook →!TIME-14
  - what consolidation does over an interval →=CONSOL
  - no cron, no scheduler and no RPC trigger progression; consolidation is never a user action
- TIME-5 [o] each user has exactly one clock: universe time is the diary timeline, and a recall always runs on the clock synced to today →!TIME-2
  - no second clock: no per-surface, recall-only or real-time clock; real-world time reaches the clock only as "today" →=TIME-12
  - achievements read no clock, so no real-time condition can exist →~ACH-7
  - the Twinkle daily-reset boundary is a real-clock economy window, not a clock of the universe →=TWINK-2
- TIME-6 [o] a persistent universe-time HUD at the top of the universe page shows the current clock value: the last diary date it advanced to, or today after a recall sync
  - web and mobile both place it top-centre over the canvas
  - label `universe_time_hud_label`; the value is the ISO date from `GetUniverse.universe_time` via `entities/universe-clock`
  - unborn clock ⇒ the empty-universe line `universe_time_hud_empty`, never a date and never blank
  - while an acceleration plays it shows the sweeping date, then the committed value →~TIME-19
  - label and value only: no control on the HUD can rewind time, place a memory or edit meaning →!INV-11
- TIME-7 [o] the clock is stored as one `universe_state` row per user: `user_id` primary key, `current_universe_time DATE NOT NULL` →!TIME-5
  - day granularity, like every universe-time column (`created_universe_time`, `last_recalled_universe_time`, `semanticize_timer_reset_at`, `last_activated_universe_time`); a finer clock carries no signal the model can read
  - universe dates are UTC-day values (date-only, UTC midnight); a local-zone timestamp is never a universe-time input
  - wire form: ISO date string; empty string = unborn clock
  - stored state, not an emergent value: the emergent-value rule governs positions, not the clock →~INV-5
  - `updated_at` is row maintenance stamped on every advance attempt and by the consolidation watermark write; it never means "when the clock last moved"
  - other columns on the row belong to their owner (`consolidated_through` →=CONSOL)
  - every clock read and write is scoped to the authenticated user (guard: `pnpm lint:persistence`) →=ACCT-1
  - the row is deleted only by the withdrawal purge →=ACCT-10
- TIME-8 [o] the clock never moves backward: the domain advance is `AdvanceClock(current, target) = max(current, target)` at day granularity →!INV-10
  - the only SQL write path, `AdvanceUniverseClock`, is a single-row upsert that holds the value with `GREATEST`; defense in depth, the domain still computes the target
  - no `UPDATE` can lower `current_universe_time`; no operation rewinds the clock, by construction
  - every advancing transaction (launch, recall sync) first takes the per-user graph-mutation lock `LockGraphMutation`, then reads the clock `FOR UPDATE`
  - the lock covers the unborn-clock window: with no row to lock, two concurrent first launches could otherwise both pass the guard against a nil clock
  - the same lock serializes every other graph-mutating transaction →=MEM
- TIME-9 [o] the clock is born lazily: no row and a nil universe time until the first advance, which creates the row at the first diary date (upsert keyed by `user_id`) ← an empty universe needs no clock and no backfill migration
  - an empty universe (no clock, no launched memory) reads nil universe time and needs no sync consent
  - unborn-clock baseline: a universe with launched memories but no clock row reads its clock as the latest launched `created_universe_time`, for `GetUniverse`, the launch guard, the recall sync and `SyncStatus` alike
  - the baseline keeps the clock from being born behind the universe's visible present
- TIME-10 [o] universe time is the single read-time "now": every elapsed-universe-day derivation reads it as a scalar, never as a coordinate →!INV-7
  - readers: forgetting decay →=FORGET-1, the gist timer →=CONSOL-9, synapse strength decay →=LINK-5, temporal-proximity linking →=LINK-4, recall cost depth →=FORGET-4
  - elapsed universe-days = whole days between two universe dates, floored at 0; an unborn clock or a future reference reads 0 (`elapsedUniverseDays` in `packages/memory-logic`)
  - no path into layout: positions come from graph structure alone →=VIS
  - read-time derivations take "now" as an argument; none reads the real clock
- TIME-11 [o] the clock is server-authoritative single-writer state: only the launch and recall transactions advance it, clients only read it
  - the FE mirror `entities/universe-clock` holds `currentUniverseTime: string | null` from `GetUniverse.universe_time` (null = unborn, clears the mirror); it makes no request of its own and never advances
  - not a golden-parity mirror: clients receive the value, they never compute it
  - a client never decides "today" or consent from a local date →!TIME-17
  - the user-scope reset clears the clock mirror and every time store (announcement, sweep, pending consent), so one user's clock never shows for another →=CLIENT
- TIME-12 [o] "today" is the user's calendar day in their profile time zone →=ACCT-7
  - it is the only real-clock input to the clock: the recall sync target, the launch future-date bound, `SyncStatus.today`
  - no profile row or an unloadable zone name ⇒ UTC
- TIME-13 [o] a launch whose diary date is after the user's today is rejected before its transaction ← a clock advanced into the future would past-date every diary written until that date
  - failure: `MEMORY_ENCODE_INPUT_REQUIRED` (InvalidArgument); nothing is saved, not even the `Diary`
  - today means the profile-zone day →!TIME-12
- TIME-14 [o] every clock advance fires the progression hook `AdvanceProgression.OnAdvance(scope, tx, from, to)` inside the advance transaction; it is the only advance-triggered seam →!TIME-4
  - fires only when the clock actually moved; a held clock (same-day sync, equal-date launch, past-dated launch) fires nothing
  - `from` is nil on the first-ever advance; the interval is `(from, to]`
  - the binding writes through `ProgressionTx` (job enqueue and clock only, never a `Diary` or launch write), so its writes join the advance atomically →~INV-2
  - a binding is required: a composition root without one fails to build (`ErrProgressionRequired`)
  - production binds the consolidation handler →=CONSOL; `NoopAdvanceProgression` is the explicit no-op for minimal roots
  - a binding never widens the hook signature; extra write surface comes from its own transaction upgrade
- TIME-15 [o] a recall's sync to today runs inside the recall's own transaction and commits only with it: no free clock advance →!TIME-2
  - order: per-user lock → paid-action receipt replay → sync (consent gate →!TIME-16) → target load → spend → recall writes →=RECALL
  - any later refusal rolls the sync back: target missing or unavailable, no live memories (a foreign `diary_id` resolves to none), insufficient Twinkle, compare failure
  - the recall's cost and effects are computed at the post-sync clock →~FORGET-4
  - the response carries the sync interval; a same-day sync is an empty interval
  - `SyncToToday` (own transaction, unconditional, being itself the explicit act) and the in-transaction sync share one code path; idempotent within a day
- TIME-16 [o] sync consent is server-enforced: a recall whose sync would move the clock forward is refused unless the request carries `sync_consent = true` →!TIME-2
  - needs consent (`syncNeedsConsent`): the clock or its unborn-clock baseline exists and today is strictly after it →~TIME-9
  - refusal: `ErrSyncConsentRequired` → `MEMORY_SYNC_CONSENT_REQUIRED` (FailedPrecondition), before any spend or effect, so nothing is charged and nothing moves
  - client recovery: re-open the consent modal and retry under a fresh operation id; once consent was given, other refusals never loop back to consent →=ERR
  - a replay of a committed recall (same `operation_id`) returns the stored response before the gate, so a retry never re-asks consent
  - `ViewSemantic` has no `sync_consent` field: it never syncs
- TIME-17 [o] `SyncStatus` is the server-authoritative consent read: `{today, needs_sync}` from the same baseline and the same zoned today as the recall gate ← client clock skew or a midnight boundary could otherwise bypass or spuriously require consent
  - free: `NO_SIDE_EFFECTS`, GET-eligible, no lock, no advance, no Twinkle
  - clients decide whether to ask consent from `needs_sync` only, never from a local date; a stale read stays safe because the server gate still refuses →~TIME-16
  - `needs_sync` is false for an already-synced or empty universe
  - every clock-moving recall invalidates the cached `SyncStatus` and `GetUniverse` →=CLIENT
- TIME-18 [o] one sync-consent modal, `ConfirmTimeSyncDialog` (`features/confirm-time-sync`), asks before a recall syncs the clock; it opens only when `SyncStatus.needs_sync` is true or the server refused for missing consent →!TIME-17
  - the body states the consequence: recalling needs universe time set to today, and the unwritten past dates in between can no longer be added afterwards; then it asks to proceed
  - copy keys `universe_time_sync_consent_title`, `universe_time_sync_consent_body`, `universe_time_sync_accept`, `universe_time_sync_reject`; close reuses `common_dismiss`; plain voice, no decoration
  - accept ⇒ the caller sends the recall with `sync_consent = true`
  - reject and every ambiguous exit (backdrop, ✕, escape, unmount while open) ⇒ cancel: the recall is abandoned and the clock does not move
  - the modal returns a decision only and never calls the backend
  - triggers: the recall flow →=RECALL-9 and the diary reader's whole-diary recall →=DIARY-3, each hosting the modal in its own consent phase
- TIME-19 [o] an advance that moves the clock plays a forward-only acceleration over its interval `[previous, current]`; an empty interval plays nothing →!TIME-2
  - empty = no time passed: past-dated launch, same-day launch, same-day sync; viewing never plays it →~TIME-3
  - the first-ever launch (unborn `previous`) is never empty; it plays the floor-length beat
  - launch: the launched memory's reveal (the new-neuron awaken entry) waits until the acceleration ends: accelerate, then the star appears; an empty interval keeps the immediate reveal
  - recall: the committed sync interval plays after the server result through the same seam; the acceleration is never a pre-write step
  - presentation only: persistence, the optimistic insert and the `GetUniverse` refetch never wait for it; a skipped or interrupted acceleration loses only the beat
  - duration grows with the days crossed, floored and capped (a beat, not a wait); the HUD date flips through a capped number of steps; values in `UNIVERSE_TIME_ACCELERATION` (`packages/universe`)
  - OS reduced motion skips the acceleration (the date lands, the reveal releases), never slows it
  - no time surface (HUD, acceleration, consent modal) carries a rewind, placement or meaning control →!INV-11
- TIME-20 [o] the acceleration happens to the place, not to the screen: no sheet or veil covers the canvas ← a veil read as something happening to the viewer and hid the consequences the acceleration exists to show
  - the scene projects at the sweep's sampled clock walking `previous → current`, so forgetting is watched during the sweep, then returns to the committed read clock (`useAdvanceSweepStore`)
  - the sky's own time runs faster on the sweep's 0→1→0 envelope, then rests (`advanceSkyRate`) →=VIS
  - the consolidation replay and gist-rise choreography is a reserved slot inside the same interval seam →=VIS-8
  - the rise-to-neocortex motion stays reserved too →~CONSOL-8
- TIME-21 [o] the advance announcement seam never loses a reveal and never rewinds the clock mirror →!INV-10
  - module-level store, so an announcement survives the write sheet unmounting
  - back-to-back announcements merge into one sweep: earliest `previous` (unborn counts as earliest) → latest `current`, reveal ids united
  - an overlay unmounting mid-play releases the taken announcement at once
  - the release is idempotent: the clock mirror lands on `current` only when that is forward of its value, and reveal ids join the awaken store instead of replacing it
- TIME-22 [o] the time overlay's control state is one XState machine, `universeTimeMachine`, with empty context →=ARCH
  | state | meaning | exits |
  |---|---|---|
  | `idle` | HUD shown, nothing playing | `CONFIRM_SYNC` → `confirming`; `ADVANCED` with a moving interval → `accelerating` |
  | `confirming` | consent modal opened through `requestTimeSyncConsent` | `ACCEPT` or `REJECT` → `idle` |
  | `accelerating` | acceleration playing | `DONE` → `idle` (the reveal releases) |
  - `ACCEPT` returns to `idle`: the committed recall interval arrives later through `ADVANCED`
  - the `requestTimeSyncConsent` path shares one pending decision between concurrent askers; no live trigger uses it (the recall surfaces host the modal themselves →~TIME-18)
  - the clock value and the interval are data (Zustand); the playing announcement is held outside the machine; per-frame values go through refs or animated values, never React state
- TIME-23 [o] FE placement: `widgets/universe-time` composes `features/universe-clock-hud`, `features/accelerate-time` and `features/confirm-time-sync` over `entities/universe-clock` →=ARCH
  - the shared substance lives in `packages/universe` (clock store, interval helpers, sweep and announcement stores, consent store, machine), used verbatim by web and mobile
  - web and mobile run the same widget, features and entity; only the `ui` hosts differ
  - the overlay imports no `three` and no visual entity; the scene reads the sweep from `packages/universe`
- TIME-24 [o] BE placement: the clock model and its use-cases live in the core `internal/memory` context, not in a context of their own →=ARCH
  - the pure model (`AdvanceClock`, `CanLaunchAt`) sits in the context package, free of proto and sqlc types
  - `universe_state` mapping and queries live only in `memory/pg`
  - consumer-owned ports declared in `internal/memory`: `UniverseClockStore`, `AdvanceProgression`; concretes bound at `cmd/api`
  - handlers stay thin (proto↔domain map and call); the read → guard → advance → hook policy lives in the use-case

## flow
- launch: future-date bound(reject | pass) → per-user lock → clock read → `Diary` insert → `CanLaunchAt`(past-dated: interval {clock, clock} | launch: memories → `AdvanceClock` → `OnAdvance`) → acceleration(empty: none) → reveal
- recall: `SyncStatus.needs_sync`(false | true: consent modal(reject: cancel | accept)) → `Recall` or `RecallDiaryStars`(`sync_consent`) → lock → receipt replay → sync to today(needed but unconsented: refused → consent modal) → recall writes → interval → acceleration

## constraints
- no `values.yaml` key belongs to TIME: the clock is state plus `max`/compare; acceleration timing is the code constant `UNIVERSE_TIME_ACCELERATION`, promoted to a values key only if it ever needs cross-surface tuning
- the demo never mounts `UniverseTimeOverlay` and never reaches the real clock; its time jumps reuse the pure sweep helpers →=DEMO

## chg
- r1 261102 initial
