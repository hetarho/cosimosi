package memory

import (
	"context"
	"errors"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// Published spend-signal reads (§2.2) — the depth signals the Twinkle economy's
// server quote prices ([G4]): this context alone knows how decayed or how gistified
// a memory is; the economy alone knows what that costs ([CC3]). Each read is
// standalone and write-free (a quote must not advance anything), evaluated at the
// universe time a real recall would land on — the sync-to-today target — so a quote
// and the authoritative spend price the same decay state.

// ErrSpendSignalInputRequired rejects an empty target id on a spend-signal read.
var ErrSpendSignalInputRequired = errors.New("spend signal requires a target id")

// RecallAccessibility returns one memory's spend-time accessibility cost weight
// ([F4]) — the recall quote's depth signal. A soft-deleted target is unavailable,
// exactly as Recall would refuse it.
func (s *Service) RecallAccessibility(ctx context.Context, scope platform.UserScope, memoryID string) (float64, error) {
	if scope.UserID() == "" {
		return 0, ErrScopeRequired
	}
	if memoryID == "" {
		return 0, ErrSpendSignalInputRequired
	}
	universeTime, err := s.signalUniverseTime(ctx, scope)
	if err != nil {
		return 0, err
	}
	episodicMemory, err := s.signals.EpisodicMemoryForRecall(ctx, scope, memoryID)
	if err != nil {
		return 0, err
	}
	if episodicMemory.DeletedAt != nil {
		return 0, ErrRecallMemoryUnavailable
	}
	return recallAccessibilitySignal(recallAnchorOf(episodicMemory), universeTime), nil
}

// DiaryRecallAccessibilities returns the per-memory accessibility weights of a diary's
// still-live memories — the whole-diary recall quote's signals ([D3]; the diary's
// cost is the sum of its per-memory recalls). An empty result mirrors
// RecallDiaryStars over the same diary: nothing to recall, nothing to price.
func (s *Service) DiaryRecallAccessibilities(ctx context.Context, scope platform.UserScope, diaryID string) ([]float64, error) {
	if scope.UserID() == "" {
		return nil, ErrScopeRequired
	}
	if diaryID == "" {
		return nil, ErrSpendSignalInputRequired
	}
	universeTime, err := s.signalUniverseTime(ctx, scope)
	if err != nil {
		return nil, err
	}
	anchors, err := s.signals.LiveDiaryRecallAnchors(ctx, scope, diaryID)
	if err != nil {
		return nil, err
	}
	weights := make([]float64, 0, len(anchors))
	for _, anchor := range anchors {
		weights = append(weights, recallAccessibilitySignal(anchor, universeTime))
	}
	return weights, nil
}

// ViewableGistStage returns the gist stage a view of this memory reaches — the
// risen semantic_stage bounded by the pregenerated ladder, the gist-view quote's
// depth signal ([R8][G4]). A memory whose gist has not risen is not quotable, the
// same canonical refusal ViewSemantic gives it.
func (s *Service) ViewableGistStage(ctx context.Context, scope platform.UserScope, memoryID string) (int, error) {
	if scope.UserID() == "" {
		return 0, ErrScopeRequired
	}
	if memoryID == "" {
		return 0, ErrSpendSignalInputRequired
	}
	gist, err := s.gists.EpisodicMemoryGist(ctx, scope, memoryID)
	if err != nil {
		return 0, err
	}
	if gist.SemanticStages == nil {
		return 0, ErrViewSemanticStageNotRisen
	}
	reached := int(gist.SemanticStage)
	if reached > len(gist.SemanticStages) {
		reached = len(gist.SemanticStages)
	}
	if reached < 1 {
		return 0, ErrViewSemanticStageNotRisen
	}
	return reached, nil
}

// signalUniverseTime is the universe time a spend-signal derives against: the clock
// a real recall would sync to (GREATEST of the guard baseline and real today), so a
// quote prices the post-sync decay state without writing the advance. The unborn
// clock falls back to the latest launched memory — the same guard baseline the sync
// uses — so a pre-clock universe quotes against its observable present, not a reset.
func (s *Service) signalUniverseTime(ctx context.Context, scope platform.UserScope) (time.Time, error) {
	baseline, err := s.signals.UniverseClock(ctx, scope)
	if err != nil {
		return time.Time{}, err
	}
	if baseline == nil {
		baseline, err = s.signals.LatestLaunchedUniverseTime(ctx, scope)
		if err != nil {
			return time.Time{}, err
		}
	}
	today := utcDate(s.now())
	if baseline != nil && baseline.After(today) {
		return *baseline, nil
	}
	return today, nil
}
