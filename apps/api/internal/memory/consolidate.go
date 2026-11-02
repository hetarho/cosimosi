package memory

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/cosimosi/api/internal/platform/values"
)

// Consolidation (우주의 잠, [C1][C2][C4][T4]) is what happens while the universe clock jumps:
// the Consolidator is the production AdvanceProgression binding.
// Fired inside the same advance transaction as launch and sync-to-today, it advances the gist
// stages whose semanticize timer crossed ([C6]), persists newly reached forgetting-stage texts
// ([F1][R8a]), marks the replay sets for the read-time companion re-layout ([C2]),
// homeostatically Downscales the user's synapses (SHY, [C4][I9]), and enqueues the interval's
// heavy work on the worker ([C7]). There is no cron and no RPC — the advance hook is the sole
// trigger, and consolidation is never a user action ([T4]).

// StageAdvance is one memory's gist rise over the advance interval: the risen stage and the
// consumed timer anchor. Persisting the consumed anchor is what makes Consolidate convergent —
// the next advance counts only the residual days, so an already-consolidated interval implies
// zero further units (A10). The anchor only ever moves forward ([I10]). Stage may equal the
// memory's current stage when only the anchor moves (a crossing whose ladder text is missing
// consumes its units but defers the visible rise to the pending record below).
type StageAdvance struct {
	MemoryID     string
	Stage        int16
	TimerResetAt time.Time
}

// PendingGistRise is a crossing whose ladder text is missing: the stage the timer
// reached and the crossing's universe-time. Recorded on the memory row instead of publishing
// an empty stage/provenance; the semanticize completion transaction materializes it once real
// text exists. The units are already consumed via StageAdvance's anchor, so rise math for
// later intervals counts from max(visible, pending).
type PendingGistRise struct {
	MemoryID string
	Stage    int16
	RiseAt   time.Time
}

// SynapseStrength is one synapse's stored base strength — the Downscale batch reads and
// writes this same shape (the pure Downscale fn stays the source of truth; the store only
// writes the computed value).
type SynapseStrength struct {
	SynapseID string
	Strength  float64
}

// ConsolidationMemory is consolidation's scalar view of one memory: the anchors and stage integers
// the interval math reads, with text presence summarized so that ladder and decay texts are fetched
// only for the memories whose stage actually crosses. A user returning after weeks crosses stages
// on most memories, but reading every memory's text to find out would put the whole universe's
// text on the wire inside the graph lock.
type ConsolidationMemory struct {
	ID                       string
	Arousal                  float64
	BaseStrength             float64
	RecallCount              int32
	CreatedUniverseTime      time.Time
	LastRecalledUniverseTime *time.Time
	ForgettingOffsetDays     float64
	SemanticStage            int16
	SemanticizeTimerResetAt  *time.Time
	PendingSemanticStage     *int16
	RepresentationRevision   int64
	// SemanticStagesPresent sets bit (stage - 1) for every ladder rung holding non-blank text.
	SemanticStagesPresent uint32
	// DecayStageCount is the stored decay-text array's length and DecayStagesFilled its non-empty
	// entries; they are equal exactly when the stored array has no hole.
	DecayStageCount   int
	DecayStagesFilled int
}

// ConsolidationTexts are the texts a crossing memory needs: its ladder for the provenance rows a rise
// publishes, and its current text, seed and stored decay texts for the decay fill.
type ConsolidationTexts struct {
	MemoryID       string
	CurrentText    string
	Seed           *int64
	SemanticStages *SemanticStages
	DecayStages    []string
}

// DecayStageFill is one memory's merged decay-stage text array.
type DecayStageFill struct {
	MemoryID string
	Stages   []string
}

