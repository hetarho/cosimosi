package memory

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/cosimosi/api/internal/platform/values"
)

// Recall use-case ([R1]–[R7]) — the backend orchestration of 회고하기. Recalling a memory
// always Reinforces it (brighter, slightly larger, gist timer reset, neighbors nudged);
// only a genuine prediction error — the rewrite differs in MEANING from the current text —
// Reconsolidates it (rewrite current_text, reshape the seed, regenerate the remaining
// stage texts). Recall writes ANCHORS, not pixels: the visible brightness/decay/gist
// recovery is produced by the forgetting/consolidation read-time functions that read these
// anchors. The Diary is never written ([I2][R7]).

var (
	// ErrRecallInputRequired rejects an empty memory/diary id or (for Recall) an empty
	// rewrite — a Recall is a rewrite, a no-rewrite whole-diary recall is RecallDiaryStars.
	ErrRecallInputRequired = errors.New("recall requires a target id and a rewrite")
	// ErrRecallMemoryNotFound is returned when the target is not the caller's or does not
	// exist; ErrRecallMemoryUnavailable when it is soft-deleted ([R1]).
	ErrRecallMemoryNotFound    = errors.New("recall target memory not found")
	ErrRecallMemoryUnavailable = errors.New("recall target memory is unavailable")
	ErrRecallSourceChanged     = errors.New("recall source changed during comparison; retry with a fresh quote")
	// ErrRecallNoLiveMemories rejects a whole-diary recall that resolves to zero still-live
	// memories for the caller — an all-let-go/deleted diary or, crucially, another user's diary
	// (a foreign diary_id yields zero of the caller's anchors). Raised before the sync/spend/
	// receipt so nothing commits: no free clock advance, no cross-user receipt row ([D3][U1]).
	ErrRecallNoLiveMemories = errors.New("recall diary has no live memories for this user")
)

// recallAccessibilitySignal derives the spend-time accessibility cost weight ([F4])
// the recall SpendIntent carries: the same read-time forgetting chain the render
// path uses (offset-inclusive elapsed → decay depth → convex weight), evaluated at
// the post-sync universe time — so the gate prices exactly the decay state the user
// is recalling out of. A signal, never a price (: pricing lives in the economy).
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

// RecallCommand is one 회고하기 request: the client's operation id (the replay key), the target
// memory, the rewritten text and the user's consent to sync the universe clock first.
type RecallCommand struct {
	OperationID string
	MemoryID    string
	RewriteText string
	SyncConsent bool
}

// RecallDiaryStarsCommand is one whole-diary recall request.
type RecallDiaryStarsCommand struct {
	OperationID string
	DiaryID     string
	SyncConsent bool
}

// Recall is the 회고하기 orchestration, in two transactions around the provider call. A short
// preparation transaction verifies scope, receipt, consent, target and affordability; the provider
// comparison runs after it releases its graph lock; the commit transaction repeats the
// receipt/consent/spend checks, rejects a changed source, and applies sync + spend + anchors +
// reinforce + (reconsolidate) + provenance wholly or not at all. The Diary is never in that write
// set ([I2][R7]).
func (s *PaidActionService) Recall(ctx context.Context, scope platform.UserScope, cmd RecallCommand) (RecallResult, error) {
	operationID, memoryID, rewriteText := cmd.OperationID, cmd.MemoryID, cmd.RewriteText
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
	cmd.RewriteText = rewriteText
	fingerprint := recallFingerprint(memoryID, rewriteText)
	// Resolved once, outside both transactions: the zone is not a transactional fact, and a read
	// through the pool inside a transaction would wait on a second connection.
	today, err := s.userToday(ctx, scope)
	if err != nil {
		return RecallResult{}, err
	}

	prepared, replay, err := s.prepareRecall(ctx, scope, cmd, fingerprint, today)
	if err != nil || replay != nil {
		return valueOr(replay), err
	}
	differs, err := s.predictionError.Differs(ctx, prepared.CurrentText, rewriteText)
	if err != nil {
		return RecallResult{}, err
	}
	if err := ctx.Err(); err != nil {
		return RecallResult{}, err
	}
	return s.commitRecall(ctx, scope, cmd, fingerprint, today, prepared, differs)
}

// prepareRecall is the short first transaction: under the graph lock it replays a committed receipt
// (returned as replay) or checks consent, the target and affordability, and returns the memory the
// provider comparison runs against once the lock is released.
func (s *PaidActionService) prepareRecall(ctx context.Context, scope platform.UserScope, cmd RecallCommand, fingerprint string, today time.Time) (EpisodicMemory, *RecallResult, error) {
	operationID, memoryID, syncConsent := cmd.OperationID, cmd.MemoryID, cmd.SyncConsent
	var prepared EpisodicMemory
	var result RecallResult
	replayed := false
	err := s.recalls.InRecallTx(ctx, func(tx RecallTx) error {
		if err := tx.LockGraphMutation(ctx, scope); err != nil {
			return err
		}
		var err error
		if replayed, err = replayIfReceipted(ctx, scope, tx, PaidActionRecall, operationID, fingerprint, &result); err != nil || replayed {
			return err
		}
		_, _, err = s.syncTarget(ctx, scope, tx, today, syncConsent)
		if err != nil {
			return err
		}
		prepared, err = tx.EpisodicMemoryForRecall(ctx, scope, memoryID)
		if err != nil {
			return err
		}
		if prepared.DeletedAt != nil {
			return ErrRecallMemoryUnavailable
		}
		return nil
	})
	if err != nil {
		return EpisodicMemory{}, nil, err
	}
	if replayed {
		return EpisodicMemory{}, &result, nil
	}
	return prepared, nil, nil
}

