# DEL deletion & letting go
> r1 | the user's only two removals — full delete of a diary (soft delete, restorable, then swept) and letting-go (a permanent seal of one memory's meaning) — their rules, use-cases and UI

## decisions
- DEL-1 [o] full delete is diary-scoped: `Release(diary_id)` soft-deletes every live `EpisodicMemory` born from the `Diary`, seals the orphan neurons and keeps every shared neuron, weakening only the removed memories' contribution to its synapses (LTD) →!DEL-9
  - no per-memory full delete exists: deleting from a star's detail deletes its whole source diary →~DEL-23
  - the memories' activations leave the live graph transitively through the memory's `deleted_at` →=DEL-3
  - contribution edges = synapses whose two endpoints are both live neurons of the removal set, with at least one shared endpoint; an edge between two orphans is not weakened, since both endpoints seal and the edge leaves every dynamic anyway
  - each contribution edge takes one `Depress(strength, deletion.contribution_weaken_amount)` step, an absolute decrement clamped at 0; never `Downscale` →!INV-9
  - the edge is never deleted, even at strength 0, so a shared neuron keeps its other bonds
  - the `Diary` row is never updated: its body stays intact and exportable through the window →!INV-2
- DEL-2 [o] a full delete is a soft delete: restorable until `deleted_at + release.soft_delete_retention_days`, then hard-deleted by the retention sweep →!DEL-13/14
  - `deleted_at` is real-clock UTC: the window is a human-time promise that launches and recalls neither shorten nor extend →~TIME-5
  - Restore succeeds only strictly before the deadline; the sweep treats the deadline itself as due
  - the original diary text is hard-deleted with the sweep: the user-delete exception to the immutable record →=DIARY-4
  - letting-go is not a soft delete and has no window →=DEL-5
  - account withdrawal keeps its own window (`account.withdrawal_retention_days`), independent of any diary release →=ACCT-10
  - during the window the released diary is hidden from every archive read →=DIARY-16
  - it stays in the whole-account Export until the sweep, body only, its soft-deleted memories left out →=DIARY-14
- DEL-3 [o] a soft-deleted or sealed fact leaves every dynamic: one canonical alive-predicate applies at every read and every compute, so nothing invisible still pulls
  | fact | alive iff |
  |---|---|
  | `EpisodicMemory` | `deleted_at IS NULL` |
  | `Neuron` | `sealed_at IS NULL` |
  | `Synapse` | both endpoint neurons alive |
  | `NeuronActivation` | its memory and its neuron alive; no column of its own |
  - covered: `GetUniverse` (all four result sets), force-sim layout (fed only by that read), read-time decay and effective values, consolidation and `Downscale` selection, recall batch-LTP member synapses, the nebula colour field →=VIS
  - a soft-deleted memory's `SemanticMemory` goes with it: it is a stage of the same row, not an entity of its own →~CONSOL-6
  - Encode never reuses a sealed neuron: the same meaning written again births a new neuron →=ENC-10
  - the predicate lives as `deleted_at IS NULL` / `sealed_at IS NULL` clauses in `memory/pg` queries; a compute query that omits it breaks this rule
  - server-authoritative: a client never seals, classifies or `Depress`es; it learns of a removal only by facts disappearing from `GetUniverse` and runs its unchanged math over the smaller graph
- DEL-4 [o] letting-go targets one memory's `semantic` neurons only: its spatial and entity neurons and the memory row itself (emotion columns, seed, universe time; so colour, size and shape) stay untouched →!INV-11
  - the memory is never soft-deleted (only `Release` soft-deletes): it stays live, visible and in the archive as a content-less trace, a silent engram whose meaning is sealed rather than dimmed →~FORGET-2
  - its position and connections recompute for free as the sealed neurons drop out of force-sim input; no position is ever written →!INV-5
  - `current_text` is not rewritten; what thins is the meaning graph, on the next read
  - a memory may be left with no live semantic neuron: the one-semantic-neuron minimum binds encoding, not a later letting-go →~ENC-4
