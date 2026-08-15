package pg

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/account"
	accounttestregistry "github.com/cosimosi/api/internal/account/testregistry"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
)

type signupTestDirectory struct {
	identities map[string][]string
}

func (d signupTestDirectory) EmailFor(context.Context, string) (string, error) { return "", nil }
func (d signupTestDirectory) EmailVerifiedAt(context.Context, string) (time.Time, error) {
	return time.Now().UTC(), nil
}
func (d signupTestDirectory) Identities(_ context.Context, userID string) ([]string, error) {
	return append([]string(nil), d.identities[userID]...), nil
}

type signupTestInviteGranter struct{}

func (signupTestInviteGranter) Grant(context.Context, platform.UserScope, string) error { return nil }

type signupTestBonusGranter struct{}

func (signupTestBonusGranter) Grant(context.Context, platform.UserScope) error { return nil }

func TestMoodColorWriteKeepsOnePerUserAndMovesAggregateAtomically(t *testing.T) {
	pool := openAccountTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-mood-color-%d", time.Now().UnixNano())
	userA := base + "-a"
	userB := base + "-b"
	userC := base + "-c"
	claimMoodColorAggregate(t, pool, []account.Mood{account.MoodJoy, account.MoodCalm}, userA, userB, userC)
	store := NewStore(pool.PgxPool())
	scopeA := mustUserScope(t, userA)
	scopeB := mustUserScope(t, userB)
	scopeC := mustUserScope(t, userC)

	first := account.MoodColor{Mood: account.MoodJoy, Color: "#ca53b8"}
	if _, err := store.SetMoodColor(ctx, scopeA, first, account.HueBucket(first.Color)); err != nil {
		t.Fatalf("SetMoodColor(first): %v", err)
	}
	replacement := account.MoodColor{Mood: account.MoodJoy, Color: "#688cb4"}
	if _, err := store.SetMoodColor(
		ctx,
		scopeA,
		replacement,
		account.HueBucket(replacement.Color),
	); err != nil {
		t.Fatalf("SetMoodColor(replacement): %v", err)
	}
	rows, err := store.ListMoodColors(ctx, scopeA)
	if err != nil || len(rows) != 1 || rows[0] != replacement {
		t.Fatalf("ListMoodColors = %+v err %v, want replacement only", rows, err)
	}
	stats, err := store.ListMoodColorStats(ctx, account.MoodJoy, 3)
	if err != nil || len(stats) != 1 || stats[0].BucketCount != 1 ||
		stats[0].TotalCount != 1 || stats[0].SwatchColor != replacement.Color {
		t.Fatalf("stats after replacement = %+v err %v", stats, err)
	}
	if _, err := store.SetMoodColor(
		ctx,
		scopeB,
		replacement,
		account.HueBucket(replacement.Color),
	); err != nil {
		t.Fatalf("SetMoodColor(second user): %v", err)
	}
	stats, err = store.ListMoodColorStats(ctx, account.MoodJoy, 3)
	if err != nil || len(stats) != 1 || stats[0].BucketCount != 2 || stats[0].TotalCount != 2 {
		t.Fatalf("stats after second user = %+v err %v", stats, err)
	}

	// Two simultaneous first writes still leave one user row and one aggregate contribution.
	start := make(chan struct{})
	errs := make(chan error, 2)
	for _, candidate := range []account.MoodColor{
		{Mood: account.MoodCalm, Color: "#5eb093"},
		{Mood: account.MoodCalm, Color: "#85a870"},
	} {
		go func(candidate account.MoodColor) {
			<-start
			_, err := store.SetMoodColor(
				ctx,
				scopeC,
				candidate,
				account.HueBucket(candidate.Color),
			)
			errs <- err
		}(candidate)
	}
	close(start)
	for range 2 {
		if err := <-errs; err != nil {
			t.Fatalf("concurrent SetMoodColor: %v", err)
		}
	}
	rows, err = store.ListMoodColors(ctx, scopeC)
	if err != nil || len(rows) != 1 || rows[0].Mood != account.MoodCalm {
		t.Fatalf("concurrent ListMoodColors = %+v err %v, want one CALM row", rows, err)
	}
	stats, err = store.ListMoodColorStats(ctx, account.MoodCalm, 3)
	if err != nil || len(stats) != 1 || stats[0].BucketCount != 1 || stats[0].TotalCount != 1 {
		t.Fatalf("stats after concurrent first writes = %+v err %v", stats, err)
	}
}