// ConsolidateTx declares the consolidation writes required by the advance hook at compile time.
// The pg transaction store implements it directly. It exposes no Diary write or deletion,
// so consolidation cannot express an [I1]/[I2] violation.
type ConsolidateTx interface {
	UniverseClockStore
	EnqueueJob(ctx context.Context, scope platform.UserScope, job jobqueue.Record) (jobqueue.Record, error)
	// EnqueueJobs inserts dedup-free jobs in one statement; the caller sizes the batch.
	EnqueueJobs(ctx context.Context, scope platform.UserScope, jobs []jobqueue.Record) error
	// ActiveTargetIDs returns which of the targets a pending or running job of kind already covers
	// at the expected revision.
	ActiveTargetIDs(ctx context.Context, scope platform.UserScope, kind jobqueue.Kind, targets []jobqueue.Target) ([]string, error)
	// AppendMemoryProvenances appends 변천사 rows in batches ([R8a]).
	AppendMemoryProvenances(ctx context.Context, scope platform.UserScope, entries []MemoryProvenance) error
	// ConsolidationWatermarkForUpdate returns (locked, nil = never consolidated) the
	// universe-time this user's consolidation already processed through — the clamp
	// that makes a duplicate or overlapping invocation exactly-once (A4/A10).
	ConsolidationWatermarkForUpdate(ctx context.Context, scope platform.UserScope) (*time.Time, error)
	// SetConsolidationWatermark moves the marker to the processed interval's end, after
	// every interval effect succeeded in this same transaction. Monotone ([I10]).
	SetConsolidationWatermark(ctx context.Context, scope platform.UserScope, through time.Time) error
	// ListMemoriesForConsolidation returns the user's non-deleted memories as scalar projections:
	// the stage/timer/decay anchors the interval math reads, and no text.
	ListMemoriesForConsolidation(ctx context.Context, scope platform.UserScope) ([]ConsolidationMemory, error)
	// ConsolidationTexts returns the texts of the given memories, for the crossings that need them.
	ConsolidationTexts(ctx context.Context, scope platform.UserScope, memoryIDs []string) ([]ConsolidationTexts, error)
	// ApplyStageAdvances persists the risen stages + consumed timer anchors in one batch.
	// The stage write is GREATEST-guarded in SQL — a stage never decrements ([C7]).
	ApplyStageAdvances(ctx context.Context, scope platform.UserScope, advances []StageAdvance) error
	// RecordPendingGistRises persists deferred crossings in one batch: the pending stage
	// only ever extends (GREATEST) and the first crossing's universe-time is kept as the
	// event time the finalized provenance rows will carry.
	RecordPendingGistRises(ctx context.Context, scope platform.UserScope, rises []PendingGistRise) error
	// FillDecayStages replaces each memory's stored decay-stage text array with the merged array
	// the caller built, in batches. The caller merges (existing entries are never overwritten);
	// the per-user advisory lock serializes the read-merge-write.
	FillDecayStages(ctx context.Context, scope platform.UserScope, fills []DecayStageFill) error
	// ReplaySetNeurons returns the live neurons activated by the given memories — the
	// replay-set expansion input ([C2]).
	ReplaySetNeurons(ctx context.Context, scope platform.UserScope, memoryIDs []string) ([]ExistingNeuron, error)
	// MemoriesActivatingNeurons returns the non-deleted memories activating any of the
	// given neurons — the shared-neuron neighbor expansion ([C2]).
	MemoriesActivatingNeurons(ctx context.Context, scope platform.UserScope, neuronIDs []string) ([]string, error)
	// TouchReplaySetSynapses moves last_activated_universe_time forward to the advance
	// time for every synapse with BOTH endpoints in the replay set — the replay marker
	// the read consumes ([C2]); no coordinate is ever stored ([I5]).
	TouchReplaySetSynapses(ctx context.Context, scope platform.UserScope, neuronIDs []string, universeTime time.Time) error
	// ListSynapseStrengths returns the user's synapses (id + stored base) last activated
	// BEFORE the given universe time — the edges that actually slept through the interval.
	// Edges activated at the advance target (just launched in this very transaction, or
	// replay-refreshed) did not sleep and are excluded from the Downscale set ([C4]).
	ListSynapseStrengths(ctx context.Context, scope platform.UserScope, activatedBefore time.Time) ([]SynapseStrength, error)
	// ApplySynapseDownscale writes the renormalized bases in one batch. It updates rows in
	// place — never inserts, never deletes ([I1]).
	ApplySynapseDownscale(ctx context.Context, scope platform.UserScope, updates []SynapseStrength) error
}

// Consolidator is the concrete AdvanceProgression handler ([T4]), bound at cmd/api. It works
// through the declared progression capability. Held clocks are a no-op, and the handler
// requires no runtime capability assertion.
type Consolidator struct {
	newID func() string
}

// NewConsolidator builds the handler; a nil newID selects the platform generator (the seam
// exists for deterministic provenance/job ids in tests).
func NewConsolidator(newID func() string) Consolidator {
	if newID == nil {
		newID = platform.NewID
	}
	return Consolidator{newID: newID}
}

