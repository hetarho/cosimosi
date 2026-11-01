# WRITE diary writing
> r1 | the write session that turns one diary into stars: open, write, split, edit, launch, and the reassurance that the written record can always be taken out

## decisions
- WRITE-1 [o] writing starts from the universe page's `일기 쓰기` affordance (`universe_home_write`), which opens the writing-flow dialog; the start is distinct from the final `별 띄우기` →~WRITE-3
  - the dialog mounts over the running universe canvas and never remounts the renderer; it is not a route of its own →=CLIENT
  - web and mobile both host it in the design-system `Dialog` (a modal on mobile)
  - opening starts a fresh session: an empty body dated today and no proposal →!WRITE-5
  - closing from any phase abandons the session; an RPC already sent is not cancelled, so a launch in flight still commits
- WRITE-2 [o] `별 쪼개기` (`writing_flow_split_action`) runs the split as a synchronous preview the writer watches, never in the background; the result is shown for review and nothing persists until launch →=ENC
  - each proposed memory shows its name, primary emotion, the diary passage it will hold (`writing_flow_source_text_label`) and its neurons as read-only chips
  - the writer edits the emotion directly (one of the 13 moods →=MOOD-2) and the passage as text →!WRITE-4
  - the split is disabled while the body is blank (`writing_flow_empty_body_hint`)
  - while the call runs a restrained pending state shows (`writing_flow_splitting`); a failure returns to writing with `writing_flow_error_split` and the reason toast →=ERR
  - the memory-count target and floor →=ENC-2
- WRITE-3 [o] `별 띄우기` (`writing_flow_launch_action`) sends the confirmed split to `LaunchStars`; on success the new stars appear at once with the launch reveal →=TIME-19
  - the optimistic insert runs after success and is memory-level only: the confirmed name, mood and passage (as current text), the server's memory ids and diary id, the diary date, and a provisional size from the same arousal mapping →~ENC-13
  - neurons, synapses, embeddings, gist texts and the emergent position fill on the next `GetUniverse` read, which the launch invalidates; no polling, no streaming
  - the insert keys off `past_dated`: a past-dated launch inserts nothing →=TIME-1
  - `new_neuron_ids` go to the awaken seam; a clock-moving launch routes them through the advance announcement so the reveal follows the acceleration →=TIME-21
  - a failed launch persists nothing and inserts nothing; the flow returns to the intact proposal with `writing_flow_error_launch` and the reason toast →=ERR
  - on success the dialog closes and the session resets
- WRITE-4 [o] light edits exist only inside the write session; a launched star is never directly editable, and its representation changes only through recall, forgetting and consolidation →=INV-2
  - in-session edits: rename →=WRITE-7, change the emotion, correct the passage, merge a memory with the next one, split one in two, and correct neuron normalization through a merge or a revise
  - touch and natural language reach the same proposal: hand edits apply locally (`packages/universe/src/proposal.ts`), a revise replaces the proposal →!WRITE-8
  - merge keeps the first memory's name and emotion, joins the passages in order and unions the neuron membership; it is disabled at `encode.min_memories_accepted` memories
  - split halves the neuron membership and cuts the passage at the sentence boundary nearest its middle (a lone neuron or a one-sentence passage goes to both halves); it is disabled at `encode.max_memories`
  - a hand-edited passage is the writer correcting their own account and is never fidelity-checked; the `Diary` is untouched either way →~ENC-1
  - a hand split can leave a half without a semantic neuron; the launch then refuses the split and the flow returns to the proposal →=ENC-4
  - the review hint states the boundary (`writing_flow_review_hint`); the widget edits only the pre-launch proposal, never a `GetUniverse` memory
- WRITE-5 [o] the diary date is entered by the writer and defaults to today; whether a date launches →=TIME-1
  - the default is the device's local calendar date (`todayIso`, built from local date parts, never `toISOString`) on web and mobile, not the profile zone's today →~ACCT-7
  - web uses a platform date input; mobile takes an ISO date in a plain text field, with no native picker yet
  - an unparsable date ⇒ `MEMORY_DIARY_DATE_INVALID` (InvalidArgument)
  - the input sets no maximum: a date after the user's profile-zone today passes the split preview and is refused only at launch, nothing saved →=TIME-13
  - edge: on a device whose zone is ahead of the profile zone, the default itself is such a refused date between the two midnights, after the split preview was already billed
- WRITE-6 [o] the written record can always be taken out as CSV or Markdown, and the product says so where a writer may fear losing it: the diary never disappears and can be exported at any time
  - the export contract (`Export`) →=DIARY-14
  - reassurance copy sites: the my-page export card (`me_export_reassurance`), the delete confirm (`deletion_delete_export_reassurance`), the let-go approval (`deletion_letgo_export_reassurance`), and the withdrawal confirm's offer (`withdraw_export_offer`) →=ACCT-10
  - the writing flow carries no export reassurance today
  - `features/export-diaries` on the my-page diary tab: choose CSV or Markdown, then one call; web downloads under the server filename, mobile hands the text to the native share sheet; neither keeps the content →=ACCT-9