// commitRecall is the commit transaction: it repeats the receipt and consent checks, refuses a
// source that changed since preparation, and applies sync + reinforce + (reconsolidate) +
// provenance + the receipt wholly or not at all.
func (s *PaidActionService) commitRecall(ctx context.Context, scope platform.UserScope, cmd RecallCommand, fingerprint string, today time.Time, prepared EpisodicMemory, differs bool) (RecallResult, error) {
	operationID, memoryID, rewriteText, syncConsent := cmd.OperationID, cmd.MemoryID, cmd.RewriteText, cmd.SyncConsent
	var result RecallResult
	err := s.recalls.InRecallTx(ctx, func(tx RecallTx) error {
		// 0. Serialize this user's paid actions and look up a matching receipt BEFORE any
		// work: concurrent duplicates queue on the lock, so the loser reads the winner's
		// committed receipt and replays it — no second spend, no second recall. A
		// same-id/different-input receipt is a conflict; an exact match replays the stored
		// response verbatim (before the consent gate, so a committed recall's retry never
		// spuriously demands consent).
		if err := tx.LockGraphMutation(ctx, scope); err != nil {
			return err
		}
		if replayed, err := replayIfReceipted(ctx, scope, tx, PaidActionRecall, operationID, fingerprint, &result); err != nil || replayed {
			return err
		}
		// 1. Sync the clock to today — recall lands on today's clock ([R1a]). The consent is
		// server-enforced here: a sync that would advance the clock without consent is refused
		// before any spend. universeTime below is the post-sync clock.
		sync, err := s.syncToToday(ctx, scope, tx, today, syncConsent)
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
		if memory.RepresentationRevision != prepared.RepresentationRevision || memory.CurrentText != prepared.CurrentText {
			return ErrRecallSourceChanged
		}

		// Recovery is measured before the free recall resets its anchors.
		anchor := recallAnchorOf(memory)
		recovered := 0
		if recallRecoversDecay(anchor, sync.Current) {
			recovered = 1
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
		// 7. Report the counter facts inside the same transaction, so a later failure leaves no
		// counter advanced.
		if err := s.recordRecallProgress(ctx, scope, tx, 1, recovered); err != nil {
			return err
		}
		// 8. Commit the receipt in the SAME transaction as the debit + effects: a
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
// Reinforce every still-live memory born from the diary without an economy check — in
// ONE transaction. It never calls PredictionError or Reconsolidate, writes no current_text,
// and changes no seed ([R4][R6][I8]).
func (s *PaidActionService) RecallDiaryStars(ctx context.Context, scope platform.UserScope, cmd RecallDiaryStarsCommand) (RecallDiaryStarsResult, error) {
	operationID, diaryID, syncConsent := cmd.OperationID, cmd.DiaryID, cmd.SyncConsent
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
	today, err := s.userToday(ctx, scope)
	if err != nil {
		return RecallDiaryStarsResult{}, err
	}

	var result RecallDiaryStarsResult
	err = s.recalls.InRecallTx(ctx, func(tx RecallTx) error {
		// 0. Lock + receipt replay before any work, exactly as single recall.
		if err := tx.LockGraphMutation(ctx, scope); err != nil {
			return err
		}
		if replayed, err := replayIfReceipted(ctx, scope, tx, PaidActionDiaryRecall, operationID, fingerprint, &result); err != nil || replayed {
			return err
		}
		sync, err := s.syncToToday(ctx, scope, tx, today, syncConsent)
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
		// All recovery measurements use the same pre-recall snapshot.
		ids := make([]string, 0, len(anchors))
		// The 망각·회복 judgement rides along the measurement pass, on the same pre-recall snapshot:
		// once the reinforce below resets each anchor the depth is gone, and there is no recompute
		// path afterwards.
		recovered := 0
		for _, anchor := range anchors {
			ids = append(ids, anchor.EpisodicMemoryID)
			if recallRecoversDecay(anchor, sync.Current) {
				recovered++
			}
		}
		for _, id := range ids {
			if _, err := s.reinforce(ctx, scope, tx, id, sync.Current); err != nil {
				return err
			}
		}
		// A whole-diary recall counts each member, once per member.
		if err := s.recordRecallProgress(ctx, scope, tx, len(ids), recovered); err != nil {
			return err
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
func (s *PaidActionService) reinforce(ctx context.Context, scope platform.UserScope, tx RecallTx, memoryID string, universeTime time.Time) (reinforceEffects, error) {
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
	updates := make([]Synapse, 0, len(synapses))
	for _, synapse := range synapses {
		synapse.Strength = float32(Potentiate(float64(synapse.Strength), values.SynapsePotentiationRate))
		synapse.CoActivationCount = 1
		synapse.LastActivatedUniverseTime = universeTime
		updates = append(updates, synapse)
	}
	if err := tx.UpsertSynapses(ctx, scope, updates); err != nil {
		return reinforceEffects{}, err
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
func (s *PaidActionService) reconsolidate(ctx context.Context, scope platform.UserScope, tx RecallTx, memory EpisodicMemory, rewriteText string, universeTime time.Time) (int64, error) {
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
	if err := s.enqueue(ctx, scope, tx, JobKindSemanticize, SemanticizeJobPayload{}, jobqueue.Target{
		Kind: jobqueue.TargetMemory, ID: memory.ID, ExpectedRevision: revision,
	}); err != nil {
		return 0, err
	}

	// Append the append-only 변천사 row ([R8a]): the new representation text at this
	// universe-time. The created/original baseline is synthesized at read.
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

// valueOr returns the replayed result, or the zero result when there is none.
func valueOr(replay *RecallResult) RecallResult {
	if replay == nil {
		return RecallResult{}
	}
	return *replay
}
