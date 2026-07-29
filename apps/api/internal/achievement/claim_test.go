package achievement

import (
	"context"
	"errors"
	"testing"

	"github.com/cosimosi/api/internal/platform"
)

func newClaimService(t *testing.T, repo *fakeStore, twinkle *fakeTwinkleGranter, ornaments *fakeOrnamentGranter) *Service {
	t.Helper()
	service, err := NewService(AchievementServiceDeps{Repo: repo, Twinkle: twinkle, Ornaments: ornaments})
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