// OnAdvance implements AdvanceProgression over the crossed interval (from, to].
func (c Consolidator) OnAdvance(ctx context.Context, scope platform.UserScope, tx ProgressionTx, from *time.Time, to time.Time) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	// A nil from is the first-ever advance: every row in the universe was born inside this
	// very transaction at `to`, so no interval existed to sleep over — consolidating would
	// only downscale synapses created moments ago.
	if from == nil {
		return nil
	}
	// Defense-in-depth for A10: the hook already fires only when the clock actually moved,
	// but a held or rewound target must stay a total no-op ([I10]).
	if !to.After(*from) {
		return nil
	}
	return c.consolidate(ctx, scope, tx, *from, to)
}

func (c Consolidator) consolidate(ctx context.Context, scope platform.UserScope, tx ConsolidateTx, from time.Time, to time.Time) error {
	// Exactly-once over the interval (A4/A10): clamp to the unprocessed suffix. A duplicate
	// invocation of a processed interval is a total no-op; an overlapping one consolidates
	// (and downscales) only the days the watermark has not covered yet.
	watermark, err := tx.ConsolidationWatermarkForUpdate(ctx, scope)
	if err != nil {
		return err
	}
	if watermark != nil {
		if !to.After(*watermark) {
			return nil
		}
		if watermark.After(from) {
			from = *watermark
		}
	}

	memories, err := tx.ListMemoriesForConsolidation(ctx, scope)
	if err != nil {
		return err
	}
	texts, err := c.crossingTexts(ctx, scope, tx, memories, from, to)
	if err != nil {
		return err
	}

	advances := make([]StageAdvance, 0)
	pendings := make([]PendingGistRise, 0)
	provenance := make([]MemoryProvenance, 0)
	fills := make([]DecayStageFill, 0)
	regenTargets := make([]jobqueue.Target, 0)
	risenMemoryIDs := make([]string, 0)
	for i := range memories {
		episodicMemory := &memories[i]
		memoryTexts := texts[episodicMemory.ID]
		strength := EffectiveStrength(episodicMemory.BaseStrength, episodicMemory.RecallCount)

		advance, pending, published := c.advanceGistStage(episodicMemory, memoryTexts, strength, to)
		provenance = append(provenance, published...)
		// The repair horizon spans the visible stage AND any recorded pending rise: a
		// pending memory must keep re-enqueueing regeneration on every advance until
		// its completion lands, or a dead job would leave the rise deferred forever.
		reachedStage := int(episodicMemory.SemanticStage)
		if episodicMemory.PendingSemanticStage != nil && int(*episodicMemory.PendingSemanticStage) > reachedStage {
			reachedStage = int(*episodicMemory.PendingSemanticStage)
		}
		if advance != nil {
			advances = append(advances, *advance)
			if int(advance.Stage) > reachedStage {
				reachedStage = int(advance.Stage)
			}
		}
		if pending != nil {
			pendings = append(pendings, *pending)
			if int(pending.Stage) > reachedStage {
				reachedStage = int(pending.Stage)
			}
		}
		// The interval touched this memory's gist axis — visibly or as pending work.
		if advance != nil && int(advance.Stage) > int(episodicMemory.SemanticStage) || pending != nil {
			risenMemoryIDs = append(risenMemoryIDs, episodicMemory.ID)
		}
		// Repair pass ([C7], A9): a reached stage whose pregenerated text never landed (a
		// dead semanticize job, or a rise deferred as pending) would otherwise stay
		// unviewable forever — a memory at the ceiling crosses no further boundary, so
		// the check cannot live on the rise alone.
		if reachedStage >= 1 && missingStageText(episodicMemory, memoryTexts, reachedStage) {
			regenTargets = append(regenTargets, jobqueue.Target{
				Kind: jobqueue.TargetMemory, ID: episodicMemory.ID, ExpectedRevision: episodicMemory.RepresentationRevision,
			})
		}
		if fill, ok := newlyReachedDecayFill(episodicMemory, memoryTexts, strength, from, to); ok {
			fills = append(fills, fill)
		}
	}
	if len(provenance) > 0 {
		if err := tx.AppendMemoryProvenances(ctx, scope, provenance); err != nil {
			return err
		}
	}
	if len(advances) > 0 {
		if err := tx.ApplyStageAdvances(ctx, scope, advances); err != nil {
			return err
		}
	}
	if len(pendings) > 0 {
		if err := tx.RecordPendingGistRises(ctx, scope, pendings); err != nil {
			return err
		}
	}
	if len(fills) > 0 {
		if err := tx.FillDecayStages(ctx, scope, fills); err != nil {
			return err
		}
	}
	if err := c.enqueueSemanticizeRegens(ctx, scope, tx, regenTargets); err != nil {
		return err
	}

	// Downscale runs BEFORE the replay marker refreshes activation recency: the slept-edge
	// filter (activated before `to`) must still see the replay set's pre-replay state, or
	// the touched edges would skip the very sleep that replayed them.
	if err := c.downscaleSynapses(ctx, scope, tx, to); err != nil {
		return err
	}

	replayNeurons, err := c.markReplaySet(ctx, scope, tx, risenMemoryIDs, to)
	if err != nil {
		return err
	}

	// Interval-implied heavy work leaves the transaction ([C7], §2.8): the replay set's
	// neurons re-embed on the worker, never inline.
	if len(replayNeurons) > 0 {
		if err := c.enqueueConsolidateJob(ctx, scope, tx, replayNeurons); err != nil {
			return err
		}
	}

	// The marker moves last, atomically with every effect above — a rolled-back attempt
	// leaves it untouched and the interval retryable (A4).
	return tx.SetConsolidationWatermark(ctx, scope, to)
}

