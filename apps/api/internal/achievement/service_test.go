package achievement

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

func testScope(t *testing.T) platform.UserScope {
	t.Helper()
	scope, err := platform.NewUserScope("achievement-test-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	return scope
}

// testRepo is the fake's full surface: the repository, plus the settlement scheduler it doubles as
// so a claim test can see what the claim transaction armed.
type testRepo interface {
	Repo
	SettlementScheduler
}

func newTestService(t *testing.T, repo testRepo) *Service {
	t.Helper()
	service, err := NewService(AchievementServiceDeps{
		Repo:        repo,
		Twinkle:     &fakeTwinkleGranter{},
		Ornaments:   &fakeOrnamentGranter{},
		Settlements: repo,
	})
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
	repo := &tornReadStore{fakeStore: *newFakeStore()}
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
type tornReadStore struct {
	fakeStore
	progressRead      bool
	progressReadFirst bool
}

func (r *tornReadStore) ListProgress(context.Context, platform.UserScope) ([]ProgressRecord, error) {
	r.progressRead = true
	r.progressReadFirst = true
	return []ProgressRecord{{AchievementID: "diary_5"}}, nil
}

func (r *tornReadStore) ListCounters(context.Context, platform.UserScope) (map[CounterKey]int64, error) {
	if !r.progressRead {
		r.progressReadFirst = false
	}
	return map[CounterKey]int64{CounterDiaryWritten: 5}, nil
}

// fakeTwinkleGranter and fakeOrnamentGranter record what a claim paid. Both count calls, because a
// replay must credit through the same dedup key rather than a second time.
type fakeTwinkleGranter struct {
	calls   int
	claimID string
	amount  int
	total   int
	err     error
}

func (g *fakeTwinkleGranter) EarnAchievementReward(
	_ context.Context,
	_ platform.UserScope,
	claimID string,
	amount int,
) (int, error) {
	g.calls++
	g.claimID = claimID
	g.amount = amount
	if g.err != nil {
		return 0, g.err
	}
	g.total += amount
	return g.total, nil
}

type fakeOrnamentGranter struct {
	calls      int
	claimID    string
	ornamentID string
	err        error
}

func (g *fakeOrnamentGranter) Grant(
	_ context.Context,
	_ platform.UserScope,
	claimID string,
	ornamentID string,
) error {
	g.calls++
	g.claimID = claimID
	g.ornamentID = ornamentID
	return g.err
}

func TestNewServiceRequiresItsDependencies(t *testing.T) {
	t.Parallel()
	if _, err := NewService(AchievementServiceDeps{
		Twinkle:   &fakeTwinkleGranter{},
		Ornaments: &fakeOrnamentGranter{},
	}); !errors.Is(err, ErrRepoRequired) {
		t.Fatalf("NewService without repo = %v, want ErrRepoRequired", err)
	}
	// Unconditional, in every environment: a service that records claims it cannot pay would strand
	// rewards in the one window the claim/payout pairing exists to heal.
	if _, err := NewService(AchievementServiceDeps{
		Repo:    newFakeStore(),
		Twinkle: &fakeTwinkleGranter{},
	}); !errors.Is(err, ErrGrantersRequired) {
		t.Fatalf("NewService without the ornament granter = %v, want ErrGrantersRequired", err)
	}
	if _, err := NewService(AchievementServiceDeps{
		Repo:      newFakeStore(),
		Ornaments: &fakeOrnamentGranter{},
	}); !errors.Is(err, ErrGrantersRequired) {
		t.Fatalf("NewService without the twinkle granter = %v, want ErrGrantersRequired", err)
	}
	// Also unconditional: a root with no drain would put every crash between the stamp and the credit
	// back on the user to notice and press again.
	if _, err := NewService(AchievementServiceDeps{
		Repo:      newFakeStore(),
		Twinkle:   &fakeTwinkleGranter{},
		Ornaments: &fakeOrnamentGranter{},
	}); !errors.Is(err, ErrSettlementSchedulerRequired) {
		t.Fatalf("NewService without the settlement scheduler = %v, want ErrSettlementSchedulerRequired", err)
	}
}

// A user with no rows in either table gets the full catalog at zero progress, in the catalog's own
// order ([A4][U9]).
func TestListAchievementsAnswersFullCatalogAtZero(t *testing.T) {
	t.Parallel()
	service := newTestService(t, newFakeStore())
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
		if entry.Progress != 0 || entry.Achieved || entry.Claimed || entry.RewardSettled || !entry.AchievedAt.IsZero() {
			t.Fatalf("%s: fresh user entry = %+v, want zero progress", entry.ID, entry)
		}
	}
}

func TestListAchievementsDerivesAndClampsProgress(t *testing.T) {
	t.Parallel()
	store := newFakeStore()
	store.counters[CounterDiaryWritten] = 3541
	store.counters[CounterSemanticStageDepth] = 2
	service := newTestService(t, store)
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
	store := newFakeStore()
	store.achievedAt["first_diary"] = achievedAt
	store.achievedAt["first_recall"] = achievedAt
	store.claimedAt["first_diary"] = claimedAt
	store.claimIDs["first_diary"] = "first_diary"
	service := newTestService(t, store)
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

// Claimed and settled are two facts on the wire, not one. A claimed-and-unpaid row must read
// differently from a claimed-and-paid one, or the client hides the affordance the recovery needs.
func TestListAchievementsReportsUnpaidDistinctlyFromPaid(t *testing.T) {
	t.Parallel()
	achievedAt := time.Date(2026, 7, 1, 12, 0, 0, 0, time.UTC)
	store := newFakeStore()
	for _, id := range []string{"first_diary", "first_recall"} {
		store.achievedAt[id] = achievedAt
		store.claimedAt[id] = achievedAt.Add(time.Hour)
		store.claimIDs[id] = id
	}
	store.paidAt["first_diary"] = achievedAt.Add(2 * time.Hour)
	service := newTestService(t, store)
	entries, err := service.ListAchievements(context.Background(), testScope(t))
	if err != nil {
		t.Fatalf("ListAchievements failed: %v", err)
	}
	byID := make(map[string]Entry, len(entries))
	for _, entry := range entries {
		byID[entry.ID] = entry
	}
	if entry := byID["first_diary"]; !entry.Claimed || !entry.RewardSettled {
		t.Fatalf("a settled claim = %+v, want claimed and settled", entry)
	}
	if entry := byID["first_recall"]; !entry.Claimed || entry.RewardSettled {
		t.Fatalf("an unsettled claim = %+v, want claimed and NOT settled", entry)
	}
}

func TestListAchievementsRequiresScope(t *testing.T) {
	t.Parallel()
	service := newTestService(t, newFakeStore())
	if _, err := service.ListAchievements(context.Background(), platform.UserScope{}); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("unscoped read = %v, want ErrScopeRequired", err)
	}
}

func TestPurgeUserGuardsAndDelegates(t *testing.T) {
	t.Parallel()
	repo := newFakeStore()
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
