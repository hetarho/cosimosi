package achievement

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

type fakeRepo struct {
	counters map[CounterKey]int64
	progress []ProgressRecord
	purged   []string
}

func (f *fakeRepo) ListCounters(context.Context, platform.UserScope) (map[CounterKey]int64, error) {
	return f.counters, nil
}

func (f *fakeRepo) ListProgress(context.Context, platform.UserScope) ([]ProgressRecord, error) {
	return f.progress, nil
}

func (f *fakeRepo) GetProgress(context.Context, platform.UserScope, string) (*ProgressRecord, error) {
	return nil, nil
}

func (f *fakeRepo) TouchCounter(context.Context, platform.UserScope, CounterKey) (bool, error) {
	return false, nil
}

func (f *fakeRepo) AddCounter(context.Context, platform.UserScope, CounterKey, int64) (int64, error) {
	return 0, nil
}

func (f *fakeRepo) RaiseCounter(context.Context, platform.UserScope, CounterKey, int64) (int64, error) {
	return 0, nil
}

func (f *fakeRepo) MarkAchieved(context.Context, platform.UserScope, string) (bool, error) {
	return false, nil
}

func (f *fakeRepo) MarkClaimed(context.Context, platform.UserScope, string, string) (bool, error) {
	return false, nil
}

func (f *fakeRepo) PurgeUser(_ context.Context, scope platform.UserScope) error {
	f.purged = append(f.purged, scope.UserID())
	return nil
}

func (f *fakeRepo) InAchievementTx(ctx context.Context, fn func(tx Store) error) error {
	return fn(f)
}