// crossingTexts fetches, in one read, the texts of the memories whose interval needs them: a rise
// whose first newly crossed rung has text to publish, and a decay crossing whose stored texts do not
// already cover the reached stage. Every other memory is decided from its scalar projection alone.
func (c Consolidator) crossingTexts(ctx context.Context, scope platform.UserScope, tx ConsolidateTx, memories []ConsolidationMemory, from time.Time, to time.Time) (map[string]*ConsolidationTexts, error) {
	needed := make([]string, 0)
	for i := range memories {
		episodicMemory := &memories[i]
		strength := EffectiveStrength(episodicMemory.BaseStrength, episodicMemory.RecallCount)
		if publishesRise(episodicMemory, strength, to) || needsDecayFill(episodicMemory, strength, from, to) {
			needed = append(needed, episodicMemory.ID)
		}
	}
	if len(needed) == 0 {
		return nil, nil
	}
	rows, err := tx.ConsolidationTexts(ctx, scope, needed)
	if err != nil {
		return nil, err
	}
	texts := make(map[string]*ConsolidationTexts, len(rows))
	for i := range rows {
		texts[rows[i].MemoryID] = &rows[i]
	}
	return texts, nil
}

// gistTarget is the stage a memory's gist timer reached by `to`, with the anchor and units the rise
// consumes. ok is false when nothing crosses.
func gistTarget(episodicMemory *ConsolidationMemory, strength float64, to time.Time) (target int, anchor time.Time, units int, ok bool) {
	effectiveStage := int(episodicMemory.SemanticStage)
	if episodicMemory.PendingSemanticStage != nil && int(*episodicMemory.PendingSemanticStage) > effectiveStage {
		effectiveStage = int(*episodicMemory.PendingSemanticStage)
	}
	if effectiveStage >= semanticMaxStage {
		return 0, time.Time{}, 0, false
	}
	// The gist-timer anchor: recall/reconsolidation resets it; a never-recalled memory
	// counts from its creation (the NULL timer column reads as created-at).
	anchor = episodicMemory.CreatedUniverseTime
	if episodicMemory.SemanticizeTimerResetAt != nil {
		anchor = *episodicMemory.SemanticizeTimerResetAt
	}
	units = GistUnitsElapsed(to, anchor, episodicMemory.Arousal, strength)
	if units <= 0 {
		return 0, time.Time{}, 0, false
	}
	return Semanticize(effectiveStage, units), anchor, units, true
}

// publishesRise reports whether a rise could publish a stage: nothing is pending and the first
// newly crossed rung has text. Only then are the ladder texts needed.
func publishesRise(episodicMemory *ConsolidationMemory, strength float64, to time.Time) bool {
	if episodicMemory.PendingSemanticStage != nil {
		return false
	}
	target, _, _, ok := gistTarget(episodicMemory, strength, to)
	next := int(episodicMemory.SemanticStage) + 1
	return ok && target >= next && stagePresent(episodicMemory.SemanticStagesPresent, next)
}

func stagePresent(present uint32, stage int) bool {
	return stage >= 1 && present&(1<<(stage-1)) != 0
}

