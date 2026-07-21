package memory

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// Release use-case ([X1]–[X6][I1][I2]) — the backend orchestration of the two user-initiated ways to
// let a memory go, over the shared deletion rules this unit calls (never redefines).
//
//   - Release / Restore: full delete is a diary-scoped soft-delete kept restorable for
//     release.soft_delete_retention_days real-clock days; Restore reverses it exactly from the
//     retention-scoped release-effect ledger. No hard delete runs during Release ([X2]).
//   - SuggestLetGo / LetGo: letting-go seals this-memory-only semantic neurons the AI SUGGESTS and the
//     user APPROVES; it is permanent — no deleted_at, no timer, no ledger, no restore ([X4][X5]). The
//     memory's emotion/color/seed and its spatial/entity neurons are untouched — a silent engram.
//   - Sweep: the ONLY hard delete of user data. It removes solely release groups the user soft-deleted
//     once their restore deadline arrives, honoring [I1] by construction (it originates no deletion of
//     its own). Release atomically schedules the durable target; the normal worker loop executes it
//     without a cron. The opportunistic pre-Release sweep remains a secondary cleanup path.
//
// The system never originates deletion; the AI never executes one. Orphan-ness and approved-id validity
// are server-side decisions (§2.9#8): every read, seal, unseal, delete, and suggestion is per-user scoped.

var (
	// ErrReleaseInputRequired rejects an empty diary/memory id.
	ErrReleaseInputRequired = errors.New("release requires a target id")
	// ErrReleaseNoLiveMemories is returned when the diary has no live linked memory to release
	// (unknown diary or already fully released) — nothing is soft-deleted or sealed.
	ErrReleaseNoLiveMemories = errors.New("no live memories to release for this diary")
	// ErrAlreadyReleased is the canonical no-op guard against a second Release of a diary whose
	// release group is still live — never a double-seal.
	ErrAlreadyReleased = errors.New("diary is already released")
	// ErrReleaseMemoryNotFound is returned when the letting-go target is not the caller's or does not
	// exist; ErrReleaseMemoryUnavailable when it is soft-deleted (a released memory has no letting-go).
	ErrReleaseMemoryNotFound    = errors.New("release target memory not found")
	ErrReleaseMemoryUnavailable = errors.New("release target memory is unavailable")
	// ErrRestoreNotReleased is returned when there is no live release group to restore (never released,
	// or already swept — nothing remains to restore).
	ErrRestoreNotReleased = errors.New("diary release cannot be restored")
	// ErrRestoreWindowExpired is returned when the release is older than the retention window — the
	// restore window has closed (the sweep owns it now).
	ErrRestoreWindowExpired = errors.New("restore window has expired")
	// ErrLetGoInvalidApproved rejects an approved id that is not a this-memory-only semantic neuron
	// (a shared, foreign, or non-semantic id) — nothing is sealed (§2.9#8).
	ErrLetGoInvalidApproved = errors.New("approved neuron is not an eligible this-memory-only semantic neuron")
)

