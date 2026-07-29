package achievement

import (
	"context"
	"fmt"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// fakeStore is the ONE in-memory stand-in for the two tables, shared by every test in this package.
// It is one fake rather than one per use-case because the counter writes and the claim stamp are two
// faces of the same pair of tables — split fakes would each stub out the other half, and a test could
// then pass against a half nobody implemented.
//
// Every method mirrors the SQL's own semantics, which is what makes assertions about idempotency and
// mode meaningful here: `TouchCounter` reports first touch, `AddCounter`/`RaiseCounter` refuse the
// wrong mode, `MarkAchieved`/`MarkClaimed` report whether THIS call changed the row.
type fakeStore struct {
	counters   map[CounterKey]int64
	modes      map[CounterKey]CounterMode
	touched    []CounterKey
	achievedAt map[string]time.Time
	claimedAt  map[string]time.Time
	claimIDs   map[string]string

	// Failure and observation knobs.
	failTouchOn CounterKey
	claimCalls  int
	commitError error
	purged      []string
}

func newFakeStore() *fakeStore {
	return &fakeStore{
		counters:   map[CounterKey]int64{},
		modes:      map[CounterKey]CounterMode{},
		achievedAt: map[string]time.Time{},
		claimedAt:  map[string]time.Time{},
		claimIDs:   map[string]string{},
	}
}

// achieve marks a row achieved without going through a counter, so a claim test can arrange its
// precondition in one line.
func (f *fakeStore) achieve(achievementID string) {
	f.achievedAt[achievementID] = time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
}

func (f *fakeStore) ListCounters(context.Context, platform.UserScope) (map[CounterKey]int64, error) {
	return f.counters, nil
}

func (f *fakeStore) ListProgress(context.Context, platform.UserScope) ([]ProgressRecord, error) {
	records := make([]ProgressRecord, 0, len(f.achievedAt))
	for id := range f.achievedAt {
		record, err := f.GetProgress(context.Background(), platform.UserScope{}, id)
		if err != nil || record == nil {
			continue
		}
		records = append(records, *record)
	}
	return records, nil
}

func (f *fakeStore) GetProgress(_ context.Context, _ platform.UserScope, achievementID string) (*ProgressRecord, error) {
	achieved, ok := f.achievedAt[achievementID]
	if !ok {
		return nil, nil
	}
	record := ProgressRecord{AchievementID: achievementID, AchievedAt: achieved}
	if claimed, isClaimed := f.claimedAt[achievementID]; isClaimed {
		stamp := claimed
		record.ClaimedAt = &stamp
		record.ClaimID = f.claimIDs[achievementID]
	}
	return &record, nil
}

func (f *fakeStore) TouchCounter(_ context.Context, _ platform.UserScope, key CounterKey) (bool, error) {
	if key == f.failTouchOn {
		return false, fmt.Errorf("touch refused: %s", key)
	}
	f.touched = append(f.touched, key)
	if _, exists := f.counters[key]; exists {
		return false, nil
	}
	f.counters[key] = 0
	return true, nil
}

func (f *fakeStore) AddCounter(_ context.Context, _ platform.UserScope, key CounterKey, delta int64) (int64, error) {
	if err := RequireCounterMode(key, CounterModeAccumulate); err != nil {
		return 0, err
	}
	f.modes[key] = CounterModeAccumulate
	f.counters[key] += delta
	return f.counters[key], nil
}

func (f *fakeStore) RaiseCounter(_ context.Context, _ platform.UserScope, key CounterKey, level int64) (int64, error) {
	if err := RequireCounterMode(key, CounterModeReach); err != nil {
		return 0, err
	}
	f.modes[key] = CounterModeReach
	f.counters[key] = max(f.counters[key], level)
	return f.counters[key], nil
}

func (f *fakeStore) MarkAchieved(_ context.Context, _ platform.UserScope, achievementID string) (bool, error) {
	if _, already := f.achievedAt[achievementID]; already {
		return false, nil
	}
	f.achieve(achievementID)
	return true, nil
}

// MarkClaimed mirrors the SQL exactly: it changes a row only when one exists and claimed_at is null.
func (f *fakeStore) MarkClaimed(_ context.Context, _ platform.UserScope, achievementID string, claimID string) (bool, error) {
	f.claimCalls++
	if _, achieved := f.achievedAt[achievementID]; !achieved {
		return false, nil
	}
	if _, claimed := f.claimedAt[achievementID]; claimed {
		return false, nil
	}
	f.claimedAt[achievementID] = time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
	f.claimIDs[achievementID] = claimID
	return true, nil
}

func (f *fakeStore) PurgeUser(_ context.Context, scope platform.UserScope) error {
	f.purged = append(f.purged, scope.UserID())
	return nil
}

func (f *fakeStore) InAchievementTx(ctx context.Context, fn func(tx Store) error) error {
	if err := fn(f); err != nil {
		return err
	}
	return f.commitError
}

// achievedIDs is the set of marked rows, for tests that assert which tiers a report reached.
func (f *fakeStore) achievedIDs() []string {
	ids := make([]string, 0, len(f.achievedAt))
	for id := range f.achievedAt {
		ids = append(ids, id)
	}
	return ids
}
