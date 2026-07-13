package memory

import (
	"context"
	"errors"
	"sort"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// Consolidation (우주의 잠, [C1][C2][C4][T4]) is what happens while the universe clock jumps:
// the Consolidator is the production AdvanceProgression binding.
// Fired inside the same advance transaction as launch and sync-to-today, it advances the gist
// stages whose semanticize timer crossed ([C6]), persists newly reached forgetting-stage texts
// ([F1][R8a]), marks the replayed constellations for the read-time companion re-layout ([C2]),
// homeostatically Downscales the user's synapses (SHY, [C4][I9]), and enqueues the interval's
// heavy work on the worker ([C7]). There is no cron and no RPC — the advance hook is the sole
// trigger, and consolidation is never a user action ([T4]).

// ErrConsolidateTxRequired is returned when the advance transaction handed to the hook cannot
// be upgraded to the consolidation write surface — a mis-wired composition root, never a
// runtime condition (the pg transaction store implements ConsolidateTx).
var ErrConsolidateTxRequired = errors.New("advance progression tx does not support consolidation")

// StageAdvance is one memory's gist rise over the advance interval: the risen stage and the
// consumed timer anchor. Persisting the consumed anchor is what makes Consolidate convergent —
// the next advance counts only the residual days, so an already-consolidated interval implies
// zero further units (A10). The anchor only ever moves forward ([I10]).
type StageAdvance struct {
	MemoryID     string
	Stage        int16
	TimerResetAt time.Time
}

// SynapseStrength is one synapse's stored base strength — the Downscale batch reads and
// writes this same shape (the pure Downscale fn stays the source of truth; the store only
// writes the computed value).
type SynapseStrength struct {
	SynapseID string
	Strength  float64
}

// ConsolidateTx is the consolidation write surface, consumer-owned here (§2.4). The advance
// hook hands the handler plan 30's ProgressionTx — that port signature is unchanged — and the
// handler upgrades it to this surface via a type assertion; the pg transaction store
// implements both, so the upgrade is a wiring fact, not a runtime gamble. Like LaunchTx and
// RecallTx it exposes NO Diary write and NO delete of any kind, so the consolidation path
// cannot express an [I1]/[I2] violation. Method names match the memory/pg concrete.
type ConsolidateTx interface {
	ProgressionTx
	MemoryProvenanceStore
	// ListMemoriesForConsolidation returns the user's non-deleted memories with the
	// stage/timer/decay anchors the interval math reads.
	ListMemoriesForConsolidation(ctx context.Context, scope platform.UserScope) ([]EpisodicMemory, error)
	// RecallMemberNeurons returns a memory's live member neurons — reused here as the
	// semanticize re-enqueue payload inputs (the same concrete the recall path uses).
	RecallMemberNeurons(ctx context.Context, scope platform.UserScope, memoryID string) ([]ExistingNeuron, error)
	// ApplyStageAdvances persists the risen stages + consumed timer anchors in one batch.
	// The stage write is GREATEST-guarded in SQL — a stage never decrements ([C7]).
	ApplyStageAdvances(ctx context.Context, scope platform.UserScope, advances []StageAdvance) error
	// FillDecayStages replaces a memory's stored decay-stage text array with the merged
	// array the caller built. The caller merges (existing entries are never overwritten);
	// the per-user advisory lock serializes the read-merge-write.
	FillDecayStages(ctx context.Context, scope platform.UserScope, memoryID string, stages []string) error
	// ConstellationNeurons returns the live neurons activated by the given memories.
	ConstellationNeurons(ctx context.Context, scope platform.UserScope, memoryIDs []string) ([]ExistingNeuron, error)
	// MemoriesActivatingNeurons returns the non-deleted memories activating any of the
	// given neurons — the shared-neuron neighbor expansion ([C2]).
	MemoriesActivatingNeurons(ctx context.Context, scope platform.UserScope, neuronIDs []string) ([]string, error)
	// TouchConstellationSynapses moves last_activated_universe_time forward to the advance
	// time for every synapse with BOTH endpoints in the constellation — the replay marker
	// the read consumes ([C2]); no coordinate is ever stored ([I5]).
	TouchConstellationSynapses(ctx context.Context, scope platform.UserScope, neuronIDs []string, universeTime time.Time) error
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
// entirely through plan 30's port: the signature, the launch/sync call sites, and the
// no-op-on-held-clock guarantee belong to that seam, and this handler must never require
// widening it (its extra write surface comes from the ConsolidateTx upgrade instead).
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
	consolidateTx, ok := tx.(ConsolidateTx)
	if !ok {
		return ErrConsolidateTxRequired
	}
	return c.consolidate(ctx, scope, consolidateTx, *from, to)
}

func (c Consolidator) consolidate(ctx context.Context, scope platform.UserScope, tx ConsolidateTx, from time.Time, to time.Time) error {
	memories, err := tx.ListMemoriesForConsolidation(ctx, scope)
	if err != nil {
		return err
	}

	advances := make([]StageAdvance, 0)
	for i := range memories {
		episodicMemory := &memories[i]
		strength := EffectiveStrength(episodicMemory.BaseStrength, episodicMemory.RecallCount)

		risen, err := c.advanceGistStage(ctx, scope, tx, episodicMemory, strength, to)
		if err != nil {
			return err
		}
		reachedStage := int(episodicMemory.SemanticStage)
		if risen != nil {
			advances = append(advances, *risen)
			reachedStage = int(risen.Stage)
		}
		// Repair pass ([C7], A9): a risen stage whose pregenerated text never landed (a
		// dead semanticize job) would otherwise stay unviewable forever — a memory at the
		// ceiling crosses no further boundary, so the check cannot live on the rise alone.
		if reachedStage >= 1 && missingStageText(episodicMemory.SemanticStages, reachedStage) {
			if err := c.enqueueSemanticizeRegen(ctx, scope, tx, episodicMemory); err != nil {
				return err
			}
		}

		if err := c.fillNewlyReachedDecayStages(ctx, scope, tx, episodicMemory, strength, from, to); err != nil {
			return err
		}
	}
	if len(advances) > 0 {
		if err := tx.ApplyStageAdvances(ctx, scope, advances); err != nil {
			return err
		}
	}

	// Downscale runs BEFORE the replay marker refreshes activation recency: the slept-edge
	// filter (activated before `to`) must still see the constellation's pre-replay state, or
	// the touched edges would skip the very sleep that replayed them.
	if err := c.downscaleSynapses(ctx, scope, tx, to); err != nil {
		return err
	}

	replayNeurons, err := c.markReplayedConstellations(ctx, scope, tx, memoryIDsOf(advances), to)
	if err != nil {
		return err
	}

	// Interval-implied heavy work leaves the transaction ([C7], §2.8): the replayed
	// constellation's neurons re-embed on the worker, never inline.
	if len(advances) > 0 && len(replayNeurons) > 0 {
		if err := c.enqueueConsolidateJob(ctx, scope, tx, from, to, memoryIDsOf(advances), replayNeurons); err != nil {
			return err
		}
	}
	return nil
}

// advanceGistStage rises one memory's gist stage by the whole units its timer crossed by `to`
// ([C1][C6]) and appends one semanticized/system provenance row per crossed stage so 변천사
// stays continuous across a large jump (CC5, [R8a]). The stage texts are pregenerated — no
// LLM call happens here ([C7]); a missing text is the caller's repair pass to re-enqueue.
// Returns nil when nothing rose.
func (c Consolidator) advanceGistStage(ctx context.Context, scope platform.UserScope, tx ConsolidateTx, episodicMemory *EpisodicMemory, strength float64, to time.Time) (*StageAdvance, error) {
	currentStage := int(episodicMemory.SemanticStage)
	if currentStage >= semanticMaxStage {
		return nil, nil
	}
	// The gist-timer anchor: recall/reconsolidation resets it; a never-recalled memory
	// counts from its creation (plan 40's launch semantics for the NULL column).
	anchor := episodicMemory.CreatedUniverseTime
	if episodicMemory.SemanticizeTimerResetAt != nil {
		anchor = *episodicMemory.SemanticizeTimerResetAt
	}
	units := GistUnitsElapsed(to, anchor, episodicMemory.Emotion.Arousal, strength)
	if units <= 0 {
		return nil, nil
	}
	risenStage := Semanticize(currentStage, units)

	for stage := currentStage + 1; stage <= risenStage; stage++ {
		// The risen stage's pregenerated text; empty when the stage set is still
		// pending/missing — the re-enqueue below regenerates it, and the 변천사 row
		// still anchors the rise event itself.
		text := ""
		if episodicMemory.SemanticStages != nil {
			text = episodicMemory.SemanticStages[stage-1]
		}
		if err := tx.AppendMemoryProvenance(ctx, scope, MemoryProvenance{
			ID:               c.newID(),
			EpisodicMemoryID: episodicMemory.ID,
			Kind:             ProvenanceKindSemanticized,
			Source:           ProvenanceSourceSystem,
			Text:             text,
			UniverseTime:     to,
		}); err != nil {
			return nil, err
		}
	}

	return &StageAdvance{
		MemoryID:     episodicMemory.ID,
		Stage:        int16(risenStage),
		TimerResetAt: ConsumeGistUnits(anchor, units, episodicMemory.Emotion.Arousal, strength),
	}, nil
}

// missingStageText reports whether any RISEN stage (1..risenStage) lacks its pregenerated
// text — the [C7] "remaining stage genuinely missing" condition for the semanticize re-enqueue
// (a nil set counts as all-missing: the launch generation never landed).
func missingStageText(stages *SemanticStages, risenStage int) bool {
	if stages == nil {
		return true
	}
	for stage := 1; stage <= risenStage && stage <= len(stages); stage++ {
		if stages[stage-1] == "" {
			return true
		}
	}
	return false
}

// enqueueSemanticizeRegen re-enqueues the stage-text generation for a memory whose risen
// stage has no text ([C7], A9): the worker regenerates the set from current_text and keeps
// the leading already-present texts (a risen gist stage is a thing that happened).
func (c Consolidator) enqueueSemanticizeRegen(ctx context.Context, scope platform.UserScope, tx ConsolidateTx, episodicMemory *EpisodicMemory) error {
	neurons, err := tx.RecallMemberNeurons(ctx, scope, episodicMemory.ID)
	if err != nil {
		return err
	}
	keep := int16(0)
	if episodicMemory.SemanticStages != nil {
		for _, text := range episodicMemory.SemanticStages {
			if text == "" {
				break
			}
			keep++
		}
	}
	return enqueueJob(ctx, tx, scope, c.newID(), time.Time{}, JobKindSemanticize, SemanticizeJobPayload{
		MemoryID:    episodicMemory.ID,
		Name:        episodicMemory.Name,
		CurrentText: episodicMemory.CurrentText,
		Mood:        episodicMemory.Emotion.Mood,
		Neurons:     semanticJobNeurons(neurons),
		KeepStages:  keep,
		KeptStages:  episodicMemory.SemanticStages,
	})
}

// fillNewlyReachedDecayStages persists the deterministic word-loss texts for the forgetting
// stages the interval crossed ([F1][R8a]): previous vs target DecayStage over [from, to] with
// the same anchors and constants the read path uses, so stored stage texts and the read-time
// stage always agree. Brightness and the current stage remain read-time derived — nothing here
// stores a tick (A4). Every missing slot up to the target is filled (an empty placeholder
// would render as an empty text on the client), and existing strings are never overwritten,
// which also keeps re-runs byte-identical after a reconsolidation changed current_text.
func (c Consolidator) fillNewlyReachedDecayStages(ctx context.Context, scope platform.UserScope, tx ConsolidateTx, episodicMemory *EpisodicMemory, strength float64, from time.Time, to time.Time) error {
	arousal := episodicMemory.Emotion.Arousal
	previousStage := DecayStage(EffectiveElapsedDays(from, episodicMemory.LastRecalledUniverseTime, episodicMemory.CreatedUniverseTime, episodicMemory.ForgettingOffsetDays), arousal, strength)
	targetStage := DecayStage(EffectiveElapsedDays(to, episodicMemory.LastRecalledUniverseTime, episodicMemory.CreatedUniverseTime, episodicMemory.ForgettingOffsetDays), arousal, strength)
	if targetStage <= previousStage {
		return nil
	}
	merged, changed := mergeDecayStageTexts(episodicMemory.DecayStages, episodicMemory.CurrentText, targetStage, seedOrZero(episodicMemory.Seed))
	if !changed {
		return nil
	}
	return tx.FillDecayStages(ctx, scope, episodicMemory.ID, merged)
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

// markReplayedConstellations marks the interval's replayed set for the read-time companion
// re-layout ([C2]): the stage-advanced memories plus their shared-neuron neighbors within
// consolidation.replay_neighbor_hops. The marker is the existing activation state — the
// constellation's synapses get last_activated_universe_time touched to the advance time,
// exactly the trace a recall's reinforcement leaves — so the read (filament fade, effective
// strength) sees the replay without any stored coordinate ([I5]). Bounded by the hop value:
// the whole universe is never marked. Returns the constellation's neurons (the re-embed set).
func (c Consolidator) markReplayedConstellations(ctx context.Context, scope platform.UserScope, tx ConsolidateTx, advancedIDs []string, to time.Time) ([]ExistingNeuron, error) {
	if len(advancedIDs) == 0 {
		return nil, nil
	}
	memoryIDs := uniqueSorted(advancedIDs)
	neurons, err := tx.ConstellationNeurons(ctx, scope, memoryIDs)
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
		neurons, err = tx.ConstellationNeurons(ctx, scope, memoryIDs)
		if err != nil {
			return nil, err
		}
	}
	if len(neurons) == 0 {
		return nil, nil
	}
	if err := tx.TouchConstellationSynapses(ctx, scope, neuronIDsOf(neurons), to); err != nil {
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

func (c Consolidator) enqueueConsolidateJob(ctx context.Context, scope platform.UserScope, tx ConsolidateTx, from time.Time, to time.Time, advancedIDs []string, neurons []ExistingNeuron) error {
	payload := ConsolidateJobPayload{
		FromUniverseTime: utcDate(from).Format(time.DateOnly),
		ToUniverseTime:   utcDate(to).Format(time.DateOnly),
		MemoryIDs:        uniqueSorted(advancedIDs),
		NeuronIDs:        uniqueSorted(neuronIDsOf(neurons)),
	}
	return enqueueJob(ctx, tx, scope, c.newID(), time.Time{}, JobKindConsolidate, payload)
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
