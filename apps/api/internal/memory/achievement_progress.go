package memory

import (
	"context"
	"fmt"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// The counter reports, one function per producing path. Each runs inside the transaction that made
// the fact true, so a rollback advances nothing, and each reduces its meaning-layer measurement to a
// count before it crosses the port — the recorder never learns a stage, a mood's weight, or an id.

// recordLaunchProgress reports what a launch made true. It is called only after the monotonic launch
// guard admitted the diary, at the same point as the write-earn grant: a past-dated diary is saved
// and counts nothing ([I10][T1]).
func (s *Service) recordLaunchProgress(
	ctx context.Context,
	scope platform.UserScope,
	tx LaunchTx,
	diaryID string,
	launched []LaunchedMemory,
) error {
	if len(launched) == 0 {
		return nil
	}
	if err := s.achievements.RecordProgress(ctx, scope, tx, CounterDiaryWritten, 1); err != nil {
		return fmt.Errorf("record diary written %s: %w", diaryID, err)
	}
	if err := s.achievements.RecordProgress(ctx, scope, tx, CounterEpisodicMemoryLaunched, len(launched)); err != nil {
		return fmt.Errorf("record episodic memories launched: %w", err)
	}

	// Moods are counted per memory under a key built from the closed enum. The DISTINCT-mood count
	// is nobody's business here: the counter table's owner derives it from the first touch of a
	// family member, which is the only place distinctness can be proven.
	perMood := map[Mood]int{}
	// launchedPerNeuron is how many of THIS launch's memories activate each neuron — the term that
	// turns a final membership count into "did this launch cross the sharing threshold".
	launchedPerNeuron := map[string]int{}
	for _, memory := range launched {
		perMood[memory.Emotion.Mood]++
		for _, neuronID := range dedupIDs(memory.NeuronIDs) {
			launchedPerNeuron[neuronID]++
		}
	}
	for _, mood := range AllMoods() {
		count := perMood[mood]
		if count == 0 {
			continue
		}
		key := CounterMoodRecorded(mood)
		if err := s.achievements.RecordProgress(ctx, scope, tx, key, count); err != nil {
			return fmt.Errorf("record %s: %w", key, err)
		}
	}

	return s.recordNeuronSharing(ctx, scope, tx, launchedPerNeuron)
}

// recordNeuronSharing reports the two sharing facts, both read from the activation memberships this
// launch just wrote. It reads CoActivations — the same query Link runs a moment earlier for the
// temporal bonus — because the counts are a property of the graph, not of the launch payload.
//
// A crossing is `before < 2 && after >= 2`, and `before` is derived by subtracting THIS launch's own
// memberships rather than by testing `after == 2`. The difference is a real case: a neuron already in
// one memory that two of this launch's memories also activate lands at three, and an `== 2` test would
// miss the crossing entirely.
//
// A released memory can lower a membership below two and a later launch can raise it back, which
// counts a second time — the fact did happen twice, and the only row reading this counter is the
// first-shared-neuron achievement, already earned by then.
func (s *Service) recordNeuronSharing(
	ctx context.Context,
	scope platform.UserScope,
	tx LaunchTx,
	launchedPerNeuron map[string]int,
) error {
	if len(launchedPerNeuron) == 0 {
		return nil
	}
	ids := make([]string, 0, len(launchedPerNeuron))
	for id := range launchedPerNeuron {
		ids = append(ids, id)
	}
	activations, err := tx.CoActivations(ctx, scope, ids)
	if err != nil {
		return err
	}
	memoriesPerNeuron := make(map[string]map[string]struct{}, len(ids))
	for _, activation := range activations {
		memories := memoriesPerNeuron[activation.NeuronID]
		if memories == nil {
			memories = map[string]struct{}{}
			memoriesPerNeuron[activation.NeuronID] = memories
		}
		memories[activation.MemoryID] = struct{}{}
	}

	newlyShared := 0
	deepest := 0
	for neuronID, memories := range memoriesPerNeuron {
		after := len(memories)
		if after > deepest {
			deepest = after
		}
		before := after - launchedPerNeuron[neuronID]
		if before < sharedNeuronThreshold && after >= sharedNeuronThreshold {
			newlyShared++
		}
	}
	if newlyShared > 0 {
		if err := s.achievements.RecordProgress(ctx, scope, tx, CounterNeuronShared, newlyShared); err != nil {
			return fmt.Errorf("record neurons shared: %w", err)
		}
	}
	// A reach report: the store keeps the high-water mark, so a launch touching only shallow neurons
	// lowers nothing.
	if deepest > 0 {
		if err := s.achievements.RecordProgress(ctx, scope, tx, CounterNeuronShareDepth, deepest); err != nil {
			return fmt.Errorf("record neuron share depth: %w", err)
		}
	}
	return nil
}

// sharedNeuronThreshold is the membership count at which a neuron becomes shared — two memories, the
// smallest number that is more than one.
const sharedNeuronThreshold = 2

// recordRecallProgress reports one recall pass. `recoveredCount` is already reduced: the caller
// compared each memory's PRE-recall decay stage against the configured minimum from the same anchor
// snapshot the spend was priced from, so no stage crosses the port and no second read is needed.
func (s *Service) recordRecallProgress(
	ctx context.Context,
	scope platform.UserScope,
	tx RecallTx,
	recalledCount int,
	recoveredCount int,
) error {
	if recalledCount <= 0 {
		return nil
	}
	if err := s.achievements.RecordProgress(ctx, scope, tx, CounterRecallPerformed, recalledCount); err != nil {
		return fmt.Errorf("record recalls performed: %w", err)
	}
	if recoveredCount > 0 {
		if err := s.achievements.RecordProgress(ctx, scope, tx, CounterDecayRecovered, recoveredCount); err != nil {
			return fmt.Errorf("record decay recovered: %w", err)
		}
	}
	return nil
}

// recallRecoversDecay is the 망각·회복 judgement, made here so that only its answer travels: a recall
// counts when the memory was already visibly forgotten. The stage is read from the same pre-recall
// anchor snapshot the spend is priced from (recallAccessibilitySignal's inputs, exactly) — the
// reinforce that follows resets it, and there is no recompute path afterwards, which is the whole
// reason progress is pushed at the moment rather than derived later.
func recallRecoversDecay(anchor DiaryRecallAnchor, universeTime time.Time) bool {
	elapsed := EffectiveElapsedDays(universeTime, anchor.LastRecalledUniverseTime,
		anchor.CreatedUniverseTime, anchor.ForgettingOffsetDays)
	strength := EffectiveStrength(anchor.BaseStrength, anchor.RecallCount)
	return DecayStage(elapsed, anchor.Arousal, strength) >= values.AchievementRecoveryDecayStageMin
}

// recordViewSemanticProgress reports one 요지 별 열람 and the depth it reached. The [A2] 요지화-도달
// axis is observed at the VIEW moment rather than when a stage rises in the worker: the reported
// value is the stage actually served, and the store's reach mode keeps the high-water mark.
func (s *Service) recordViewSemanticProgress(
	ctx context.Context,
	scope platform.UserScope,
	tx ViewSemanticTx,
	stage int,
) error {
	if err := s.achievements.RecordProgress(ctx, scope, tx, CounterGistViewed, 1); err != nil {
		return fmt.Errorf("record gist viewed: %w", err)
	}
	if stage <= 0 {
		return nil
	}
	if err := s.achievements.RecordProgress(ctx, scope, tx, CounterSemanticStageDepth, stage); err != nil {
		return fmt.Errorf("record semantic stage depth: %w", err)
	}
	return nil
}

// recordReleaseProgress reports 놓아주기 — the soft-delete path. LetGo seals neurons and releases
// nothing, so it reports nothing.
func (s *Service) recordReleaseProgress(
	ctx context.Context,
	scope platform.UserScope,
	tx ReleaseTx,
	releasedCount int,
) error {
	if releasedCount <= 0 {
		return nil
	}
	if err := s.achievements.RecordProgress(ctx, scope, tx, CounterEpisodicMemoryReleased, releasedCount); err != nil {
		return fmt.Errorf("record episodic memories released: %w", err)
	}
	return nil
}