// Two buckets holding one choice each are equally popular, so the order has to come from somewhere
// that is not the hue circle. The aggregate stamps when a colour first arrived and ranks the earlier
// one first — otherwise "most chosen" and "next most chosen" swap on a number nobody chose.
func TestMoodColorStatsBreakAnEqualTieByFirstArrival(t *testing.T) {
	pool := openAccountTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-mood-color-tie-%d", time.Now().UnixNano())
	early := base + "-early"
	late := base + "-late"
	claimMoodColorAggregate(t, pool, []account.Mood{account.MoodStress}, early, late)
	store := NewStore(pool.PgxPool())

	// A violet at bucket 10 and a teal at bucket 5: the later arrival sits at the LOWER bucket
	// number, so an ordering that fell through to hue_bucket would put it first.
	later := account.MoodColor{Mood: account.MoodStress, Color: "#4eb9ad"}
	earlier := account.MoodColor{Mood: account.MoodStress, Color: "#b98cea"}
	if _, err := store.SetMoodColor(ctx, mustUserScope(t, early), earlier, account.HueBucket(earlier.Color)); err != nil {
		t.Fatalf("SetMoodColor(earlier): %v", err)
	}
	if _, err := store.SetMoodColor(ctx, mustUserScope(t, late), later, account.HueBucket(later.Color)); err != nil {
		t.Fatalf("SetMoodColor(later): %v", err)
	}

	stats, err := store.ListMoodColorStats(ctx, account.MoodStress, 3)
	if err != nil || len(stats) != 2 {
		t.Fatalf("tied stats = %+v err %v, want two buckets", stats, err)
	}
	if stats[0].SwatchColor != earlier.Color || stats[1].SwatchColor != later.Color {
		t.Fatalf("tie order = %+v, want the earlier arrival first", stats)
	}
	if stats[0].BucketCount != 1 || stats[0].TotalCount != 2 {
		t.Fatalf("tied counts = %+v", stats)
	}
}

