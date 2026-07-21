package memory

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// Recall use-case ([R1]–[R7]) — the backend orchestration of 회고하기. Recalling a memory
// always Reinforces it (brighter, slightly larger, gist timer reset, neighbors nudged);
// only a genuine prediction error — the rewrite differs in MEANING from the current text —
// Reconsolidates it (rewrite current_text, reshape the seed, regenerate the remaining
// stage texts). Recall writes ANCHORS, not pixels: the visible brightness/decay/gist
// recovery is produced by the forgetting/consolidation read-time functions that read these
// anchors (§CC1). The Diary is never written ([I2][R7]).

var (
	// ErrRecallInputRequired rejects an empty memory/diary id or (for Recall) an empty
	// rewrite — a Recall is a rewrite, a no-rewrite whole-diary recall is RecallDiaryStars.
	ErrRecallInputRequired = errors.New("recall requires a target id and a rewrite")
	// ErrRecallMemoryNotFound is returned when the target is not the caller's or does not
	// exist; ErrRecallMemoryUnavailable when it is soft-deleted ([R1]).
	ErrRecallMemoryNotFound    = errors.New("recall target memory not found")
	ErrRecallMemoryUnavailable = errors.New("recall target memory is unavailable")
)

// AllowAllSpendGate is the economy-less SpendGate binding: it permits every action and
// charges nothing, so the recall loop composes without the economy (tests, minimal
// roots). cmd/api binds the real balance-check + deduct in its place (§CC2). Mirrors
// NoopAdvanceProgression's stance — a deliberate no-op, not a missing binding.
type AllowAllSpendGate struct{}

func (AllowAllSpendGate) CheckAndSpend(context.Context, platform.UserScope, EconomyTx, SpendIntent) error {
	return nil
}

// recallAccessibilitySignal derives the spend-time accessibility cost weight ([F4])
// the recall SpendIntent carries: the same read-time forgetting chain the render
// path uses (offset-inclusive elapsed → decay depth → convex weight), evaluated at
// the post-sync universe time — so the gate prices exactly the decay state the user
// is recalling out of. A signal, never a price ([CC3]: pricing lives in the economy).
func recallAccessibilitySignal(anchor DiaryRecallAnchor, universeTime time.Time) float64 {
	elapsed := EffectiveElapsedDays(universeTime, anchor.LastRecalledUniverseTime,
		anchor.CreatedUniverseTime, anchor.ForgettingOffsetDays)
	strength := EffectiveStrength(anchor.BaseStrength, anchor.RecallCount)
	return AccessibilityCostWeight(DecayDepth(elapsed, anchor.Arousal, strength))
}

// recallAnchorOf projects a loaded memory onto its accessibility anchors — the
// single-target recall's view of the same scalars the diary batch reads directly.
func recallAnchorOf(episodicMemory EpisodicMemory) DiaryRecallAnchor {
	return DiaryRecallAnchor{
		EpisodicMemoryID:         episodicMemory.ID,
		Arousal:                  episodicMemory.Emotion.Arousal,
		BaseStrength:             episodicMemory.BaseStrength,
		RecallCount:              episodicMemory.RecallCount,
		CreatedUniverseTime:      episodicMemory.CreatedUniverseTime,
		LastRecalledUniverseTime: episodicMemory.LastRecalledUniverseTime,
		ForgettingOffsetDays:     episodicMemory.ForgettingOffsetDays,
	}
}

// RecallResult is Recall's optimistic return (§2.8): the branch taken plus the memory's
// re-render inputs (current_text/seed unchanged on reinforce-only, new on
// reconsolidation) and the sync interval the acceleration replay plays over ([T2]).
// Regenerated stage texts fill on the next read.
type RecallResult struct {
	Reconsolidated    bool
	CurrentText       string
	Seed              int64
	RecallCount       int32
	EffectiveStrength float64
	Sync              SyncResult
}