func testScope(t *testing.T) platform.UserScope {
	t.Helper()
	scope, err := platform.NewUserScope("achievement-test-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	return scope
}

func newTestService(t *testing.T, repo Repo) *Service {
	t.Helper()
	service, err := NewService(AchievementServiceDeps{Repo: repo})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	return service
}

// The two pure functions and the monotonicity rule the domain owns.
func TestPureEvaluationAndMonotonicityRule(t *testing.T) {
	t.Parallel()
	if Achieved(4, 5) || !Achieved(5, 5) || !Achieved(6, 5) {
		t.Fatal("Achieved is not counter >= target")
	}
	if Progress(3541, 200) != 200 || Progress(3, 200) != 3 {
		t.Fatal("Progress does not clamp to the target")
	}
	for _, delta := range []int64{0, -1} {
		if err := RequireForwardDelta(delta); !errors.Is(err, ErrNonPositiveDelta) {
			t.Fatalf("RequireForwardDelta(%d) = %v, want ErrNonPositiveDelta", delta, err)
		}
	}
	if err := RequireForwardDelta(1); err != nil {
		t.Fatalf("RequireForwardDelta(1) = %v", err)
	}
}

// The mode is the definition's, not the caller's: adding to a reach counter would let four stage-1
// gist views unlock the stage-4 row.
func TestRequireCounterModeBindsAStatementToItsKey(t *testing.T) {
	t.Parallel()
	if err := RequireCounterMode(CounterSemanticStageDepth, CounterModeAccumulate); !errors.Is(err, ErrCounterModeMismatch) {
		t.Fatalf("accumulating a reach key = %v, want ErrCounterModeMismatch", err)
	}
	if err := RequireCounterMode(CounterDiaryWritten, CounterModeReach); !errors.Is(err, ErrCounterModeMismatch) {
		t.Fatalf("raising an accumulate key = %v, want ErrCounterModeMismatch", err)
	}
	if err := RequireCounterMode(CounterKey("streak_days"), CounterModeAccumulate); !errors.Is(err, ErrUnknownCounterKey) {
		t.Fatalf("unknown key = %v, want ErrUnknownCounterKey", err)
	}
	if err := RequireCounterMode(CounterSemanticStageDepth, CounterModeReach); err != nil {
		t.Fatalf("raising a reach key = %v", err)
	}
	if err := RequireCounterMode(CounterDiaryWritten, CounterModeAccumulate); err != nil {
		t.Fatalf("accumulating an accumulate key = %v", err)
	}
}

func TestRequireCatalogIDRefusesAnUnpublishedID(t *testing.T) {
	t.Parallel()
	if err := RequireCatalogID("diary_first"); !errors.Is(err, ErrUnknownAchievementID) {
		t.Fatalf("typo'd id = %v, want ErrUnknownAchievementID", err)
	}
	if err := RequireCatalogID(""); !errors.Is(err, ErrUnknownAchievementID) {
		t.Fatalf("empty id = %v, want ErrUnknownAchievementID", err)
	}
	if err := RequireCatalogID("first_diary"); err != nil {
		t.Fatalf("published id = %v", err)
	}
}

// The read is two statements, and progress is read first so that a recorder committing between them
// cannot produce the contradiction "achieved, 0/5": counters are monotonic, so the later counter
// read is always a superset of what was true when the progress row was written.
func TestListAchievementsNeverContradictsItself(t *testing.T) {
	t.Parallel()
	repo := &tornReadRepo{fakeRepo: fakeRepo{}}
	service := newTestService(t, repo)
	entries, err := service.ListAchievements(context.Background(), testScope(t))
	if err != nil {
		t.Fatalf("ListAchievements failed: %v", err)
	}
	if !repo.progressReadFirst {
		t.Fatal("counters were read before progress, which allows an achieved row at zero progress")
	}
	for _, entry := range entries {
		if entry.Achieved && entry.Progress != entry.Condition.Target {
			t.Fatalf("%s: achieved with progress %d/%d", entry.ID, entry.Progress, entry.Condition.Target)
		}
	}
}

// tornReadRepo answers the worst interleaving the read can meet: the progress row exists, and the
// counter read that follows sees the write that produced it.
type tornReadRepo struct {
	fakeRepo
	progressRead      bool
	progressReadFirst bool
}

func (r *tornReadRepo) ListProgress(context.Context, platform.UserScope) ([]ProgressRecord, error) {
	r.progressRead = true
	r.progressReadFirst = true
	return []ProgressRecord{{AchievementID: "diary_5"}}, nil
}

func (r *tornReadRepo) ListCounters(context.Context, platform.UserScope) (map[CounterKey]int64, error) {
	if !r.progressRead {
		r.progressReadFirst = false
	}
	return map[CounterKey]int64{CounterDiaryWritten: 5}, nil
}

func TestNewServiceRequiresRepo(t *testing.T) {
	t.Parallel()
	if _, err := NewService(AchievementServiceDeps{}); !errors.Is(err, ErrRepoRequired) {
		t.Fatalf("NewService without repo = %v, want ErrRepoRequired", err)
	}
}

// A user with no rows in either table gets the full catalog at zero progress, in the catalog's own
// order ([A4][U9]).
func TestListAchievementsAnswersFullCatalogAtZero(t *testing.T) {
	t.Parallel()
	service := newTestService(t, &fakeRepo{})
	entries, err := service.ListAchievements(context.Background(), testScope(t))
	if err != nil {
		t.Fatalf("ListAchievements failed: %v", err)
	}
	rows := Catalog()
	if len(entries) != len(rows) {
		t.Fatalf("entries = %d, want the whole catalog %d", len(entries), len(rows))
	}
	for i, entry := range entries {
		if entry.ID != rows[i].ID {
			t.Fatalf("entry %d = %q, want the catalog order's %q", i, entry.ID, rows[i].ID)
		}
		if entry.Progress != 0 || entry.Achieved || entry.Claimed || !entry.AchievedAt.IsZero() {
			t.Fatalf("%s: fresh user entry = %+v, want zero progress", entry.ID, entry)
		}
	}
}

func TestListAchievementsDerivesAndClampsProgress(t *testing.T) {
	t.Parallel()
	service := newTestService(t, &fakeRepo{
		counters: map[CounterKey]int64{
			CounterDiaryWritten:       3541,
			CounterSemanticStageDepth: 2,
		},
	})
	entries, err := service.ListAchievements(context.Background(), testScope(t))
	if err != nil {
		t.Fatalf("ListAchievements failed: %v", err)
	}
	byID := make(map[string]Entry, len(entries))
	for _, entry := range entries {
		byID[entry.ID] = entry
	}
	// Accumulate counter far past the deepest target: progress clamps, achieved derives.
	if entry := byID["diary_200"]; entry.Progress != 200 || !entry.Achieved {
		t.Fatalf("diary_200 = %+v, want progress clamped to 200 and achieved", entry)
	}
	// Reach counter mid-ladder: the shallower row is achieved, the deeper is partial.
	if entry := byID["gist_stage_2"]; entry.Progress != 2 || !entry.Achieved {
		t.Fatalf("gist_stage_2 = %+v, want achieved at 2", entry)
	}
	if entry := byID["gist_stage_4"]; entry.Progress != 2 || entry.Achieved {
		t.Fatalf("gist_stage_4 = %+v, want partial 2/4", entry)
	}
	// Derivation never invents an achieved_at: only a stored row carries one.
	if entry := byID["diary_200"]; !entry.AchievedAt.IsZero() {
		t.Fatalf("diary_200 achieved_at = %v, want zero without a progress row", entry.AchievedAt)
	}
}

// The stored facts win: an achieved_at row is never un-achieved whatever the counter reads ([I1]),
// and claimed comes only from the row.
func TestListAchievementsReadsStoredProgressFacts(t *testing.T) {
	t.Parallel()
	achievedAt := time.Date(2026, 7, 1, 12, 0, 0, 0, time.UTC)
	claimedAt := achievedAt.Add(time.Hour)
	service := newTestService(t, &fakeRepo{
		progress: []ProgressRecord{
			{AchievementID: "first_diary", AchievedAt: achievedAt, ClaimedAt: &claimedAt, ClaimID: "claim-1"},
			{AchievementID: "first_recall", AchievedAt: achievedAt},
		},
	})
	entries, err := service.ListAchievements(context.Background(), testScope(t))
	if err != nil {
		t.Fatalf("ListAchievements failed: %v", err)
	}
	byID := make(map[string]Entry, len(entries))
	for _, entry := range entries {
		byID[entry.ID] = entry
	}
	if entry := byID["first_diary"]; !entry.Achieved || !entry.Claimed || !entry.AchievedAt.Equal(achievedAt) {
		t.Fatalf("first_diary = %+v, want achieved+claimed with the stored achieved_at", entry)
	}
	if entry := byID["first_recall"]; !entry.Achieved || entry.Claimed {
		t.Fatalf("first_recall = %+v, want achieved and unclaimed", entry)
	}
	// The counters map is empty here, so progress derives to 0 — but a stored row means it was
	// earned, and "achieved" beside 0/1 would read as a bug. This is also what keeps the pair honest
	// if a later release raises a target above what the user's counter reached.
	for _, id := range []string{"first_diary", "first_recall"} {
		entry := byID[id]
		if entry.Progress != entry.Condition.Target {
			t.Fatalf("%s: achieved with progress %d/%d", id, entry.Progress, entry.Condition.Target)
		}
	}
}

func TestListAchievementsRequiresScope(t *testing.T) {
	t.Parallel()
	service := newTestService(t, &fakeRepo{})
	if _, err := service.ListAchievements(context.Background(), platform.UserScope{}); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("unscoped read = %v, want ErrScopeRequired", err)
	}
}

func TestPurgeUserGuardsAndDelegates(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{}
	service := newTestService(t, repo)
	if err := service.PurgeUser(context.Background(), platform.UserScope{}); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("unscoped purge = %v, want ErrScopeRequired", err)
	}
	scope := testScope(t)
	if err := service.PurgeUser(context.Background(), scope); err != nil {
		t.Fatalf("PurgeUser failed: %v", err)
	}
	purger := NewWithdrawalPurger(repo)
	if purger.PurgeName() != "achievement" {
		t.Fatalf("PurgeName = %q", purger.PurgeName())
	}
	if err := purger.PurgeUser(context.Background(), scope); err != nil {
		t.Fatalf("WithdrawalPurger.PurgeUser failed: %v", err)
	}
	if len(repo.purged) != 2 {
		t.Fatalf("purge calls = %d, want both entry points to delegate", len(repo.purged))
	}
}