func TestSignUpPersistsProviderAndBoundInviteIdempotentlyWithoutLedgerWrites(t *testing.T) {
	pool := openAccountTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-account-signup-%d", time.Now().UnixNano())
	cleanupAccountIdentityRows(t, pool, base)
	store := NewStore(pool.PgxPool())
	inviterID := base + "-inviter"
	inviteeID := base + "-invitee"
	concurrentID := base + "-concurrent"
	inviterScope := mustUserScope(t, inviterID)
	if _, created, err := store.CreateUserIfAbsent(ctx, inviterScope, account.SignUpInput{
		Nickname: "inviter",
		Timezone: "UTC",
		Locale:   "en",
	}, nil); err != nil || !created {
		t.Fatalf("create inviter = created %v err %v", created, err)
	}

	signer, err := account.NewHMACInviteSigner(make([]byte, 32))
	if err != nil {
		t.Fatalf("NewHMACInviteSigner failed: %v", err)
	}
	service, err := account.NewService(account.ServiceDeps{
		Store:              store,
		Directory:          signupTestDirectory{identities: map[string][]string{inviteeID: {"google"}}},
		InviteSigner:       signer,
		InviteGranter:      signupTestInviteGranter{},
		SignupBonusGranter: signupTestBonusGranter{},
		Achievements:       account.NoAchievementRecorder{},
		Now:                func() time.Time { return time.Now().UTC() },
		NewID:              func() string { return base + "-invite" },
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	link, err := service.GetInviteLink(ctx, inviterScope)
	if err != nil {
		t.Fatalf("GetInviteLink failed: %v", err)
	}
	profile, bound, err := service.SignUp(ctx, mustUserScope(t, inviteeID), account.SignUpInput{
		Nickname:    "  invited user  ",
		Timezone:    "Asia/Seoul",
		Locale:      "not-shipped",
		InviteToken: link.Token,
	})
	if err != nil || !bound || profile.Nickname != "invited user" || profile.Locale != "en" {
		t.Fatalf("SignUp = %#v bound %v err %v", profile, bound, err)
	}

	var providers int
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT count(*) FROM auth_providers WHERE user_id = $1 AND provider = 'GOOGLE'",
		inviteeID,
	).Scan(&providers); err != nil || providers != 1 {
		t.Fatalf("provider rows = %d err %v, want 1", providers, err)
	}
	var createdAt, boundAt time.Time
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT created_at, bound_at FROM invites WHERE invitee_user_id = $1",
		inviteeID,
	).Scan(&createdAt, &boundAt); err != nil {
		t.Fatalf("read bound invite: %v", err)
	}
	if !boundAt.After(createdAt) {
		t.Fatalf("invite created_at=%v bound_at=%v, want bind after token issue", createdAt, boundAt)
	}
	if rebound, err := store.BindInviteToInvitee(ctx, mustUserScope(t, inviteeID), account.Invite{
		ID:            base + "-other-invite",
		InviterUserID: inviterID,
		Token:         link.Token + "-other",
		CreatedAt:     createdAt,
		BoundAt:       boundAt,
	}); err != nil || rebound {
		t.Fatalf("second invite for same invitee = bound %v err %v, want best-effort refusal", rebound, err)
	}
	if rebound, err := store.BindInviteToInvitee(ctx, mustUserScope(t, base+"-id-collision-invitee"), account.Invite{
		ID:            base + "-invite",
		InviterUserID: inviterID,
		Token:         link.Token + "-id-collision",
		CreatedAt:     createdAt,
		BoundAt:       boundAt,
	}); err == nil || rebound {
		t.Fatalf("invite id collision = bound %v err %v, want integrity error", rebound, err)
	}

	replayed, replayBound, err := service.SignUp(ctx, mustUserScope(t, inviteeID), account.SignUpInput{
		Nickname:    "overwrite attempt",
		Timezone:    "UTC",
		Locale:      "ko",
		InviteToken: "another-token",
	})
	if err != nil || replayBound || replayed.Nickname != profile.Nickname || replayed.Timezone != profile.Timezone {
		t.Fatalf("replayed SignUp = %#v bound %v err %v", replayed, replayBound, err)
	}

	start := make(chan struct{})
	results := make(chan account.Profile, 2)
	errs := make(chan error, 2)
	for _, nickname := range []string{"first concurrent", "second concurrent"} {
		nickname := nickname
		go func() {
			<-start
			got, _, signUpErr := service.SignUp(ctx, mustUserScope(t, concurrentID), account.SignUpInput{
				Nickname: nickname,
				Timezone: "UTC",
				Locale:   "en",
			})
			results <- got
			errs <- signUpErr
		}()
	}
	close(start)
	left, right := <-results, <-results
	if err := <-errs; err != nil {
		t.Fatalf("concurrent SignUp failed: %v", err)
	}
	if err := <-errs; err != nil {
		t.Fatalf("concurrent SignUp failed: %v", err)
	}
	if left.Nickname != right.Nickname {
		t.Fatalf("concurrent SignUp returned different rows: %#v / %#v", left, right)
	}

	settleable, err := store.FindSettleableInviteForInvitee(ctx, mustUserScope(t, inviteeID))
	if err != nil || settleable == nil || settleable.Token != link.Token {
		t.Fatalf("FindSettleableInviteForInvitee = %#v err %v", settleable, err)
	}
	if err := store.MarkInviteRewarded(ctx, inviterScope, settleable.InviteID, time.Now().UTC()); err != nil {
		t.Fatalf("MarkInviteRewarded failed: %v", err)
	}
	if pending, err := store.FindSettleableInviteForInvitee(ctx, mustUserScope(t, inviteeID)); err != nil || pending != nil {
		t.Fatalf("settleable after mark = %#v err %v, want absent", pending, err)
	}

	for _, userID := range []string{inviteeID, concurrentID} {
		var ledgerRows int
		if err := pool.PgxPool().QueryRow(ctx,
			"SELECT count(*) FROM twinkle_ledger_entries WHERE user_id = $1",
			userID,
		).Scan(&ledgerRows); err != nil || ledgerRows != 0 {
			t.Fatalf("signup ledger rows for %s = %d err %v, want 0", userID, ledgerRows, err)
		}
	}
}