// RecallDiaryStarsResult is the whole-diary recall's return ([D3]): the affected
// still-live memory ids plus the sync interval, so the UI animates after the write.
type RecallDiaryStarsResult struct {
	DiaryID           string
	EpisodicMemoryIDs []string
	Sync              SyncResult
}

// Recall is the 회고하기 orchestration. The whole sequence is ONE transaction so sync +
// spend + anchors + reinforce + (reconsolidate) + provenance land wholly or not at all;
// the Diary is never in that write set ([I2][R7]).
//
// The prediction-error LLM compare runs INSIDE the transaction on purpose: the spend must
// gate it (an unaffordable recall never pays for the compare — §CC2) and the spend +
// reinforce must be atomic, which forces the compare between them. That is safe here — the
// per-user graph-mutation lock serializes a user's writes (a user cannot launch while recalling),
// the compare is metered + cached + keyless-mock-deterministic, and any compare error rolls
// the whole recall back, charging and resetting nothing.
func (s *Service) Recall(ctx context.Context, scope platform.UserScope, memoryID string, rewriteText string) (RecallResult, error) {
	if scope.UserID() == "" {
		return RecallResult{}, ErrScopeRequired
	}
	rewriteText = strings.TrimSpace(rewriteText)
	if memoryID == "" || rewriteText == "" {
		return RecallResult{}, ErrRecallInputRequired
	}

	var result RecallResult
	err := s.recalls.InRecallTx(ctx, func(tx RecallTx) error {
		// 1. Sync the clock to today — recall lands on today's clock ([R1a]); the
		// consent gate is the UI's. universeTime below is the post-sync clock.
		sync, err := s.syncToToday(ctx, scope, tx)
		if err != nil {
			return err
		}
		// 2. Load the memory; a soft-deleted target is unavailable ([R1]). The load
		// precedes the spend so a not-found target never charges — and the spend
		// intent's depth signal is derived from this loaded state.
		memory, err := tx.EpisodicMemoryForRecall(ctx, scope, memoryID)
		if err != nil {
			return err
		}
		if memory.DeletedAt != nil {
			return ErrRecallMemoryUnavailable
		}
		// 3. Spend Twinkle for the recall: the intent carries the post-sync
		// accessibility signal and joins this transaction, so a denial aborts the
		// whole recall, resetting and charging nothing (§CC2).
		if err := s.spendGate.CheckAndSpend(ctx, scope, tx, RecallSpendIntent(memoryID, recallAccessibilitySignal(recallAnchorOf(memory), sync.Current))); err != nil {
			return err
		}
		// 4. Prediction-error judgement — an LLM semantic compare of content ([R6]).
		differs, err := s.predictionError.Differs(ctx, memory.CurrentText, rewriteText)
		if err != nil {
			return err
		}
		// 5. Reinforce on either branch ([R2][R3][R5][F5]).
		effects, err := s.reinforce(ctx, scope, tx, memoryID, sync.Current)
		if err != nil {
			return err
		}
		result = RecallResult{
			CurrentText:       memory.CurrentText,
			Seed:              seedOrZero(memory.Seed),
			RecallCount:       effects.RecallCount,
			EffectiveStrength: effects.EffectiveStrength,
			Sync:              sync,
		}
		// 6. Branch: no error → reinforce only ([R4]); error → reconsolidate ([R6]).
		if !differs {
			return nil
		}
		newSeed, err := s.reconsolidate(ctx, scope, tx, memory, rewriteText, sync.Current)
		if err != nil {
			return err
		}
		result.Reconsolidated = true
		result.CurrentText = rewriteText
		result.Seed = newSeed
		return nil
	})
	if err != nil {
		return RecallResult{}, err
	}
	return result, nil
}

