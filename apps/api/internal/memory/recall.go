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
	// ErrRecallNoLiveMemories rejects a whole-diary recall that resolves to zero still-live
	// memories for the caller — an all-let-go/deleted diary or, crucially, another user's diary
	// (a foreign diary_id yields zero of the caller's anchors). Raised before the sync/spend/
	// receipt so nothing commits: no free clock advance, no cross-user receipt row ([D3][U1]).
	ErrRecallNoLiveMemories = errors.New("recall diary has no live memories for this user")
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
func (s *Service) Recall(ctx context.Context, scope platform.UserScope, operationID string, memoryID string, rewriteText string, syncConsent bool) (RecallResult, error) {
	if scope.UserID() == "" {
		return RecallResult{}, ErrScopeRequired
	}
	if strings.TrimSpace(operationID) == "" {
		return RecallResult{}, ErrOperationIDRequired
	}
	rewriteText = strings.TrimSpace(rewriteText)
	if memoryID == "" || rewriteText == "" {
		return RecallResult{}, ErrRecallInputRequired
	}
	fingerprint := recallFingerprint(memoryID, rewriteText)

	var result RecallResult
	err := s.recalls.InRecallTx(ctx, func(tx RecallTx) error {
		// 0. Serialize this user's paid actions and look up a matching receipt BEFORE any
		// work: concurrent duplicates queue on the lock, so the loser reads the winner's
		// committed receipt and replays it — no second spend, no second recall (A2/A3). A
		// same-id/different-input receipt is a conflict; an exact match replays the stored
		// response verbatim (before the consent gate, so a committed recall's retry never
		// spuriously demands consent).
		if err := tx.LockGraphMutation(ctx, scope); err != nil {
			return err
		}
		receipt, found, err := tx.GetPaidActionReceipt(ctx, scope, operationID)
		if err != nil {
			return err
		}
		response, replay, err := replayReceipt(receipt, found, PaidActionRecall, fingerprint)
		if err != nil {
			return err
		}
		if replay {
			return decodeReceiptResponse(response, &result)
		}
		// 1. Sync the clock to today — recall lands on today's clock ([R1a]). The consent is
		// server-enforced here: a sync that would advance the clock without consent is refused
		// before any spend (A1/A5). universeTime below is the post-sync clock.
		sync, err := s.syncToToday(ctx, scope, tx, syncConsent)
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
		// 3. Spend Twinkle for the recall: the intent carries the post-sync accessibility
		// signal + the operation id (its dedup key) and joins this transaction, so a denial
		// aborts the whole recall, resetting and charging nothing (§CC2).
		if err := s.spendGate.CheckAndSpend(ctx, scope, tx, RecallSpendIntent(operationID, memoryID, recallAccessibilitySignal(recallAnchorOf(memory), sync.Current))); err != nil {
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
		if differs {
			newSeed, err := s.reconsolidate(ctx, scope, tx, memory, rewriteText, sync.Current)
			if err != nil {
				return err
			}
			result.Reconsolidated = true
			result.CurrentText = rewriteText
			result.Seed = newSeed
		}
		// 7. Commit the receipt in the SAME transaction as the debit + effects (A3): a
		// response-loss retry of this operation id now replays `result` without redoing work.
		return s.writeReceipt(ctx, scope, tx, PaidActionReceipt{
			OperationID:        operationID,
			Kind:               PaidActionRecall,
			RequestFingerprint: fingerprint,
			EpisodicMemoryID:   stringPtr(memoryID),
		}, result)
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
func (s *Service) RecallDiaryStars(ctx context.Context, scope platform.UserScope, operationID string, diaryID string, syncConsent bool) (RecallDiaryStarsResult, error) {
	if scope.UserID() == "" {
		return RecallDiaryStarsResult{}, ErrScopeRequired
	}
	if strings.TrimSpace(operationID) == "" {
		return RecallDiaryStarsResult{}, ErrOperationIDRequired
	}
	if diaryID == "" {
		return RecallDiaryStarsResult{}, ErrRecallInputRequired
	}
	fingerprint := diaryRecallFingerprint(diaryID)

	var result RecallDiaryStarsResult
	err := s.recalls.InRecallTx(ctx, func(tx RecallTx) error {
		// 0. Lock + receipt replay before any work, exactly as single recall (A2/A3).
		if err := tx.LockGraphMutation(ctx, scope); err != nil {
			return err
		}
		receipt, found, err := tx.GetPaidActionReceipt(ctx, scope, operationID)
		if err != nil {
			return err
		}
		response, replay, err := replayReceipt(receipt, found, PaidActionDiaryRecall, fingerprint)
		if err != nil {
			return err
		}
		if replay {
			return decodeReceiptResponse(response, &result)
		}
		sync, err := s.syncToToday(ctx, scope, tx, syncConsent)
		if err != nil {
			return err
		}
		anchors, err := tx.LiveDiaryRecallAnchors(ctx, scope, diaryID)
		if err != nil {
			return err
		}
		// Reject a diary with no still-live memories FOR THIS USER before spending, reinforcing,
		// or writing a receipt — the whole transaction (including the sync) rolls back. This is
		// also the per-user guard: a foreign diary_id resolves to zero of the caller's anchors, so
		// user A cannot advance their clock for free against user B's diary or leave a cross-user
		// receipt row ([D3][U1]). The reader UI already disables the action at zero live stars.
		if len(anchors) == 0 {
			return ErrRecallNoLiveMemories
		}
		// Spend first, for EVERY memory, from the one pre-recall anchor snapshot: each
		// SpendIntent targets one memory and carries that memory's own accessibility signal,
		// so the diary's cost is the sum of the per-memory recalls ([D3]) — priced exactly as
		// the diary quote priced it (a reinforce nudges neighbor offsets, so pricing after
		// reinforcing a sibling would drift from the quote). Each spend's dedup key is
		// operation-id + member-id, so a replayed diary recall re-charges no member (A3). A
		// denial aborts the whole transaction — atomic, resets nothing.
		ids := make([]string, 0, len(anchors))
		for _, anchor := range anchors {
			ids = append(ids, anchor.EpisodicMemoryID)
			if err := s.spendGate.CheckAndSpend(ctx, scope, tx, RecallSpendIntent(operationID, anchor.EpisodicMemoryID, recallAccessibilitySignal(anchor, sync.Current))); err != nil {
				return err
			}
		}
		for _, id := range ids {
			if _, err := s.reinforce(ctx, scope, tx, id, sync.Current); err != nil {
				return err
			}
		}
		result = RecallDiaryStarsResult{DiaryID: diaryID, EpisodicMemoryIDs: ids, Sync: sync}
		return s.writeReceipt(ctx, scope, tx, PaidActionReceipt{
			OperationID:        operationID,
			Kind:               PaidActionDiaryRecall,
			RequestFingerprint: fingerprint,
			DiaryID:            stringPtr(diaryID),
		}, result)
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