// advanceGistStage rises one memory's gist stage by the whole units its timer crossed by `to`
// ([C1][C6]). Only stages whose pregenerated text exists are published: each gets one
// semanticized/system provenance row carrying that text and its stage identity, so 변천사
// stays continuous across a large jump (CC5, [R8a]) and never blank. A crossing
// beyond the readable prefix is returned as a PendingGistRise — the visible stage stays put
// and the semanticize completion materializes it later. The crossed units are consumed from
// the anchor either way (the rise HAPPENED; only its publication waits for text), so rise
// math counts from max(visible, pending) with the moved anchor. No LLM call happens here
// ([C7]); the missing text is the caller's repair pass to re-enqueue. texts is nil when the
// first crossed rung has no text, in which case nothing is publishable.
func (c Consolidator) advanceGistStage(episodicMemory *ConsolidationMemory, texts *ConsolidationTexts, strength float64, to time.Time) (*StageAdvance, *PendingGistRise, []MemoryProvenance) {
	targetStage, anchor, units, ok := gistTarget(episodicMemory, strength, to)
	if !ok {
		return nil, nil, nil
	}
	currentStage := int(episodicMemory.SemanticStage)

	// A memory already pending publishes nothing here — its stages materialize once, in the
	// completion transaction. This crossing only extends the pending target.
	readableStage := currentStage
	if episodicMemory.PendingSemanticStage == nil && texts != nil {
		for stage := currentStage + 1; stage <= targetStage; stage++ {
			if stageText(texts.SemanticStages, stage) == "" {
				break
			}
			readableStage = stage
		}
	}

	published := make([]MemoryProvenance, 0, readableStage-currentStage)
	for stage := currentStage + 1; stage <= readableStage; stage++ {
		stageID := int16(stage)
		published = append(published, MemoryProvenance{
			ID:               c.newID(),
			EpisodicMemoryID: episodicMemory.ID,
			Kind:             ProvenanceKindSemanticized,
			Source:           ProvenanceSourceSystem,
			Text:             stageText(texts.SemanticStages, stage),
			UniverseTime:     to,
			SemanticStage:    &stageID,
		})
	}

	advance := &StageAdvance{
		MemoryID:     episodicMemory.ID,
		Stage:        int16(readableStage),
		TimerResetAt: ConsumeGistUnits(anchor, units, episodicMemory.Arousal, strength),
	}
	var pending *PendingGistRise
	if targetStage > readableStage {
		pending = &PendingGistRise{
			MemoryID: episodicMemory.ID,
			Stage:    int16(targetStage),
			RiseAt:   to,
		}
	}
	return advance, pending, published
}

// stageText returns a stage's pregenerated ladder text, "" when the ladder (or that rung)
// is missing. Whitespace-only counts as missing — the provenance guard refuses blank text,
// so publishing such a rung would abort the whole advance transaction instead of deferring.
func stageText(stages *SemanticStages, stage int) string {
	if stages == nil || stage < 1 || stage > len(stages) {
		return ""
	}
	if strings.TrimSpace(stages[stage-1]) == "" {
		return ""
	}
	return stages[stage-1]
}

// missingStageText reports whether any RISEN stage (1..risenStage) lacks its pregenerated
// text — the [C7] "remaining stage genuinely missing" condition for the semanticize re-enqueue
// (no ladder counts as all-missing: the launch generation never landed). Fetched texts decide
// when present; otherwise the projection's presence bits do.
func missingStageText(episodicMemory *ConsolidationMemory, texts *ConsolidationTexts, risenStage int) bool {
	for stage := 1; stage <= risenStage && stage <= semanticMaxStage; stage++ {
		if texts != nil {
			if stageText(texts.SemanticStages, stage) == "" {
				return true
			}
			continue
		}
		if !stagePresent(episodicMemory.SemanticStagesPresent, stage) {
			return true
		}
	}
	return false
}

