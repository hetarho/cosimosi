# policy: consolidation

> Domain policy for consolidation — 우주의 잠 (the universe's sleep). Owned by plan
> [41.consolidation-usecase](../../plan/41.consolidation-usecase.md); the as-built orchestration lives in
> [tech/memory-encode.md](../../tech/memory-encode.md) (the advance write path) and the `Downscale` math in
> [tech/synapse-plasticity.md](../../tech/synapse-plasticity.md). Reinforces [I1][I2][I5][I9][I10] and PRD
> [C1][C2][C4][C6][C7][T4].

## The rule

**Consolidation runs during a clock advance, never on a cron** ([T4]). The universe sleeps exactly when its clock
jumps — a star-launch accelerates to the diary date, a recall syncs to today — and each advance carries its own sleep,
fired by the `AdvanceProgression` hook inside the same transaction as the advance. There is no scheduler, no
background sweep, and no RPC: consolidation is a consequence of an advance, never a user action. A held clock (a
same-day sync, an equal-date launch) crosses no interval and consolidates nothing; the first-ever advance has no prior
interval to sleep over and also consolidates nothing.

**Over the advance interval, sleep does the brain's three jobs.** (1) **Gist stages rise** ([C1][C6]): every memory
whose semanticize timer crossed one or more stage boundaries advances `semantic_stage` by the crossed count, clamped
at the ladder ceiling; the stage texts are pregenerated at launch ([C7]) so no LLM runs inline, and each crossed stage
appends one `semanticized/system` 변천사 row so the timeline stays continuous across a large jump. (2) **Replay
reorganizes touched constellations** ([C2]): the stage-advanced memories plus their shared-neuron neighbors (bounded
by `consolidation.replay_neighbor_hops`) get their synapses' activation recency refreshed — a read-time re-layout
marker, never a stored coordinate ([I5]); the whole universe is never replayed at once. (3) **Weak synapses
downscale** ([C4]): every synapse that slept through the interval is homeostatically renormalized.

**`Downscale` is SHY, not LTD, and never a deletion** ([C4][I9][I1]). Homeostatic downscaling is a global,
proportional, per-sleep renormalization — weak edges lose proportionally more of themselves, strong edges are spared —
and it is a **separate pure function** from `Depress` (associative, local, competition-driven). A downscaled edge
approaches a **positive residual floor** and stops there: no synapse, neuron, or memory is ever removed. An edge
activated at the advance target itself (linked inside the advancing transaction, or replay-refreshed) did not sleep
and is not downscaled.

**Consolidation is convergent over the interval.** Materializing a rise also consumes the crossed units from the
gist-timer anchor (`semanticize_timer_reset_at` moves forward by exactly the days those units spanned, residual
sub-unit progress carried), so re-reading an already-consolidated interval implies zero further work; a stage never
decrements and the anchor never rewinds ([I10][C7]).

**Sleep also persists what forgetting reached** ([F1][R8a]). Newly crossed forgetting stages get their deterministic
word-loss texts written during the advance — a content write, not a tick: brightness and the current decay stage stay
read-time derived, and an existing stage text is never overwritten.

**Heavy work leaves the transaction** ([C7], §2.8). Interval-implied LLM/embedding work — re-embedding the replayed
constellation, regenerating a genuinely missing gist text — is enqueued on the worker (`consolidate` / `semanticize`
job kinds), keeping the advance fast. The consolidate job carries identity only; the worker re-reads the authoritative
neuron texts at execution. A risen memory whose gist texts never landed is re-enqueued on every later advance until
the ladder exists — a gist is never permanently unviewable.

**The Diary is never touched** ([I2]). Consolidation changes representation only — `semantic_stage`, stored decay-stage
texts, synapse strength, activation recency — plus append-only provenance; the objective record is not in its write
set, structurally (the consolidation transaction surface exposes no Diary write and no delete).