// Release performs a full delete of one diary ([X1][X2]): opportunistically sweep the caller's expired
// releases first, then in one transaction soft-delete every live memory born from
// the diary, seal the removal set's orphan neurons, weaken the shared neurons' contribution (LTD), and
// record the release-effect ledger plus its exact-deadline retention job so Restore can reverse it
// exactly. No hard delete, no Diary UPDATE, no SpendGate (deletion is never priced).
func (s *Service) Release(ctx context.Context, scope platform.UserScope, diaryID string) (ReleaseResult, error) {
	if scope.UserID() == "" {
		return ReleaseResult{}, ErrScopeRequired
	}
	if diaryID == "" {
		return ReleaseResult{}, ErrReleaseInputRequired
	}

	// This secondary per-user sweep frees expired storage during an active visit. The durable
	// exact-deadline job below is what guarantees cleanup when the user never returns.
	if _, err := s.Sweep(ctx, scope, s.now()); err != nil {
		return ReleaseResult{}, err
	}

	var result ReleaseResult
	err := s.releases.InReleaseTx(ctx, func(tx ReleaseTx) error {
		if err := tx.LockGraphMutation(ctx, scope); err != nil {
			return err
		}
		if _, exists, err := tx.ReleaseGroupForDiary(ctx, scope, diaryID); err != nil {
			return err
		} else if exists {
			return ErrAlreadyReleased
		}

		// deleted_at is real (wall-clock) UTC — the restore window is a human-time promise,
		// independent of universe-time ([X2]). The same timestamp seals the orphan neurons.
		deletedAt := s.now()
		memoryIDs, err := tx.SoftDeleteDiaryMemories(ctx, scope, diaryID, deletedAt)
		if err != nil {
			return err
		}
		if len(memoryIDs) == 0 {
			return ErrReleaseNoLiveMemories
		}

		releaseID := s.newID()
		if err := tx.InsertReleaseGroup(ctx, scope, ReleaseGroup{ID: releaseID, DiaryID: diaryID, DeletedAt: deletedAt}); err != nil {
			return err
		}
		if err := tx.RecordReleaseMemories(ctx, scope, releaseID, memoryIDs); err != nil {
			return err
		}

		// Classify the removal set's neurons over the shared deletion rules: seal orphans, keep shared and
		// Depress each removed memory's contribution — shared neurons are never deleted ([X1][I1]).
		neuronIDs, err := tx.RemovalNeuronIDs(ctx, scope, memoryIDs, nil)
		if err != nil {
			return err
		}
		facts, err := tx.RetainedNeuronActivationFacts(ctx, scope, neuronIDs)
		if err != nil {
			return err
		}
		orphans, shared := ClassifyNeurons(memoryIDs, neuronIDs, facts)
		sealed, err := tx.SealNeurons(ctx, scope, orphans, deletedAt)
		if err != nil {
			return err
		}
		if err := tx.RecordReleaseSealedNeurons(ctx, scope, releaseID, sealed, deletedAt); err != nil {
			return err
		}
		deltas, err := tx.WeakenSharedContributionsReturningDeltas(ctx, scope, neuronIDs, shared, values.DeletionContributionWeakenAmount)
		if err != nil {
			return err
		}
		if err := tx.RecordReleaseSynapseDeltas(ctx, scope, releaseID, deltas); err != nil {
			return err
		}
		if err := tx.CancelReleaseMemoryJobs(ctx, scope, releaseID, memoryIDs, deletedAt); err != nil {
			return err
		}
		if err := enqueueScheduledJob(
			ctx,
			tx,
			scope,
			s.newID(),
			deletedAt.Add(retentionWindow()),
			deletedAt,
			JobKindRetention,
			releaseID,
			RetentionSweepJobPayload{},
			JobTarget{Kind: JobTargetRelease, ID: releaseID},
		); err != nil {
			return err
		}

		result = ReleaseResult{DiaryID: diaryID, EpisodicMemoryIDs: memoryIDs, DeletedAt: deletedAt}
		return nil
	})
	if err != nil {
		return ReleaseResult{}, err
	}
	return result, nil
}

// Restore undoes a full delete within the retention window ([X2]): it clears deleted_at for the released
// memories, reclassifies release-origin seals across every restored activation, adds the recorded LTD back to each
// shared contribution synapse (clamped), and retires the release group — returning every released memory
// to full participation. It refuses once the release is absent (swept / never released) or older than the
// window. Letting-go has no restore path.
func (s *Service) Restore(ctx context.Context, scope platform.UserScope, diaryID string) (RestoreResult, error) {
	if scope.UserID() == "" {
		return RestoreResult{}, ErrScopeRequired
	}
	if diaryID == "" {
		return RestoreResult{}, ErrReleaseInputRequired
	}

	restoreAt := s.now()
	var result RestoreResult
	err := s.releases.InReleaseTx(ctx, func(tx ReleaseTx) error {
		if err := tx.LockGraphMutation(ctx, scope); err != nil {
			return err
		}
		group, exists, err := tx.ReleaseGroupForDiary(ctx, scope, diaryID)
		if err != nil {
			return err
		}
		if !exists {
			return ErrRestoreNotReleased
		}
		if !restoreAt.Before(group.DeletedAt.Add(retentionWindow())) {
			return ErrRestoreWindowExpired
		}

		memoryIDs, err := tx.ReleaseMemories(ctx, scope, group.ID)
		if err != nil {
			return err
		}
		if err := tx.ClearReleaseMemoriesDeletedAt(ctx, scope, memoryIDs); err != nil {
			return err
		}

		reembedTargets, err := reclassifyReleaseMemoryNeurons(ctx, scope, tx, group.ID)
		if err != nil {
			return err
		}

		// Add each recorded LTD amount back to the edge's current strength, clamped, atomically in SQL
		// — the exact reversal of Release's Depress that composes with (never clobbers) interim activity.
		if err := tx.ReverseReleaseSynapseDeltas(ctx, scope, group.ID); err != nil {
			return err
		}
		if err := tx.RequeueReleaseMemoryJobs(ctx, scope, group.ID, restoreAt); err != nil {
			return err
		}
		if len(reembedTargets) > 0 {
			if err := enqueueJob(ctx, tx, scope, s.newID(), restoreAt, JobKindEmbed, EmbedJobPayload{}, reembedTargets...); err != nil {
				return err
			}
		}
		if err := tx.DeleteReleaseRetentionJobs(ctx, scope, group.ID); err != nil {
			return err
		}

		// Retire the ledger (cascade clears the effect rows) — the diary is no longer released.
		if err := tx.DeleteReleaseGroup(ctx, scope, group.ID); err != nil {
			return err
		}
		result = RestoreResult{DiaryID: diaryID, EpisodicMemoryIDs: memoryIDs}
		return nil
	})
	if err != nil {
		return RestoreResult{}, err
	}
	return result, nil
}