// enqueueSemanticizeRegens re-enqueues the stage-text generation for memories whose risen stage has
// no text ([C7], A9): the worker regenerates the set from current_text and keeps the leading
// already-present texts (a risen gist stage is a thing that happened).
//
// A job already pending or running for the same revision will write the same texts, so the pass
// enqueues nothing more for it: otherwise every advance during a backlog or provider outage would
// stack another paid generation per memory. Once that job ends, a still-missing text is enqueued again.
func (c Consolidator) enqueueSemanticizeRegens(ctx context.Context, scope platform.UserScope, tx ConsolidateTx, targets []jobqueue.Target) error {
	if len(targets) == 0 {
		return nil
	}
	active, err := tx.ActiveTargetIDs(ctx, scope, JobKindSemanticize, targets)
	if err != nil {
		return err
	}
	covered := make(map[string]struct{}, len(active))
	for _, id := range active {
		covered[id] = struct{}{}
	}
	jobs := make([]jobqueue.Record, 0, len(targets))
	for _, target := range targets {
		if _, ok := covered[target.ID]; ok {
			continue
		}
		jobs = append(jobs, jobqueue.Record{
			ID:      c.newID(),
			UserID:  scope.UserID(),
			Kind:    JobKindSemanticize,
			Status:  jobqueue.StatusPending,
			Targets: []jobqueue.Target{target},
		})
	}
	for start := 0; start < len(jobs); start += values.PersistenceGraphWriteBatchSize {
		end := min(start+values.PersistenceGraphWriteBatchSize, len(jobs))
		if err := tx.EnqueueJobs(ctx, scope, jobs[start:end]); err != nil {
			return err
		}
	}
	return nil
}

// decayStages is the forgetting-stage pair the interval crossed: previous vs target DecayStage over
// [from, to] with the same anchors and constants the read path uses.
func decayStages(episodicMemory *ConsolidationMemory, strength float64, from time.Time, to time.Time) (previous int, target int) {
	arousal := episodicMemory.Arousal
	previous = DecayStage(EffectiveElapsedDays(from, episodicMemory.LastRecalledUniverseTime, episodicMemory.CreatedUniverseTime, episodicMemory.ForgettingOffsetDays), arousal, strength)
	target = DecayStage(EffectiveElapsedDays(to, episodicMemory.LastRecalledUniverseTime, episodicMemory.CreatedUniverseTime, episodicMemory.ForgettingOffsetDays), arousal, strength)
	return previous, target
}

// needsDecayFill reports whether the interval crossed a forgetting stage the stored texts do not
// already cover: a stored array without holes that reaches the target needs nothing written.
func needsDecayFill(episodicMemory *ConsolidationMemory, strength float64, from time.Time, to time.Time) bool {
	previous, target := decayStages(episodicMemory, strength, from, to)
	if target <= previous {
		return false
	}
	complete := episodicMemory.DecayStagesFilled == episodicMemory.DecayStageCount
	return !complete || episodicMemory.DecayStageCount < target
}

// newlyReachedDecayFill builds the deterministic word-loss texts for the forgetting stages the
// interval crossed ([F1][R8a]), so stored stage texts and the read-time stage always agree.
// Brightness and the current stage remain read-time derived — nothing here stores a tick (A4).
// Every missing slot up to the target is filled (an empty placeholder would render as an empty
// text on the client), and existing strings are never overwritten, which also keeps re-runs
// byte-identical after a reconsolidation changed current_text.
func newlyReachedDecayFill(episodicMemory *ConsolidationMemory, texts *ConsolidationTexts, strength float64, from time.Time, to time.Time) (DecayStageFill, bool) {
	if texts == nil || !needsDecayFill(episodicMemory, strength, from, to) {
		return DecayStageFill{}, false
	}
	_, target := decayStages(episodicMemory, strength, from, to)
	merged, changed := mergeDecayStageTexts(texts.DecayStages, texts.CurrentText, target, seedOrZero(texts.Seed))
	if !changed {
		return DecayStageFill{}, false
	}
	return DecayStageFill{MemoryID: episodicMemory.ID, Stages: merged}, true
}

// mergeDecayStageTexts fills every missing decay-stage slot 1..targetStage with the
// deterministic DecayStageText, never touching an existing entry and never shrinking the
// stored array. Reports whether anything was filled.
func mergeDecayStageTexts(existing []string, currentText string, targetStage int, seed int64) ([]string, bool) {
	length := targetStage
	if len(existing) > length {
		length = len(existing)
	}
	merged := make([]string, length)
	copy(merged, existing)
	changed := false
	for stage := 1; stage <= targetStage; stage++ {
		if merged[stage-1] != "" {
			continue
		}
		merged[stage-1] = DecayStageText(currentText, stage, seed)
		changed = true
	}
	return merged, changed
}