// RecallDiaryStars is the no-rewrite whole-diary recall ([D3]): after UI consent, sync,
// spend the recall of each still-live memory born from the diary, and Reinforce each — in
// ONE transaction. It never calls PredictionError or Reconsolidate, writes no current_text,
// and changes no seed ([R4][R6][I8]).
func (s *Service) RecallDiaryStars(ctx context.Context, scope platform.UserScope, diaryID string) (RecallDiaryStarsResult, error) {
	if scope.UserID() == "" {
		return RecallDiaryStarsResult{}, ErrScopeRequired
	}
	if diaryID == "" {
		return RecallDiaryStarsResult{}, ErrRecallInputRequired
	}

	var result RecallDiaryStarsResult
	err := s.recalls.InRecallTx(ctx, func(tx RecallTx) error {
		sync, err := s.syncToToday(ctx, scope, tx)
		if err != nil {
			return err
		}
		anchors, err := tx.LiveDiaryRecallAnchors(ctx, scope, diaryID)
		if err != nil {
			return err
		}
		// Spend first, for EVERY memory, from the one pre-recall anchor snapshot:
		// each SpendIntent targets one memory and carries that memory's own
		// accessibility signal, so the diary's cost is the sum of the per-memory
		// recalls ([D3]) — priced exactly as the diary quote priced it (a reinforce
		// nudges neighbor offsets, so pricing after reinforcing a sibling would
		// drift from the quote). A denial aborts the whole transaction — atomic,
		// resets nothing.
		ids := make([]string, 0, len(anchors))
		for _, anchor := range anchors {
			ids = append(ids, anchor.EpisodicMemoryID)
			if err := s.spendGate.CheckAndSpend(ctx, scope, tx, RecallSpendIntent(anchor.EpisodicMemoryID, recallAccessibilitySignal(anchor, sync.Current))); err != nil {
				return err
			}
		}
		for _, id := range ids {
			if _, err := s.reinforce(ctx, scope, tx, id, sync.Current); err != nil {
				return err
			}
		}
		result = RecallDiaryStarsResult{DiaryID: diaryID, EpisodicMemoryIDs: ids, Sync: sync}
		return nil
	})
	if err != nil {
		return RecallDiaryStarsResult{}, err
	}
	return result, nil
}

// reinforceEffects is what Reinforce hands back for Recall's response: the incremented
// recall count and the bumped read-time EffectiveStrength.
type reinforceEffects struct {
	RecallCount       int32
	EffectiveStrength float64
}