func TestInviteSettlementLockSerializesSameInviter(t *testing.T) {
	pool := openAccountTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	store := NewStore(pool.PgxPool())
	scope := mustUserScope(t, fmt.Sprintf("test-account-lock-%d", time.Now().UnixNano()))
	firstEntered := make(chan struct{})
	releaseFirst := make(chan struct{})
	firstDone := make(chan error, 1)
	go func() {
		firstDone <- store.WithInviteSettlementLock(ctx, scope, func() error {
			close(firstEntered)
			<-releaseFirst
			return nil
		})
	}()
	<-firstEntered

	secondEntered := make(chan struct{})
	secondDone := make(chan error, 1)
	go func() {
		secondDone <- store.WithInviteSettlementLock(ctx, scope, func() error {
			close(secondEntered)
			return nil
		})
	}()
	select {
	case <-secondEntered:
		t.Fatal("same-inviter settlement lock did not serialize callbacks")
	case <-time.After(100 * time.Millisecond):
	}
	close(releaseFirst)
	if err := <-firstDone; err != nil {
		t.Fatalf("first lock failed: %v", err)
	}
	if err := <-secondDone; err != nil {
		t.Fatalf("second lock failed: %v", err)
	}
}

func mustUserScope(t *testing.T, userID string) platform.UserScope {
	t.Helper()
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope(%s) failed: %v", userID, err)
	}
	return scope
}

func openAccountTestPool(t *testing.T) *platformdb.Pool {
	t.Helper()

	url := os.Getenv("COSIMOSI_TEST_DATABASE_URL")
	if url == "" {
		url = os.Getenv(platformdb.EnvDatabaseURL)
	}
	if url == "" {
		t.Skip("set COSIMOSI_TEST_DATABASE_URL or DATABASE_URL after starting the local postgres service")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := platformdb.Open(ctx, platformdb.Config{URL: url})
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// mood_color_counts carries no user_id, so a test asserting on the aggregate projection cannot
// scope its expectations to its own users — it can only own the moods registered to this package.
// Claiming a mood empties its aggregate rows before the test runs and again afterwards, which makes
// the projection deterministic beside other packages sharing the database.
func claimMoodColorAggregate(
	t *testing.T,
	pool *platformdb.Pool,
	moods []account.Mood,
	userIDs ...string,
) {
	t.Helper()

	for _, userID := range userIDs {
		if strings.TrimSpace(userID) == "" {
			t.Fatal("cleanup requires a user id")
		}
	}
	if len(moods) == 0 {
		t.Fatal("claiming the mood color aggregate requires at least one mood")
	}
	claimed := make([]string, 0, len(moods))
	for _, mood := range moods {
		owner, ok := accounttestregistry.MoodColorAggregateOwnerOf(string(mood))
		if !ok || owner != accounttestregistry.MoodColorAggregateOwnerAccountTests {
			t.Fatalf("mood %q is not registered to account aggregate tests", mood)
		}
		claimed = append(claimed, string(mood))
	}
	purge := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		for _, userID := range userIDs {
			if _, err := pool.PgxPool().Exec(ctx, "DELETE FROM mood_colors WHERE user_id = $1", userID); err != nil {
				t.Fatalf("cleanup mood_colors failed: %v", err)
			}
		}
		if _, err := pool.PgxPool().Exec(
			ctx,
			"DELETE FROM mood_color_counts WHERE mood = ANY($1::text[])",
			claimed,
		); err != nil {
			t.Fatalf("cleanup mood_color_counts failed: %v", err)
		}
	}
	purge()
	t.Cleanup(purge)
}