- WRITE-7 [o] each memory gets a name, suggested by the LLM from the diary and editable by the writer before launch; the name is `EpisodicMemory.name` →=ENC
  - neuron names are extracted, never named by the writer: the flow has no neuron rename control
  - a blank name cannot launch (`MEMORY_LAUNCH_INVALID_MEMORIES`); after launch the name is not editable →!WRITE-4
- WRITE-8 [o] the writer can retry or edit the split in natural language (`ReviseSplit`, `writing_flow_revise_action`), behind a double defense: strong prompt engineering, and an output schema that carries only memories, neurons, emotion and the passage ← an injected prompt then has no field in which to emit an invariant-violating value
  - the encode shape is only `{memories:[{name, mood, source_text, neurons:[{name, type}]}]}`: at the provider call (JSON-schema-forced), on the wire (`SplitDiaryResponse`, `ConfirmedMemory`) and in the domain DTO (`ExtractResult`)
  - no position, colour, strength, seed, time or delete field exists in any of the three, so nothing can set a coordinate →=INV-5, remove a row →=INV-1 or move the clock →=INV-10
  - a new encode field must be justified against this rule: one that could carry position, colour, strength, seed, time or deletion is rejected in design review, not by validation code
  - prompt rules (event-boundary split, conservative merge) live in the extractor adapter's prompt →=AI; retry and output caps, and the check on the one prose field →=ENC
  - the editable surface mirrors the schema: name, emotion, passage and neuron membership only; no position, colour, strength, seed or time control exists anywhere in the flow →=INV-11
  - a revise sends the current, possibly hand-edited proposal as `previous` with the instruction; a failed revise keeps the proposal and shows `writing_flow_error_revise`
- WRITE-9 [o] before launch the flow predicts a past-dated diary and asks once: `별 띄우기` on a predicted past-dated diary turns into the notice `writing_flow_past_date_notice` plus the confirm `writing_flow_past_date_confirm` ← the diary is kept without a star, and that outcome must never be a silent surprise
  - prediction: `isPastDated(diaryDate, universeTime)` (`packages/universe`) is true only when the cached `GetUniverse.universe_time` exists and the diary date is before it; an empty universe, or a loading or failed read, counts as not past
  - the notice means: this date is behind the universe's present, so the entry is kept as a diary only, with no star
  - a launch that is not predicted past-dated confirms directly; the confirming step is local to the button and stores nothing
  - the server's `past_dated` stays authoritative; the prediction only warns →=TIME-1
- WRITE-10 [o] the session's control state is one XState machine, `writingFlowMachine` (`packages/universe`), whose context holds only the last error kind →=ARCH
  | state | meaning | exits |
  |---|---|---|
  | `idle` | dialog closed | `OPEN` → `writing` |
  | `writing` | body and date being entered | `SPLIT` → `splitting` |
  | `splitting` | `SplitDiary` in flight | ok → `reviewing`; error → `writing` |
  | `reviewing` | editable proposal | `EDIT` (stays); `REVISE` → `revising`; `LAUNCH` → `launching`; `BACK` → `writing` |
  | `revising` | `ReviseSplit` in flight | ok or error → `reviewing` |
  | `launching` | `LaunchStars` in flight | ok → `done`; error → `reviewing` |
  | `done` | stars launched, the session resets | `RESET` → `idle` |
  - `CLOSE` from any phase → `idle`
  - data lives in stores, never in the machine: the draft (`useDiaryDraftStore`) and the proposal (`useProposalStore`)
- WRITE-11 [o] FE placement: `widgets/writing-flow` composes `features/write-diary`, `features/split-diary`, `features/revise-split` and `features/launch-stars`, one user action each →=ARCH
  - the shared substance lives in `packages/universe` (machine, draft and proposal stores, edit helpers, the launch call with its optimistic insert, `isPastDated`), used verbatim by web and mobile
  - web and mobile run the same widget and features; only the `ui` hosts fork
  - the widget imports no `three` and no visual entity: the launch's visual consequence is the read model's projection →=VIS
- WRITE-12 [o] the writing flow is an onboarding composition site that stays unaware of any tour →=ONB
  - the widget wraps three anchors (`writing-draft`, `writing-proposal`, `writing-confirm`) and passes nothing down
  - it reports `writing-flow-opened`, `split-succeeded` and `launch-succeeded` from the machine's real phase transitions only, never from a promise arm; a past-dated launch reports success too
  - the four features import no sequence or onboarding package

## flow
- write: `일기 쓰기` → writing(body, date = today) → `별 쪼개기`(blank: disabled) → splitting(error: back to writing) → reviewing(edit | revise(error: proposal kept)) → `별 띄우기`(predicted past-dated: notice → confirm) → launching(error: back to reviewing, nothing saved) → done(stars appear, reveal after any acceleration) → closed

## constraints
- copy resolves through `packages/i18n` keys (`universe_home_write`, `writing_flow_*`); web and mobile share the keys and no string is hardcoded (`pnpm lint:raw-strings`) →=CLIENT
- the flow hardcodes no tuning number: the count bounds come from generated `encode.*` values →=ARCH

## chg
- r1 261102 initial