// markReplaySet marks the interval's replay set for the read-time companion re-layout
// ([C2]): the stage-advanced memories plus their shared-neuron neighbors within
// consolidation.replay_neighbor_hops. The marker is the existing activation state — the
// replay set's synapses get last_activated_universe_time touched to the advance time,
// exactly the trace a recall's reinforcement leaves — so the read (the synapse strength
// fade / effective strength) sees the replay without any stored coordinate ([I5]). Bounded
// by the hop value: the whole universe is never marked. Returns the replay set's neurons
// (the re-embed set).
func (c Consolidator) markReplaySet(ctx context.Context, scope platform.UserScope, tx ConsolidateTx, advancedIDs []string, to time.Time) ([]ExistingNeuron, error) {
	if len(advancedIDs) == 0 {
		return nil, nil
	}
	memoryIDs := uniqueSorted(advancedIDs)
	neurons, err := tx.ReplaySetNeurons(ctx, scope, memoryIDs)
	if err != nil {
		return nil, err
	}
	for hop := 0; hop < values.ConsolidationReplayNeighborHops; hop++ {
		if len(neurons) == 0 {
			break
		}
		neighborIDs, err := tx.MemoriesActivatingNeurons(ctx, scope, neuronIDsOf(neurons))
		if err != nil {
			return nil, err
		}
		expanded := uniqueSorted(append(memoryIDs, neighborIDs...))
		if len(expanded) == len(memoryIDs) {
			break
		}
		memoryIDs = expanded
		neurons, err = tx.ReplaySetNeurons(ctx, scope, memoryIDs)
		if err != nil {
			return nil, err
		}
	}
	if len(neurons) == 0 {
		return nil, nil
	}
	if err := tx.TouchReplaySetSynapses(ctx, scope, neuronIDsOf(neurons), to); err != nil {
		return nil, err
	}
	return neurons, nil
}

// downscaleSynapses applies the pure Downscale to the user's slept synapses as one scoped
// batch ([C4]): read the stored bases of the edges last activated before `to` (an edge
// linked in this very launch transaction, or otherwise activated at the advance target,
// did not sleep — leaving it in would weaken a synapse the interval never contained),
// renormalize in the domain, write the changed rows. Nothing is inserted or deleted, and
// edges the floor already holds are skipped (A6).
func (c Consolidator) downscaleSynapses(ctx context.Context, scope platform.UserScope, tx ConsolidateTx, to time.Time) error {
	strengths, err := tx.ListSynapseStrengths(ctx, scope, to)
	if err != nil {
		return err
	}
	updates := make([]SynapseStrength, 0, len(strengths))
	for _, synapse := range strengths {
		next := Downscale(synapse.Strength, values.ConsolidationDownscaleFactor)
		// "Unchanged" is judged on the float32 grid the strength column stores: the stored
		// base came back widened from real, so a float64 compare would keep rewriting
		// byte-identical rows forever once an edge reaches the floor.
		if float32(next) == float32(synapse.Strength) {
			continue
		}
		updates = append(updates, SynapseStrength{SynapseID: synapse.SynapseID, Strength: next})
	}
	if len(updates) == 0 {
		return nil
	}
	return tx.ApplySynapseDownscale(ctx, scope, updates)
}

func (c Consolidator) enqueueConsolidateJob(ctx context.Context, scope platform.UserScope, tx ConsolidateTx, neurons []ExistingNeuron) error {
	targets := make([]jobqueue.Target, 0, len(neurons))
	for _, neuron := range neurons {
		targets = append(targets, jobqueue.Target{Kind: jobqueue.TargetNeuron, ID: neuron.ID, ExpectedRevision: neuron.RepresentationRevision})
	}
	return enqueueJob(ctx, tx, scope, c.newID(), time.Time{}, JobKindConsolidate, ConsolidateJobPayload{}, targets...)
}

func neuronIDsOf(neurons []ExistingNeuron) []string {
	ids := make([]string, 0, len(neurons))
	for _, neuron := range neurons {
		ids = append(ids, neuron.ID)
	}
	return ids
}

func memoryIDsOf(advances []StageAdvance) []string {
	ids := make([]string, 0, len(advances))
	for _, advance := range advances {
		ids = append(ids, advance.MemoryID)
	}
	return ids
}

// uniqueSorted is the deterministic set form of an id list: link.go's dedup plus a sort, so
// batch queries and payloads read the same regardless of arrival order.
func uniqueSorted(ids []string) []string {
	out := dedupIDs(ids)
	sort.Strings(out)
	return out
}