// SuggestLetGo is letting-go step 1 ([X6]): load the live memory, pre-filter the candidate set to
// this-memory-only semantic neurons IN THE USE-CASE, and let the SealSuggester rank within that
// already-safe set. It persists nothing (a metered LLM read), intersects the AI's references back with
// the offered set as defence-in-depth, and returns the candidates plus the [X7] heavy-state hint.
func (s *Service) SuggestLetGo(ctx context.Context, scope platform.UserScope, memoryID string, words string) (SuggestLetGoResult, error) {
	if scope.UserID() == "" {
		return SuggestLetGoResult{}, ErrScopeRequired
	}
	if memoryID == "" {
		return SuggestLetGoResult{}, ErrReleaseInputRequired
	}

	episodicMemory, err := s.releases.EpisodicMemoryForRelease(ctx, scope, memoryID)
	if err != nil {
		return SuggestLetGoResult{}, err
	}
	if episodicMemory.DeletedAt != nil {
		return SuggestLetGoResult{}, ErrReleaseMemoryUnavailable
	}

	candidates, err := s.releases.ThisMemoryOnlySemanticNeurons(ctx, scope, memoryID)
	if err != nil {
		return SuggestLetGoResult{}, err
	}
	suggestion, err := s.sealSuggester.Suggest(ctx, memorySummary(episodicMemory), words, candidates)
	if err != nil {
		return SuggestLetGoResult{}, err
	}

	return SuggestLetGoResult{
		Candidates: intersectCandidates(candidates, suggestion.Candidates),
		HeavyState: deriveHeavyState(words, episodicMemory.Emotion),
	}, nil
}

// LetGo is letting-go step 2 ([X4][X5]): in one transaction, re-validate server-side that every approved
// id is a this-memory-only semantic neuron (a shared/foreign/non-semantic id is rejected with nothing
// sealed), then seal exactly those neurons via the shared deletion rules. Permanent — no deleted_at, no timer, no
// ledger. The memory's emotion/color/seed and its spatial/entity/time neurons are untouched.
func (s *Service) LetGo(ctx context.Context, scope platform.UserScope, memoryID string, approvedNeuronIDs []string) (LetGoResult, error) {
	if scope.UserID() == "" {
		return LetGoResult{}, ErrScopeRequired
	}
	if memoryID == "" {
		return LetGoResult{}, ErrReleaseInputRequired
	}

	var result LetGoResult
	err := s.releases.InReleaseTx(ctx, func(tx ReleaseTx) error {
		if err := tx.LockGraphMutation(ctx, scope); err != nil {
			return err
		}
		episodicMemory, err := tx.EpisodicMemoryForRelease(ctx, scope, memoryID)
		if err != nil {
			return err
		}
		if episodicMemory.DeletedAt != nil {
			return ErrReleaseMemoryUnavailable
		}

		eligibleIDs, err := tx.ThisMemoryOnlySemanticNeuronIDs(ctx, scope, memoryID)
		if err != nil {
			return err
		}
		eligible := make(map[string]bool, len(eligibleIDs))
		for _, id := range eligibleIDs {
			eligible[id] = true
		}
		approved := distinctStrings(approvedNeuronIDs)
		for _, id := range approved {
			if !eligible[id] {
				return ErrLetGoInvalidApproved
			}
		}
		if len(approved) == 0 {
			result = LetGoResult{SealedNeuronIDs: []string{}}
			return nil
		}

		// Classify defensively — the approved ids are orphan-to-this-memory by construction, so the
		// classifier seals all of them and the shared-weaken is a no-op, but routing through the shared rules
		// keeps the one sealing path.
		facts, err := tx.RetainedNeuronActivationFacts(ctx, scope, approved)
		if err != nil {
			return err
		}
		orphans, shared := ClassifyNeurons([]string{memoryID}, approved, facts)
		if _, err := tx.SealNeurons(ctx, scope, orphans, s.now()); err != nil {
			return err
		}
		if err := tx.WeakenSharedContributions(ctx, scope, approved, shared, values.DeletionContributionWeakenAmount); err != nil {
			return err
		}
		result = LetGoResult{SealedNeuronIDs: orphans}
		return nil
	})
	if err != nil {
		return LetGoResult{}, err
	}
	return result, nil
}