- DEL-5 [o] letting-go is permanent: no `deleted_at`, no timer, no release ledger and no restore ← an intentional act of closure, unlike a full delete made in a hard moment
  - no values key times it: the absence of a letting-go timer key is the guarantee
  - a Restore never unseals a letting-go seal →=DEL-10
  - the UI says so before sealing and offers no undo after →=DEL-28
- DEL-6 [o] letting-go is AI-suggests → user-approves → domain-seals over two RPCs, so "the AI only suggests" is structural: `SuggestLetGo` proposes and writes nothing, `LetGo` seals only user-approved ids the server re-validates →!DEL-15/16
  - the user names the words or meanings to release; the AI ranks only within a candidate set the use-case pre-filtered to this memory's own semantic neurons
  - the AI cannot widen the set: its output schema allows only `{neuron_id, reason}` with `neuron_id` an enum of the offered ids; the use-case intersects the reply with the offered set and takes each name from the offered candidate
  - no AI output field can delete, seal, or name a shared, foreign, spatial, entity or emotion fact
  - the user decides: every suggestion arrives preselected and the user narrows it →=DEL-28
- DEL-7 [o] letting-go is not therapy: every letting-go surface frames it as symbolically blurring a trace, claims no efficacy and never implies the app substitutes for care →~INV-12
  - the first step says it blurs a trace and is not treatment (`deletion_letgo_phrasing_note`)
  - a detected heavy state shows a gentle professional-resource notice at the top of the approve step (`deletion_letgo_resource_*`): advisory, it never blocks or delays the user →!DEL-17
  - the notice says the app does not replace care; the contact line names helplines (Korean lines in both locales)
  - enforced by copy review only: no lint scans in-app deletion copy
