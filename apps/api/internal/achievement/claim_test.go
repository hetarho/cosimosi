package achievement

import (
	"context"
	"errors"
	"testing"

	"github.com/cosimosi/api/internal/platform"
)

func newClaimService(t *testing.T, repo *fakeStore, twinkle *fakeTwinkleGranter, ornaments *fakeOrnamentGranter) *Service {
	t.Helper()
	service, err := NewService(AchievementServiceDeps{
		Repo:      repo,
		Twinkle:   twinkle,
		Ornaments: ornaments,
		// The fake is its own scheduler, so a test can assert the drain was armed inside the claim
		// transaction rather than after it.
		Settlements: repo,
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	return service
}

func TestClaimRefusesWhatItCannotPay(t *testing.T) {
	t.Parallel()
	repo := newFakeStore()
	twinkle := &fakeTwinkleGranter{}
	ornaments := &fakeOrnamentGranter{}
	service := newClaimService(t, repo, twinkle, ornaments)
	ctx := context.Background()
	scope := testScope(t)

	if _, err := service.ClaimAchievement(ctx, scope, "diary_first"); !errors.Is(err, ErrUnknownAchievementID) {
		t.Fatalf("unpublished id = %v, want ErrUnknownAchievementID", err)
	}
	// A met condition is a PRECONDITION for the reward, never the payout: an unachieved row credits
	// nothing at all.
	if _, err := service.ClaimAchievement(ctx, scope, "first_diary"); !errors.Is(err, ErrAchievementNotAchieved) {
		t.Fatalf("unachieved id = %v, want ErrAchievementNotAchieved", err)
	}
	if _, err := service.ClaimAchievement(ctx, platform.UserScope{}, "first_diary"); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("unscoped = %v, want ErrScopeRequired", err)
	}
	if twinkle.calls != 0 || ornaments.calls != 0 {
		t.Fatalf("a refused claim paid something: twinkle %d ornament %d", twinkle.calls, ornaments.calls)
	}
	if len(repo.claimedAt) != 0 {
		t.Fatalf("a refused claim stamped a row: %v", repo.claimedAt)
	}
}

// A repeat claim is an idempotent REPLAY returning the same reward, not a refusal: refusing would
// strand the reward in exactly the crash window between the stamp and the credit.
func TestClaimTwiceCreditsThroughTheSameDedupKey(t *testing.T) {
	t.Parallel()
	repo := newFakeStore()
	repo.achieve("first_diary")
	twinkle := &fakeTwinkleGranter{}
	service := newClaimService(t, repo, twinkle, &fakeOrnamentGranter{})
	ctx := context.Background()
	scope := testScope(t)

	first, err := service.ClaimAchievement(ctx, scope, "first_diary")
	if err != nil {
		t.Fatalf("first claim failed: %v", err)
	}
	second, err := service.ClaimAchievement(ctx, scope, "first_diary")
	if err != nil {
		t.Fatalf("replayed claim failed: %v", err)
	}
	if first.TwinkleAmount != second.TwinkleAmount || first.OrnamentID != second.OrnamentID {
		t.Fatalf("replay paid differently: %+v vs %+v", first, second)
	}
	if repo.claimIDs["first_diary"] != "first_diary" {
		t.Fatalf("claim id = %q, want the achievement id (derived, not minted)", repo.claimIDs["first_diary"])
	}
	// The dedup key is identical across both attempts, which is what makes the LEDGER credit once.
	if twinkle.claimID != "first_diary" {
		t.Fatalf("dedup key = %q", twinkle.claimID)
	}
	// Only the first attempt changed the row; the second fell through as a replay.
	if repo.claimCalls != 2 {
		t.Fatalf("claim statements = %d, want one per attempt", repo.claimCalls)
	}
}

// The claim commits BEFORE any credit, so a granter failure leaves a recoverable state rather than a
// lost reward — and the next attempt heals it.
func TestClaimStampsBeforePayingAndHealsOnRetry(t *testing.T) {
	t.Parallel()
	repo := newFakeStore()
	repo.achieve("first_recall")
	twinkle := &fakeTwinkleGranter{err: errors.New("ledger unavailable")}
	service := newClaimService(t, repo, twinkle, &fakeOrnamentGranter{})
	ctx := context.Background()
	scope := testScope(t)

	if _, err := service.ClaimAchievement(ctx, scope, "first_recall"); !errors.Is(err, ErrRewardUnavailable) {
		t.Fatalf("granter failure = %v, want ErrRewardUnavailable", err)
	}
	if _, claimed := repo.claimedAt["first_recall"]; !claimed {
		t.Fatal("the claim was rolled back, which would lose the reward instead of healing it")
	}

	twinkle.err = nil
	healed, err := service.ClaimAchievement(ctx, scope, "first_recall")
	if err != nil {
		t.Fatalf("healing claim failed: %v", err)
	}
	if healed.TwinkleAmount <= 0 {
		t.Fatalf("healing claim paid %+v", healed)
	}
}

// A claim rolled back before the commit pays nothing: the payout runs after the transaction, never
// inside it.
func TestClaimPaysNothingWhenTheStampDoesNotCommit(t *testing.T) {
	t.Parallel()
	repo := newFakeStore()
	repo.achieve("first_diary")
	repo.commitError = errors.New("commit failed")
	twinkle := &fakeTwinkleGranter{}
	service := newClaimService(t, repo, twinkle, &fakeOrnamentGranter{})

	if _, err := service.ClaimAchievement(context.Background(), testScope(t), "first_diary"); err == nil {
		t.Fatal("a failed commit still returned success")
	}
	if twinkle.calls != 0 {
		t.Fatalf("a failed commit paid %d times", twinkle.calls)
	}
}

// Exactly one leg, mirroring the catalog's XOR reward — and the stardust leg answers the balance
// after the credit for the reveal.
func TestClaimPaysExactlyOneLeg(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	scope := testScope(t)

	stardust := newFakeStore()
	stardust.achieve("diary_5")
	twinkle := &fakeTwinkleGranter{}
	ornaments := &fakeOrnamentGranter{}
	result, err := newClaimService(t, stardust, twinkle, ornaments).ClaimAchievement(ctx, scope, "diary_5")
	if err != nil {
		t.Fatalf("stardust claim failed: %v", err)
	}
	if result.TwinkleAmount <= 0 || result.OrnamentID != "" || result.TwinkleTotal != result.TwinkleAmount {
		t.Fatalf("stardust claim = %+v", result)
	}
	if ornaments.calls != 0 {
		t.Fatal("a stardust claim granted an ornament")
	}

	capstone := newFakeStore()
	capstone.achieve("star_500")
	twinkle = &fakeTwinkleGranter{}
	ornaments = &fakeOrnamentGranter{}
	result, err = newClaimService(t, capstone, twinkle, ornaments).ClaimAchievement(ctx, scope, "star_500")
	if err != nil {
		t.Fatalf("ornament claim failed: %v", err)
	}
	if result.OrnamentID == "" || result.TwinkleAmount != 0 || result.TwinkleTotal != 0 {
		t.Fatalf("ornament claim = %+v", result)
	}
	if twinkle.calls != 0 {
		t.Fatal("an ornament claim credited stardust")
	}
	if ornaments.ornamentID != result.OrnamentID || ornaments.claimID != "star_500" {
		t.Fatalf("ornament granter got %q under claim %q", ornaments.ornamentID, ornaments.claimID)
	}
}

// The READ derives `achieved` from the counter, so anything it shows as achieved must be claimable.
// The two can legitimately disagree — a release that adds a tier on an existing counter, or lowers a
// target, leaves qualifying users achieved-by-derivation with no row, because rows are written only
// when a counter is next reported — so the claim promotes rather than refusing what the UI offered.
func TestClaimPromotesACounterTheReadAlreadyCallsAchieved(t *testing.T) {
	t.Parallel()
	store := newFakeStore()
	// The counter meets diary_5's target, but no progress row was ever written for it.
	store.counters[CounterDiaryWritten] = 5
	twinkle := &fakeTwinkleGranter{}
	service := newClaimService(t, store, twinkle, &fakeOrnamentGranter{})

	result, err := service.ClaimAchievement(context.Background(), testScope(t), "diary_5")
	if err != nil {
		t.Fatalf("claiming a derived-achieved row failed: %v", err)
	}
	if result.TwinkleAmount <= 0 {
		t.Fatalf("promoted claim paid %+v", result)
	}
	if _, achieved := store.achievedAt["diary_5"]; !achieved {
		t.Fatal("the promotion did not stamp achieved_at")
	}
	if _, claimed := store.claimedAt["diary_5"]; !claimed {
		t.Fatal("the promotion did not stamp claimed_at")
	}
	if twinkle.calls != 1 {
		t.Fatalf("promoted claim credited %d times", twinkle.calls)
	}
}

// The success path closes the pair: the stamp says the reward landed, and the drain was armed inside
// the claim transaction rather than after it.
func TestClaimSettlesAndArmsTheDrainInsideTheTransaction(t *testing.T) {
	t.Parallel()
	repo := newFakeStore()
	repo.achieve("first_diary")
	service := newClaimService(t, repo, &fakeTwinkleGranter{}, &fakeOrnamentGranter{})

	if _, err := service.ClaimAchievement(context.Background(), testScope(t), "first_diary"); err != nil {
		t.Fatalf("claim failed: %v", err)
	}
	if _, paid := repo.paidAt["first_diary"]; !paid {
		t.Fatal("a paid claim was left unsettled, which is the state the drain retries forever")
	}
	if len(repo.scheduledFor) != 1 || repo.scheduledFor[0] != "first_diary" {
		t.Fatalf("scheduled drains = %v, want exactly the claimed row", repo.scheduledFor)
	}
}

// A payout refusal leaves the row claimed AND unsettled — the state the read reports and the drain
// picks up. Neither the stamp nor the drain is rolled back with it.
func TestClaimLeavesTheRowUnsettledWhenThePayoutRefuses(t *testing.T) {
	t.Parallel()
	repo := newFakeStore()
	repo.achieve("first_recall")
	twinkle := &fakeTwinkleGranter{err: errors.New("ledger unavailable")}
	service := newClaimService(t, repo, twinkle, &fakeOrnamentGranter{})
	ctx := context.Background()
	scope := testScope(t)

	if _, err := service.ClaimAchievement(ctx, scope, "first_recall"); !errors.Is(err, ErrRewardUnavailable) {
		t.Fatalf("payout refusal = %v, want ErrRewardUnavailable", err)
	}
	if _, claimed := repo.claimedAt["first_recall"]; !claimed {
		t.Fatal("the stamp was rolled back, which would lose the reward instead of recording the debt")
	}
	if _, paid := repo.paidAt["first_recall"]; paid {
		t.Fatal("an unpaid reward was stamped as settled")
	}
	if len(repo.scheduledFor) != 1 {
		t.Fatalf("scheduled drains = %v, want the claim transaction to have armed one", repo.scheduledFor)
	}

	// The drain replays the idempotent leg and settles, with no press from the user.
	twinkle.err = nil
	if err := service.SettleClaims(ctx, scope); err != nil {
		t.Fatalf("SettleClaims failed: %v", err)
	}
	if _, paid := repo.paidAt["first_recall"]; !paid {
		t.Fatal("the drain did not settle the claim")
	}
	// A second drain finds nothing to do and credits nothing more.
	credited := twinkle.calls
	if err := service.SettleClaims(ctx, scope); err != nil {
		t.Fatalf("second SettleClaims failed: %v", err)
	}
	if twinkle.calls != credited {
		t.Fatalf("the drain credited %d more times over a settled row", twinkle.calls-credited)
	}
}

// A settle failure AFTER a successful credit is not a payout failure: the reward has arrived, so the
// claim reports success and the row simply stays unsettled for the drain to re-stamp.
func TestClaimSucceedsWhenOnlyTheSettleStampFails(t *testing.T) {
	t.Parallel()
	repo := newFakeStore()
	repo.achieve("first_diary")
	repo.settleError = errors.New("stamp unavailable")
	twinkle := &fakeTwinkleGranter{}
	service := newClaimService(t, repo, twinkle, &fakeOrnamentGranter{})

	result, err := service.ClaimAchievement(context.Background(), testScope(t), "first_diary")
	if err != nil {
		t.Fatalf("a credited claim whose stamp failed = %v, want success", err)
	}
	if result.TwinkleAmount <= 0 {
		t.Fatalf("claim paid %+v", result)
	}
	if _, paid := repo.paidAt["first_diary"]; paid {
		t.Fatal("the failing stamp somehow landed")
	}
	if twinkle.calls != 1 {
		t.Fatalf("credited %d times", twinkle.calls)
	}
}

// A replay of an unsettled claim pays through and settles: the press is still a valid recovery, not
// only the worker's drain.
func TestReplayOfAnUnsettledClaimPaysThroughAndSettles(t *testing.T) {
	t.Parallel()
	repo := newFakeStore()
	repo.achieve("first_recall")
	twinkle := &fakeTwinkleGranter{err: errors.New("ledger unavailable")}
	service := newClaimService(t, repo, twinkle, &fakeOrnamentGranter{})
	ctx := context.Background()
	scope := testScope(t)

	if _, err := service.ClaimAchievement(ctx, scope, "first_recall"); !errors.Is(err, ErrRewardUnavailable) {
		t.Fatalf("first claim = %v, want ErrRewardUnavailable", err)
	}
	twinkle.err = nil
	if _, err := service.ClaimAchievement(ctx, scope, "first_recall"); err != nil {
		t.Fatalf("replayed claim failed: %v", err)
	}
	if _, paid := repo.paidAt["first_recall"]; !paid {
		t.Fatal("the replay paid but did not settle")
	}
	// A settled row needs no drain, so the replay after it arms nothing new.
	armed := len(repo.scheduledFor)
	if _, err := service.ClaimAchievement(ctx, scope, "first_recall"); err != nil {
		t.Fatalf("third claim failed: %v", err)
	}
	if len(repo.scheduledFor) != armed {
		t.Fatalf("a settled row armed another drain: %v", repo.scheduledFor)
	}
}

// A counter still short of the target is the genuine refusal — nothing is promoted and nothing paid.
func TestClaimRefusesACounterShortOfItsTarget(t *testing.T) {
	t.Parallel()
	store := newFakeStore()
	store.counters[CounterDiaryWritten] = 4
	twinkle := &fakeTwinkleGranter{}
	service := newClaimService(t, store, twinkle, &fakeOrnamentGranter{})

	if _, err := service.ClaimAchievement(context.Background(), testScope(t), "diary_5"); !errors.Is(err, ErrAchievementNotAchieved) {
		t.Fatalf("short counter = %v, want ErrAchievementNotAchieved", err)
	}
	if len(store.achievedAt) != 0 || len(store.claimedAt) != 0 || twinkle.calls != 0 {
		t.Fatalf("a refused claim wrote or paid something: %+v", store)
	}
}