// Sweep is the retention sweeper ([X2][I1]) — the ONLY hard delete of user data. In one transaction it
// removes every release group whose deleted_at has reached the retention cutoff: the released (still-soft-deleted)
// memories and their retained provenance (via the memory-provenance cascade), their activations, the exclusive sealed
// orphan neurons no other memory references (with their embeddings + edges), and the original Diary
// row/body — in FK-safe order, per-user scoped. It never touches a live (deleted_at IS NULL) row and never
// a shared neuron. Returns how many release groups were swept.
func (s *Service) Sweep(ctx context.Context, scope platform.UserScope, now time.Time) (int, error) {
	if scope.UserID() == "" {
		return 0, ErrScopeRequired
	}

	cutoff := now.Add(-retentionWindow())
	swept := 0
	err := s.releases.InReleaseTx(ctx, func(tx ReleaseTx) error {
		if err := tx.LockGraphMutation(ctx, scope); err != nil {
			return err
		}
		groups, err := tx.ExpiredReleaseGroups(ctx, scope, cutoff)
		if err != nil {
			return err
		}
		for _, group := range groups {
			if err := sweepReleaseGroup(ctx, scope, tx, group); err != nil {
				return err
			}
			swept++
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return swept, nil
}

// RetentionSweeper is the narrow worker-facing use-case. It locks one scheduled
// release group, retries exactly at its deadline when claimed early, and treats a
// group already retired by Restore as a successful no-op.
type RetentionSweeper struct {
	releases ReleaseRepo
}

func NewRetentionSweeper(releases ReleaseRepo) RetentionSweeper {
	return RetentionSweeper{releases: releases}
}

func (s RetentionSweeper) SweepRelease(ctx context.Context, scope platform.UserScope, releaseID string, now time.Time) (bool, error) {
	if scope.UserID() == "" {
		return false, ErrScopeRequired
	}
	if releaseID == "" {
		return false, ErrReleaseInputRequired
	}
	if s.releases == nil {
		return false, errors.New("retention sweep requires a release repository")
	}
	swept := false
	err := s.releases.InReleaseTx(ctx, func(tx ReleaseTx) error {
		if err := tx.LockGraphMutation(ctx, scope); err != nil {
			return err
		}
		group, exists, err := tx.ReleaseGroupForSweep(ctx, scope, releaseID)
		if err != nil || !exists {
			return err
		}
		deadline := group.DeletedAt.Add(retentionWindow())
		if now.Before(deadline) {
			return retentionNotDueError{deadline: deadline}
		}
		if err := sweepReleaseGroup(ctx, scope, tx, group); err != nil {
			return err
		}
		swept = true
		return nil
	})
	return swept, err
}

type retentionNotDueError struct {
	deadline time.Time
}

func (e retentionNotDueError) Error() string {
	return "release retention sweep claimed before its deadline"
}

func (e retentionNotDueError) RetryAt() time.Time {
	return e.deadline
}

func sweepReleaseGroup(ctx context.Context, scope platform.UserScope, tx ReleaseTx, group ReleaseGroup) error {
	memoryIDs, err := tx.ReleaseMemories(ctx, scope, group.ID)
	if err != nil {
		return err
	}
	// Reclassify before the group can cascade its release-origin ownership away. This is
	// essential when an overlapping retained owner makes a neuron ineligible for deletion.
	if _, err := reclassifyReleaseMemoryNeurons(ctx, scope, tx, group.ID); err != nil {
		return err
	}
	// Decide exclusive dependents while activations still exist. A neuron another
	// memory activates is spared; it may remain as a target of a mixed worker job.
	exclusive, err := tx.ExclusiveReleaseNeurons(ctx, scope, group.ID, memoryIDs)
	if err != nil {
		return err
	}
	if err := tx.PurgeReleaseJobs(ctx, scope, group.ID, memoryIDs, exclusive); err != nil {
		return err
	}
	if err := tx.DeleteReleaseActivations(ctx, scope, memoryIDs); err != nil {
		return err
	}
	if err := tx.DeleteReleaseSynapses(ctx, scope, exclusive); err != nil {
		return err
	}
	if err := tx.DeleteReleaseEmbeddings(ctx, scope, exclusive); err != nil {
		return err
	}
	if err := tx.DeleteReleaseNeurons(ctx, scope, exclusive); err != nil {
		return err
	}
	if err := tx.DeleteReleaseMemories(ctx, scope, memoryIDs); err != nil {
		return err
	}
	if err := tx.DeleteReleaseDiary(ctx, scope, group.DiaryID); err != nil {
		return err
	}
	return tx.DeleteReleaseGroup(ctx, scope, group.ID)
}

func reclassifyReleaseMemoryNeurons(ctx context.Context, scope platform.UserScope, tx ReleaseTx, releaseID string) ([]JobTarget, error) {
	facts, err := tx.ReleaseMemoryNeuronSealFacts(ctx, scope, releaseID)
	if err != nil {
		return nil, err
	}
	plan := ReclassifyRetainedNeuronSeals(facts)
	if err := tx.DeleteReleaseNeuronSealEffects(ctx, scope, plan.RetireReleaseEffectIDs); err != nil {
		return nil, err
	}
	if err := tx.UnsealReleaseOwnedNeurons(ctx, scope, plan.UnsealNeuronIDs); err != nil {
		return nil, err
	}
	targets := make([]JobTarget, 0, len(plan.Reembed))
	for _, target := range plan.Reembed {
		targets = append(targets, JobTarget{
			Kind:             JobTargetNeuron,
			ID:               target.NeuronID,
			ExpectedRevision: target.RepresentationRevision,
		})
	}
	return targets, nil
}

// retentionWindow is the full-delete restore window as a real-clock duration — the sole boundary of the
// 30-day promise ([X2]), from the generated values constant (never a literal).
func retentionWindow() time.Duration {
	return time.Duration(values.ReleaseSoftDeleteRetentionDays) * 24 * time.Hour
}

func memorySummary(episodicMemory EpisodicMemory) MemorySummary {
	return MemorySummary{
		Name:        episodicMemory.Name,
		CurrentText: episodicMemory.CurrentText,
		Mood:        episodicMemory.Emotion.Mood,
	}
}

// intersectCandidates keeps only the AI's references that are in the offered set, filling each name from
// the authoritative offered candidate (the AI supplies id + reason, never a name it could invent) — the
// use-case half of "the AI can never surface a shared or foreign reference" ([X6]).
func intersectCandidates(offered []SealCandidateRef, suggested []SealCandidate) []SealCandidate {
	names := make(map[string]string, len(offered))
	for _, candidate := range offered {
		names[candidate.NeuronID] = candidate.Name
	}
	out := make([]SealCandidate, 0, len(suggested))
	seen := make(map[string]bool, len(suggested))
	for _, candidate := range suggested {
		name, ok := names[candidate.NeuronID]
		if !ok || seen[candidate.NeuronID] {
			continue
		}
		seen[candidate.NeuronID] = true
		out = append(out, SealCandidate{NeuronID: candidate.NeuronID, Name: name, Reason: candidate.Reason})
	}
	return out
}

// heavyStateCues is the v1-conservative reserved-slot detection set ([X7]): a small keyword cue over the
// user's words. It is code, not a values knob (like the prediction gate's boolean) — refined later. It
// is intentionally minimal and claims no clinical judgement; the notice UI (framed as symbolic, no
// efficacy) is the delete UI's.
var heavyStateCues = []string{
	"suicidal",
	"suicide",
	"kill myself",
	"end my life",
	"self-harm",
	"self harm",
	"hopeless",
	"worthless",
}

// deriveHeavyState derives the [X7] hint server-side (default Detected=false): a keyword cue over the
// words, corroborated by a negative-high-arousal emotional signal. Conservative on purpose — a false
// negative is a missed gentle notice, a false positive is an intrusive one.
func deriveHeavyState(words string, emotion Emotion) HeavyState {
	lowered := strings.ToLower(words)
	for _, cue := range heavyStateCues {
		if strings.Contains(lowered, cue) {
			return HeavyState{Detected: true, Severity: heavySeverity(emotion)}
		}
	}
	return HeavyState{}
}

// heavySeverity grades a detected cue by the memory's emotional signal — a negative, high-arousal
// memory reads as more acute. Kept coarse (a two-level hint) since the slot is a reserved v1.
func heavySeverity(emotion Emotion) string {
	if quadrant, ok := MoodQuadrant(emotion.Mood); ok && quadrant == EmotionQuadrantNegativeHighArousal {
		return "elevated"
	}
	return "present"
}

func distinctStrings(values []string) []string {
	seen := make(map[string]bool, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		out = append(out, value)
	}
	return out
}