// reinforce is the idempotent recall-effects bundle applied on EVERY recall (both
// branches, and per memory in the whole-diary jump [D3]): (1) reset the anchors
// (last_recalled, recall_count += 1, gist-timer), (2) batch-LTP the co-activated synapses,
// (3) bump EffectiveStrength (size), (4) nudge NEIGHBOR forgetting offsets ([R5]). It is a
// batch use-case distinct from the Potentiate primitive it calls, idempotent per recall
// event (one pass over the edge set; a rolled-back attempt leaves no trace), and touches no
// memory↔memory edge — only neuron↔neuron synapses ([I4][I6][I9]). The recalled memory takes
// no self-offset; it recovers wholly ([F5]).
func (s *Service) reinforce(ctx context.Context, scope platform.UserScope, tx RecallTx, memoryID string, universeTime time.Time) (reinforceEffects, error) {
	anchors, err := tx.ResetRecallAnchors(ctx, scope, memoryID, universeTime)
	if err != nil {
		return reinforceEffects{}, err
	}

	// Batch LTP ([R3]): Potentiate each co-activated synapse once toward the cap. The
	// upsert increments co_activation_count by the delta (1) and moves last_activated to
	// the recall's universe time; strength is written absolutely from Potentiate, so the
	// strength math stays in the pure domain (never re-derived in SQL).
	synapses, err := tx.RecallMemberSynapses(ctx, scope, memoryID)
	if err != nil {
		return reinforceEffects{}, err
	}
	for _, synapse := range synapses {
		next := Potentiate(float64(synapse.Strength), values.SynapsePotentiationRate)
		if _, err := tx.UpsertSynapse(ctx, scope, Synapse{
			ID:                        synapse.ID,
			NeuronAID:                 synapse.NeuronAID,
			NeuronBID:                 synapse.NeuronBID,
			Strength:                  float32(next),
			CoActivationCount:         1,
			LastActivatedUniverseTime: universeTime,
			CreatedAt:                 synapse.CreatedAt,
		}); err != nil {
			return reinforceEffects{}, err
		}
	}

	// Neighbor forgetting ± ([R5]): group neighbors by the signed delta their shared
	// SEMANTIC-neuron count maps to (via NeighborForgettingDelta) and apply each non-zero
	// group in one write. Deltas are applied in a stable (sorted) order so the effect is
	// deterministic regardless of map iteration.
	neighbors, err := tx.NeighborSharedSemanticCounts(ctx, scope, memoryID)
	if err != nil {
		return reinforceEffects{}, err
	}
	idsByDelta := map[float64][]string{}
	for _, neighbor := range neighbors {
		if delta := NeighborForgettingDelta(neighbor.SharedSemanticCount); delta != 0 {
			idsByDelta[delta] = append(idsByDelta[delta], neighbor.NeighborID)
		}
	}
	deltas := make([]float64, 0, len(idsByDelta))
	for delta := range idsByDelta {
		deltas = append(deltas, delta)
	}
	sort.Float64s(deltas)
	for _, delta := range deltas {
		if err := tx.AddForgettingOffset(ctx, scope, idsByDelta[delta], delta); err != nil {
			return reinforceEffects{}, err
		}
	}

	return reinforceEffects{
		RecallCount:       anchors.RecallCount,
		EffectiveStrength: EffectiveStrength(anchors.BaseStrength, anchors.RecallCount),
	}, nil
}

// reconsolidate applies the prediction-error-only deltas ([R6][C7]): rewrite current_text,
// reshape the seed to a fresh form ([V5]), enqueue regeneration of only the not-yet-risen
// stage texts on the new basis (keeping already-risen gist stages, [C7]), and append the
// reconsolidated/user provenance row. The anchors, LTP, strength bump, and neighbor ± have
// already run in reinforce. The Diary is untouched ([I2]). Returns the new seed.
func (s *Service) reconsolidate(ctx context.Context, scope platform.UserScope, tx RecallTx, memory EpisodicMemory, rewriteText string, universeTime time.Time) (int64, error) {
	// The use-case owns randomness so the domain stays pure: it mints the fresh entropy
	// and Reshape guarantees the returned seed differs from the current one ([V5]).
	newSeed := Reshape(seedOrZero(memory.Seed), s.newSeed())
	revision, err := tx.ApplyReconsolidatedText(ctx, scope, memory.ID, rewriteText, newSeed)
	if err != nil {
		return 0, err
	}

	// The identity-only job re-reads the current text, mood, live neurons, and already-risen
	// stages immediately before the external call. The revision returned by the rewrite is
	// its fence, so an older generation cannot publish over this representation.
	if err := s.enqueue(ctx, scope, tx, JobKindSemanticize, SemanticizeJobPayload{}, JobTarget{
		Kind: JobTargetMemory, ID: memory.ID, ExpectedRevision: revision,
	}); err != nil {
		return 0, err
	}

	// Append the append-only 변천사 row ([R8a]): the new representation text at this
	// universe-time. The created/original baseline is synthesized at read (§CC5).
	if err := tx.AppendMemoryProvenance(ctx, scope, MemoryProvenance{
		ID:               s.newID(),
		EpisodicMemoryID: memory.ID,
		Kind:             ProvenanceKindReconsolidated,
		Source:           ProvenanceSourceUser,
		Text:             rewriteText,
		UniverseTime:     universeTime,
	}); err != nil {
		return 0, err
	}
	return newSeed, nil
}

func seedOrZero(seed *int64) int64 {
	if seed == nil {
		return 0
	}
	return *seed
}
