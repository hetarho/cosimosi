package pg

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/account"
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

func TestPalettePreferenceUpsertAndUserScope(t *testing.T) {
	pool := openAccountTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-account-%d", time.Now().UnixNano())
	userA := base + "-a"
	userB := base + "-b"
	cleanupAccountTestRows(t, pool, userA, userB)
	scopeA := mustUserScope(t, userA)
	scopeB := mustUserScope(t, userB)
	store := NewStore(pool.PgxPool())

	// Unset: no row for a fresh user (the use-case resolves this to the default id).
	if _, found, err := store.GetPalettePreference(ctx, scopeA); err != nil || found {
		t.Fatalf("GetPalettePreference(absent) = found %v err %v, want found=false", found, err)
	}

	// Upsert stores and echoes the chosen id.
	if got, err := store.UpsertPalettePreference(ctx, scopeA, "muted-dusk"); err != nil || got != "muted-dusk" {
		t.Fatalf("UpsertPalettePreference = %q err %v, want muted-dusk", got, err)
	}
	if got, found, err := store.GetPalettePreference(ctx, scopeA); err != nil || !found || got != "muted-dusk" {
		t.Fatalf("GetPalettePreference(set) = %q found %v err %v, want muted-dusk", got, found, err)
	}

	// A second upsert replaces the prior choice — one row per user.
	if got, err := store.UpsertPalettePreference(ctx, scopeA, "cosimosi-default"); err != nil || got != "cosimosi-default" {
		t.Fatalf("UpsertPalettePreference(replace) = %q err %v, want cosimosi-default", got, err)
	}
	if got, _, err := store.GetPalettePreference(ctx, scopeA); err != nil || got != "cosimosi-default" {
		t.Fatalf("GetPalettePreference(replaced) = %q err %v, want cosimosi-default", got, err)
	}

	// Per-user isolation: user A's preference is invisible to user B ([U1]).
	if _, found, err := store.GetPalettePreference(ctx, scopeB); err != nil || found {
		t.Fatalf("GetPalettePreference(other user) = found %v err %v, want found=false", found, err)
	}

	var rows int
	if err := pool.PgxPool().QueryRow(ctx, "SELECT count(*) FROM palette_preferences WHERE user_id = $1", userA).Scan(&rows); err != nil {
		t.Fatalf("count rows failed: %v", err)
	}
	if rows != 1 {
		t.Fatalf("palette_preferences rows for user = %d, want 1", rows)
	}
}

func TestMoodColorWriteKeepsOnePerUserAndMovesAggregateAtomically(t *testing.T) {
	pool := openAccountTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-mood-color-%d", time.Now().UnixNano())
	userA := base + "-a"
	userB := base + "-b"
	userC := base + "-c"
	cleanupAccountTestRows(t, pool, userA, userB, userC)
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

func cleanupAccountTestRows(t *testing.T, pool *platformdb.Pool, userIDs ...string) {
	t.Helper()

	for _, userID := range userIDs {
		if strings.TrimSpace(userID) == "" {
			t.Fatal("cleanup requires a user id")
		}
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		for _, userID := range userIDs {
			if _, err := pool.PgxPool().Exec(ctx, "DELETE FROM mood_colors WHERE user_id = $1", userID); err != nil {
				t.Fatalf("cleanup mood_colors failed: %v", err)
			}
			if _, err := pool.PgxPool().Exec(ctx, "DELETE FROM palette_preferences WHERE user_id = $1", userID); err != nil {
				t.Fatalf("cleanup palette_preferences failed: %v", err)
			}
		}
		if _, err := pool.PgxPool().Exec(ctx, `
			DELETE FROM mood_color_counts counts
			WHERE NOT EXISTS (
				SELECT 1 FROM mood_colors colors
				WHERE colors.mood = counts.mood AND colors.color = counts.color
			)
		`); err != nil {
			t.Fatalf("cleanup mood_color_counts failed: %v", err)
		}
	})
}