- DEL-8 [o] the system never originates a deletion: the retention sweep of a user-released diary is the only hard delete of memory data, besides the account-withdrawal purge →!INV-1
  - no decay, consolidation, force-sim, read, worker, admin or AI path deletes a memory, neuron, synapse, activation, embedding or diary row →~FORGET-3
  - only the release sweep (with Restore's ledger retire) and the withdrawal purge delete memory data; `deletion.sql` holds no `DELETE` and no `UPDATE diaries` →=ACCT-10
  - guard: `pnpm lint:persistence` keeps a hard-delete allowlist naming every statement that may delete a product row; any other `DELETE` fails the gate
- DEL-9 [o] neuron classification is the pure `ClassifyNeurons`: a removal-set neuron is shared iff a retained memory row outside the set activates it, else orphan; orphans seal, shared neurons are kept →~DEL-1/4
  - retained = the memory row still exists: a soft-deleted memory inside its window still owns its neurons, a swept one owns nothing
  - one rule for both removals; only the input differs: every live neuron of the diary's memories (full delete) or the approved semantic neurons (letting-go)
  - an already-sealed neuron never enters a fresh classification
  - evaluated as-of removal inside the removal transaction: `memory/pg` supplies the activation facts, the decision stays in domain code
  - consequence: while two overlapping releases are both inside their windows, a neuron only their memories activate stays unsealed (live, no live activation) until a Restore revives an owner or the last owner's sweep deletes it, so one release never strips a neuron another restorable memory needs
- DEL-10 [o] a release-origin seal is reversible only while the release effect's recorded `sealed_at` equals the neuron's current `sealed_at`; a letting-go seal is never reversed →!DEL-5
  - Restore and the sweep run `ReclassifyRetainedNeuronSeals` over every neuron the release's memories activate: retire every release effect on it, unseal only a seal a release effect owns, keep every other seal
  - on Restore, each neuron left live or just unsealed is queued for identity- and revision-fenced re-embedding →=AI
- DEL-11 [o] the release-effect ledger is retention-scoped, not provenance: `release_groups(id, user_id, diary_id, deleted_at)` with `UNIQUE(user_id, diary_id)`, plus three effect tables `ON DELETE CASCADE` off the group →~MEM
  | table | records |
  |---|---|
  | `release_memories` | the memory ids this release soft-deleted |
  | `release_sealed_neurons` | the neurons this release moved from unsealed to sealed, with the `sealed_at` that fences ownership |
  | `release_synapse_deltas` | the LTD actually applied per contribution edge (`applied_delta`, on the `REAL` storage grid) |
  - one live release per diary: the unique key backs `MEMORY_ALREADY_RELEASED`
  - a group row means "this diary is released"; Restore and the sweep retire a release by deleting that one row, and the effects cascade
  - every ledger table carries `user_id` (guard: `pnpm lint:persistence`) →=ACCT-1
- DEL-12 [o] `Release` runs as one transaction in a fixed order; any failure rolls all of it back →!DEL-21
  - order: graph lock → already-released guard → soft-delete → group and memory rows → classify → seal orphans, record seals → weaken contribution edges, record deltas → cancel the memories' jobs → schedule the retention job → achievement progress
  - before the transaction it sweeps the caller's expired groups (secondary cleanup, not the durable trigger) →~DEL-14
  - refusals: empty id `MEMORY_RELEASE_INPUT_REQUIRED` (InvalidArgument); group exists `MEMORY_ALREADY_RELEASED` (FailedPrecondition); no live memory (unknown, foreign, swept or never-launched diary) `MEMORY_RELEASE_NO_LIVE_MEMORIES` (NotFound) →=ERR
  - so a diary with no live memory can never be deleted: a past-dated diary (saved, never launched) leaves only with account withdrawal →~TIME-1
  - the reader disables the delete control for such a diary →~DIARY-19
  - the released memories' pending and running memory-targeted jobs are cancelled and lease-fenced in the same transaction, tagged with the release →=AI
  - response: `diary_id`, the soft-deleted `episodic_memory_ids` (the authoritative removal set), `deleted_at` (RFC 3339 UTC)
  - a Release adds its soft-deleted memory count to the `episodic_memory_released` achievement counter; Restore never lowers it and LetGo never counts →=ACH-10
- DEL-13 [o] `Restore(diary_id)` reverses one release exactly, in one transaction, only strictly before its deadline →!DEL-10/11
  - refusals: no group (never released or already swept) `MEMORY_RESTORE_NOT_RELEASED` (NotFound); at or past the deadline `MEMORY_RESTORE_WINDOW_EXPIRED` (FailedPrecondition), even before the sweep has run
  - effects: clear `deleted_at` on the recorded memories → reclassify seals → add each recorded delta back to the edge's current strength, clamped to [0, cap] atomically in SQL → revive exactly the jobs this release cancelled → delete the retention job → delete the group
  - the delta adds to the current strength, so interim `Potentiate` or `Downscale` is composed with, never overwritten →~LINK-5
  - the restored memories rejoin every dynamic and reappear in `GetUniverse` and the archive
  - response: `diary_id` and the restored `episodic_memory_ids`
- DEL-14 [o] the retention sweep runs from a durable queue job, never a cron: each Release enqueues, inside the Release transaction, one deduplicated identity-only `retention_sweep` job at exactly its deadline →!DEL-2
  - the normal worker loop runs it even if the user never returns →~TIME-4
  - it never dead-letters for a spent retry budget, being the sole trigger of a promised deletion →=AI
  - claimed before the deadline ⇒ rescheduled to the deadline; group already gone (restored or swept) ⇒ success, no-op
  - it reclassifies seals first, then takes exclusive neurons from all activations of the release's memories, not only the ones this release sealed, so the last retained owner removes a true orphan →!DEL-10
  - order: jobs on those targets → activations → synapses touching exclusive neurons → their embeddings → exclusive neurons → the soft-deleted memories (provenance cascades) → the `Diary` row once no memory references it → the group
  - it never touches a live memory or a neuron another retained memory activates
- DEL-15 [o] `SuggestLetGo(episodic_memory_id, words)` returns AI-ranked seal candidates plus a heavy-state hint and persists nothing →!DEL-6
  - the target must be the caller's (`MEMORY_RELEASE_MEMORY_NOT_FOUND`, NotFound) and live (released ⇒ `MEMORY_RELEASE_MEMORY_UNAVAILABLE`, FailedPrecondition)
  - candidates: unsealed `semantic` neurons this memory activates that no other retained memory row activates (a released memory inside its window still counts as an owner)
  - an empty candidate set makes no AI call and returns an empty list
  - each candidate carries `neuron_id`, `name` (from the offered set) and `reason` (AI-authored, shown verbatim, not localized)
  - no Twinkle, but a metered AI call under the AI call caps; over cap ⇒ `MEMORY_AI_CALL_CAP_REACHED` (ResourceExhausted) →=AI
  - `words` is free text the client requires non-blank; the server never persists it
- DEL-16 [o] `LetGo(episodic_memory_id, approved_neuron_ids)` seals exactly the approved ids after re-validating each one server-side, all or nothing →!DEL-9
  - valid id = a `semantic` neuron this memory activates and no other retained memory activates, sealed or not; any other id (shared, foreign, non-semantic, unknown) ⇒ `MEMORY_LET_GO_INVALID_APPROVED` (InvalidArgument), nothing sealed
  - re-approving a neuron this memory already let go is an idempotent no-op; an empty list succeeds and seals nothing
  - the target refusals of `SuggestLetGo` apply, with liveness re-checked inside the transaction →=DEL-15
  - the seal stamps real-clock `sealed_at` and still routes through `ClassifyNeurons`, keeping one sealing path
  - response: `sealed_neuron_ids`, the approved ids now sealed
- DEL-17 [o] the heavy-state hint `HeavyState{detected, severity}` is derived server-side inside `SuggestLetGo` by a conservative v1 keyword cue, default not detected
  - detected iff the words contain a cue of `heavyStateCues` (`internal/memory/release.go`); the cues are English only, so Korean words never trip it
  - severity `elevated` when the memory's mood sits in the negative-high-arousal quadrant, else `present`; clients read only `detected`
  - code, not a values key; the hint claims no clinical judgement
- DEL-18 [?] how heavy-state detection is refined beyond the v1 English keyword cue (locale-aware cues, a model-side signal) is open; the slot is reserved →~DEL-17
- DEL-19 [o] the removal surface is four unary RPCs on `memory.v1.MemoryService` — `Release`, `Restore`, `SuggestLetGo`, `LetGo` — never one verb with a kind field →=ARCH
  - requests carry only `{diary_id}` or `{episodic_memory_id, words}` or `{episodic_memory_id, approved_neuron_ids}`: no emotion, position, colour, strength, time or hard-delete field →!INV-11
  - targets, orphan-ness and approved-id validity are server decisions, never taken from client state
  - all four are mutations (never `NO_SIDE_EFFECTS`, never GET) and carry no `operation_id`: a retried Release refuses as already released, a retried Restore as not released, a retried LetGo is a no-op
  - handlers stay thin (proto↔domain map and call); every read, seal, unseal, delete and suggestion is scoped to the authenticated user →=ACCT-1
- DEL-20 [o] removal is never priced: `Release`, `Restore`, `SuggestLetGo` and `LetGo` spend no Twinkle and take no `SpendGate` →~TWINK-4
- DEL-21 [o] every removal transaction (Release, Restore, LetGo, both sweeps) first takes the per-user graph-mutation lock `LockGraphMutation`, in the global order graph lock → release-group row → graph rows →=MEM
  - the same lock serializes launch, recall sync and consolidation, so a removal and a recall compose serially →~TIME-8
  - contribution synapses are read `FOR UPDATE`; the ledger records the delta as PostgreSQL stored it, so Restore adds back exactly that
  - Restore and the targeted sweep lock the exact group row `FOR UPDATE` without `SKIP LOCKED`, so a boundary race can neither skip the group nor half-sweep a restored diary
- DEL-22 [o] BE placement: deletion is core behaviour of the memory aggregate in `internal/memory`, not a context of its own →=ARCH
  - the pure rules sit in `deletion.go` (`ClassifyNeurons`, `ReclassifyRetainedNeuronSeals`, the alive-predicate's statement of intent); the use-cases in `release.go`
  - consumer-owned ports in `release_ports.go`: `SealSuggester` (real adapter and keyless mock bound at `cmd/api` →=AI), `ReleaseRepo`, `ReleaseTx`
  - `ReleaseTx` exposes no `Diary` update: the sweep's whole-row delete is the only `Diary` write
  - sqlc only in `memory/pg`, over `db/queries/memory/deletion.sql` and `release.sql`
  - no FE↔BE golden parity: removal is single-writer server state; the one shared formula, `Depress`, is pinned by its owner →=LINK
- DEL-23 [o] the deletion flow opens only from three affordances, all into the same `DeletionFlowSheet` through the one-slot `useDeletionTargetStore` (`delete` by diary id, `letGo` by memory id)
  | affordance | host | opens |
  |---|---|---|
  | `deletion_delete_entry_action` on an opened archive entry | diary reader →=DIARY-19 | full delete of that diary; disabled while it has no live memory |
  | `star_detail_delete_source` in the star detail menu | universe →=RECALL | full delete of the star's source diary |
  | `star_detail_letgo` in the star detail menu | universe →=RECALL | letting-go of that episodic memory |
  - the source diary resolves from the memory's own `diary_id` (on `GetUniverse` and stamped on a launch's optimistic insert), never from the archive having loaded
  - a gist star routes to the gist view and offers no letting-go →=RECALL
  - the onboarding tour has no deletion anchor →=ONB
- DEL-24 [o] the deletion flow takes the screen alone: a universe host sends `CLEAR_SELECTION` to its navigation actor before opening either branch, closing the star detail panel first
  - never two modal surfaces stacked (two scrims, two focus traps), never a selection left on a star the flow may remove
  - backing out returns to the bare canvas, not to the panel the action came from
  - the sheet opens over the running canvas without remounting the renderer →=VIS
  - mobile hosts the sheet on both the universe and diary-reader screens against one target store; each consumes it only while focused (`useIsFocused()`)
- DEL-25 [o] full delete is one plainly worded confirm with no type-to-confirm gate ← the restore window already makes it reversible, so heavy friction would read as punitive
  - it lists the stars that will go: the archive mirror answers on the reader, the live memory mirror by `diary_id` elsewhere; both hold live memories only, so the lists agree
  - it says shared meaning stays (`deletion_delete_kept_shared`)
  - it states the restore window (`deletion_delete_restore_reassurance`), its days from generated config, never a literal
  - it states that export stays possible before deletion and during the window (`deletion_delete_export_reassurance`) and that the original text goes for good after it (`deletion_delete_permanent_after_window`) →~WRITE-6
  - no "delete permanently now" control exists anywhere →!DEL-8
- DEL-26 [o] the client applies a removal only on success and lets the next read settle the rest →=CLIENT
  - `Release`: remove the returned ids from the episodic-memory mirror at once (no residual pull), record the group for restore, invalidate `GetUniverse`, both `GetDiaries` keys (finite and infinite), the calendar and achievements
  - `Restore`: re-insert the group's captured memories (deduped by id), drop the group, invalidate the same reads
  - `LetGo`: no optimistic mark; invalidate `GetUniverse` and the calendar so the sealed neurons drop on the next read
  - failure applies nothing: an error toast, and the step stays open and retriable (`deletion_delete_error`, `deletion_letgo_suggest_error`, `deletion_letgo_seal_error`, which says nothing was blurred)
  - sealing, weakening and the layout re-settle arrive with the next `GetUniverse`; no polling, no streaming
- DEL-27 [o] restore is offered only for releases made in the current session: the diary reader's `RestoreSection` (`deletion_restore_section_title`) lists the groups this session's `Release` responses recorded ← v1 adds no read RPC that lists release groups
  - a reload or another device lists none, though the server still accepts `Restore(diary_id)` until the deadline
  - shown as one text control above the archive's conditions only while the session holds a group; with none it is absent, not a disabled control →=DIARY-18
  - each row: the memory count (`deletion_restore_group_summary`), the days left from `remainingRestoreDays` (ceil, clamped to [0, retention]; 0 shows `deletion_restore_window_today`) and `deletion_restore_action`
  - the user-scope reset (`resetUniverseUserState`) clears the released-groups store and the deletion target, so a release never shows to another user in one process →=CLIENT
- DEL-28 [o] the letting-go UI runs four steps — say the words → suggest → approve → seal — with no undo after the seal →!DEL-6
  - say the words: a free-text phrase (`deletion_letgo_phrasing_prompt`) under the not-treatment note; suggesting stays disabled while it is blank
  - approve: every candidate preselected with its reason; the user unchecks; zero selected disables the seal; an empty list shows `deletion_letgo_approve_empty`; back returns to rewording
  - the approve step states what stays — emotion, time, space, entity, colour and the star (`deletion_letgo_kept_facts`) — and, by the seal action, that it cannot be undone (`deletion_letgo_permanence`) and that the diary itself stays exportable (`deletion_letgo_export_reassurance`) →~WRITE-6
  - success closes the sheet; the star stays, thinned on the next read
- DEL-29 [o] the flow's control state is one XState machine, `deletionFlowMachine` (`packages/universe`), two branches meeting at `done` →=ARCH
  | state | meaning | exits |
  |---|---|---|
  | `idle` | sheet closed | `OPEN_DELETE` → `confirmingDelete`; `OPEN_LETGO` → `phrasing` |
  | `confirmingDelete` | confirm shown | `CONFIRM` → `deleting`; `CANCEL` → `idle` |
  | `deleting` | `Release` in flight | `DONE` → `done`; `ERROR` → `confirmingDelete` |
  | `phrasing` | say the words | `SUGGEST` → `suggesting`; `CANCEL` → `idle` |
  | `suggesting` | `SuggestLetGo` in flight | `DONE` → `approving`; `ERROR` → `phrasing` |
  | `approving` | review and select | `SEAL` → `sealing`; `BACK` → `phrasing`; `CANCEL` → `idle` |
  | `sealing` | `LetGo` in flight | `DONE` → `done`; `ERROR` → `approving` |
  | `done` | act completed, sheet closes | `RESET` → `idle` |
  - the in-flight states take no `CANCEL` and the sheet's close and backdrop are inert meanwhile, so a stale completion never lands on a newly opened branch
  - context holds ids only (the target diary or memory); the phrase, candidates, selection and heavy flag live in `useDeletionDraftStore`
  - restore is not a state: it is a one-shot feature its host drives
- DEL-30 [o] FE placement: `widgets/deletion-flow` composes `features/delete-memory`, `features/restore-memory` and `features/let-go` →=ARCH
  - the shared substance lives in `packages/universe` (the machine, the target, draft and released-groups stores, the four RPC wrappers and the optimistic helpers in `deletion.ts`), used verbatim by web and mobile
  - web and mobile run the same widget and features; only the `ui` segment forks
  - the widget reads only the domain mirrors, never `three` or a visual entity
  - `features/restore-memory` is mounted by the diary reader →=DIARY-18
  - every string comes from the `deletion_*` i18n keys, in the product's most restrained voice →=UI

## flow
- full delete: delete affordance(reader entry | star source diary) → confirm(cancel: bare canvas | confirm) → `Release`(refused: confirm stays | ok: stars removed, group recorded) → window(`Restore` before the deadline: stars back | deadline: retention sweep hard-deletes)
- letting-go: star detail `star_detail_letgo` → words → `SuggestLetGo`(error: words) → approve(heavy: resource notice | back: words | cancel) → `LetGo`(error: approve, nothing sealed | ok: silent engram) → no undo

## constraints
- values keys: `deletion.contribution_weaken_amount` (the LTD step per contribution edge) and `release.soft_delete_retention_days` (the window, read by both runtimes from generated config); no letting-go timer key and no candidate-cap key exist
- removal is the user's explicit act only: `Release` and `LetGo` are reached only through their RPCs, and the worker only executes the sweep a user's Release scheduled →=INV-1

## chg
- r1 261102 initial
