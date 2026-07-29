package main

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/account"
	accountpg "github.com/cosimosi/api/internal/account/pg"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/apperr"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	platformsupabase "github.com/cosimosi/api/internal/platform/supabase"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/cosimosi/api/internal/twinkle"
)

type profileZoneStore struct {
	profile account.Profile
}

type withdrawalCompositionMemoryStore struct {
	scheduledDedupKey string
	cancelledDedupKey string
}

func (s *withdrawalCompositionMemoryStore) EnqueueJob(
	_ context.Context,
	_ platform.UserScope,
	job memory.Job,
) (memory.Job, error) {
	if job.DedupKey != nil {
		s.scheduledDedupKey = *job.DedupKey
	}
	return job, nil
}

func (s *withdrawalCompositionMemoryStore) CancelUserJob(
	_ context.Context,
	_ platform.UserScope,
	_ memory.JobKind,
	dedupKey string,
) error {
	s.cancelledDedupKey = dedupKey
	return nil
}

func (*withdrawalCompositionMemoryStore) PurgeUser(
	context.Context,
	platform.UserScope,
	string,
) error {
	return nil
}

type withdrawalCompositionTwinkleStore struct{}

func (withdrawalCompositionTwinkleStore) PurgeUser(
	context.Context,
	platform.UserScope,
) error {
	return nil
}

type withdrawalCompositionStorePurger struct{}

func (withdrawalCompositionStorePurger) PurgeName() string { return "store" }

func (withdrawalCompositionStorePurger) PurgeUser(
	context.Context,
	platform.UserScope,
) error {
	return nil
}

type withdrawalCompositionAchievementPurger struct{}

func (withdrawalCompositionAchievementPurger) PurgeName() string { return "achievement" }

func (withdrawalCompositionAchievementPurger) PurgeUser(
	context.Context,
	platform.UserScope,
) error {
	return nil
}

func TestAPIWithdrawalCompositionUsesOneMemoryIdentity(t *testing.T) {
	t.Parallel()
	store := &withdrawalCompositionMemoryStore{}
	composition, err := newWithdrawalComposition(
		store,
		store,
		withdrawalCompositionTwinkleStore{},
		withdrawalCompositionStorePurger{},
		withdrawalCompositionAchievementPurger{},
	)
	if err != nil {
		t.Fatalf("newWithdrawalComposition failed: %v", err)
	}
	scope, err := platform.NewUserScope("api-withdrawal-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	identity, err := memory.WithdrawalSweepJobIdentity(scope)
	if err != nil {
		t.Fatalf("WithdrawalSweepJobIdentity failed: %v", err)
	}

	if err := composition.scheduler.Schedule(
		context.Background(),
		scope,
		time.Now().Add(time.Hour),
	); err != nil {
		t.Fatalf("Schedule failed: %v", err)
	}
	if err := composition.scheduler.Cancel(context.Background(), scope); err != nil {
		t.Fatalf("Cancel failed: %v", err)
	}
	if store.scheduledDedupKey != identity.DedupKey() ||
		store.cancelledDedupKey != store.scheduledDedupKey {
		t.Fatalf(
			"withdrawal identities = scheduled %q cancelled %q want %q",
			store.scheduledDedupKey,
			store.cancelledDedupKey,
			identity.DedupKey(),
		)
	}
	if len(composition.purgers) != 4 ||
		composition.purgers[0].PurgeName() != "memory" ||
		composition.purgers[1].PurgeName() != "twinkle" ||
		composition.purgers[2].PurgeName() != "store" ||
		composition.purgers[3].PurgeName() != "achievement" {
		t.Fatalf("withdrawal purgers = %#v", composition.purgers)
	}
}

func (s profileZoneStore) InSignupTx(ctx context.Context, fn func(account.Store) error) error {
	return fn(s)
}

func (profileZoneStore) WithInviteSettlementLock(
	_ context.Context,
	_ platform.UserScope,
	fn func() error,
) error {
	return fn()
}

func (s profileZoneStore) GetUserProfile(context.Context, platform.UserScope) (account.Profile, bool, error) {
	return s.profile, true, nil
}

func (profileZoneStore) CreateUserIfAbsent(context.Context, platform.UserScope, account.SignUpInput, *account.AuthProvider) (account.Profile, bool, error) {
	return account.Profile{}, false, nil
}

func (profileZoneStore) UpdateUserProfile(context.Context, platform.UserScope, account.UpdateProfileInput) (account.Profile, bool, error) {
	return account.Profile{}, false, nil
}

func (profileZoneStore) ListMoodColors(context.Context, platform.UserScope) ([]account.MoodColor, error) {
	return nil, nil
}

func (profileZoneStore) SetMoodColor(context.Context, platform.UserScope, account.MoodColor, int32) (account.MoodColor, error) {
	return account.MoodColor{}, nil
}

func (profileZoneStore) ListMoodColorStats(context.Context, account.Mood, int32) ([]account.MoodColorStatCount, error) {
	return nil, nil
}

func (profileZoneStore) ListAuthProviders(context.Context, platform.UserScope) ([]account.AuthProvider, error) {
	return nil, nil
}

func (profileZoneStore) RecordAuthProvider(context.Context, platform.UserScope, account.AuthProviderKind, string) error {
	return nil
}

func (profileZoneStore) BindInviteToInvitee(context.Context, platform.UserScope, account.Invite) (bool, error) {
	return false, nil
}

func (profileZoneStore) FindSettleableInviteForInvitee(context.Context, platform.UserScope) (*account.SettleableInvite, error) {
	return nil, nil
}

func (profileZoneStore) CountRewardedInvitesByInviter(context.Context, platform.UserScope) (int64, error) {
	return 0, nil
}

func (profileZoneStore) MarkInviteRewarded(context.Context, platform.UserScope, string, time.Time) error {
	return nil
}

type accountNoInviteGranter struct{}

func (accountNoInviteGranter) Grant(context.Context, platform.UserScope, string) error { return nil }

type accountNoSignupBonusGranter struct{}

func (accountNoSignupBonusGranter) Grant(context.Context, platform.UserScope) error { return nil }

func TestProductionMemoryZoneAdapterBindsAccountReader(t *testing.T) {
	t.Parallel()
	source := platformsupabase.Fake{}
	service, err := account.NewService(account.ServiceDeps{
		Store:              profileZoneStore{profile: account.Profile{UserID: "u1", Timezone: "Asia/Seoul"}},
		Directory:          accountDirectoryAdapter{source: source},
		InviteGranter:      accountNoInviteGranter{},
		SignupBonusGranter: accountNoSignupBonusGranter{},
		Achievements:       account.NoAchievementRecorder{},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	scope, err := platform.NewUserScope("u1")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}

	location, err := (accountUserZone{service: service}).ZoneFor(context.Background(), scope)
	if err != nil || location.String() != "Asia/Seoul" {
		t.Fatalf("production zone adapter = %v, %v", location, err)
	}
}

func TestInviteSignerConfigurationFailsClosed(t *testing.T) {
	t.Setenv(apperr.EnvDeployEnvironment, "")
	t.Setenv(envInviteTokenSigningKey, "")
	signer, err := inviteSignerFromEnv()
	if err != nil {
		t.Fatalf("unset signer config failed: %v", err)
	}
	if _, ok := signer.(account.UnavailableInviteSigner); !ok {
		t.Fatalf("unset signer = %T, want UnavailableInviteSigner", signer)
	}

	t.Setenv(envInviteTokenSigningKey, "not-base64")
	if _, err := inviteSignerFromEnv(); err == nil {
		t.Fatal("invalid base64 signing key was accepted")
	}

	t.Setenv(envInviteTokenSigningKey, base64.StdEncoding.EncodeToString(make([]byte, 32)))
	signer, err = inviteSignerFromEnv()
	if err != nil {
		t.Fatalf("valid signer config failed: %v", err)
	}
	if _, ok := signer.(account.HMACInviteSigner); !ok {
		t.Fatalf("valid signer = %T, want HMACInviteSigner", signer)
	}
}

func TestProductionAccountCompositionRejectsMissingInviteSigningKey(t *testing.T) {
	t.Setenv(apperr.EnvDeployEnvironment, "production")
	t.Setenv(envInviteTokenSigningKey, "")
	source, ok := platformsupabase.NewDirectory(
		"https://example.supabase.co",
		"server-only-test-key",
		nil,
	)
	if !ok {
		t.Fatal("test Supabase directory did not compose")
	}

	_, _, err := accountServiceOption(
		nil,
		accountDirectoryAdapter{source: source},
		accountNoInviteGranter{},
		accountNoSignupBonusGranter{},
		account.NoAchievementRecorder{},
		withdrawalCompositionStorePurger{},
		withdrawalCompositionAchievementPurger{},
	)
	if err == nil || !strings.Contains(err.Error(), envInviteTokenSigningKey) {
		t.Fatalf("production account composition err = %v, want missing %s refusal", err, envInviteTokenSigningKey)
	}
}

func TestProductionAccountCompositionRejectsKeylessCredentialDirectory(t *testing.T) {
	t.Setenv(apperr.EnvDeployEnvironment, "production")
	t.Setenv(envInviteTokenSigningKey, base64.StdEncoding.EncodeToString(make([]byte, 32)))
	_, _, err := accountServiceOption(
		nil,
		accountDirectoryAdapter{source: platformsupabase.Fake{}},
		accountNoInviteGranter{},
		accountNoSignupBonusGranter{},
		account.NoAchievementRecorder{},
		withdrawalCompositionStorePurger{},
		withdrawalCompositionAchievementPurger{},
	)
	if err == nil {
		t.Fatal("production account composition accepted a keyless credential directory")
	}
}

func TestAdminAndAccountAdaptersTranslateTheSamePlatformDirectory(t *testing.T) {
	t.Parallel()
	createdAt := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	source := platformsupabase.Fake{
		Accounts: []platformsupabase.Account{{
			UserID:   "u1",
			Email:    "user@example.com",
			SignupAt: createdAt,
		}},
		IdentitiesByUser: map[string][]string{"u1": {"google"}},
	}
	accountAdapter := accountDirectoryAdapter{source: source}
	adminAdapter := adminAccountDirectory{source: source}

	email, err := accountAdapter.EmailFor(context.Background(), "u1")
	if err != nil || email != "user@example.com" {
		t.Fatalf("account adapter email = %q, %v", email, err)
	}
	accounts, _, err := adminAdapter.ListUsers(context.Background(), 0, 10, "")
	if err != nil || len(accounts) != 1 || accounts[0].SignupAt != createdAt {
		t.Fatalf("admin adapter accounts = %#v, %v", accounts, err)
	}
}

var errInjectedRewardMark = errors.New("injected rewarded-at failure")

type failOnceRewardMarkStore struct {
	account.Store
	failNext bool
}

func (s *failOnceRewardMarkStore) MarkInviteRewarded(
	ctx context.Context,
	scope platform.UserScope,
	inviteID string,
	rewardedAt time.Time,
) error {
	if s.failNext {
		s.failNext = false
		return errInjectedRewardMark
	}
	return s.Store.MarkInviteRewarded(ctx, scope, inviteID, rewardedAt)
}

func TestSignupSettlementCreditsFirstAndCrashReplayConverges(t *testing.T) {
	pool := openEconomyTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-signup-settlement-%d", time.Now().UnixNano())
	inviterID := base + "-inviter"
	inviteeID := base + "-invitee"
	cleanupSignupSettlementRows(t, pool, inviterID, inviteeID)

	source := platformsupabase.Fake{
		Accounts: []platformsupabase.Account{
			{UserID: inviterID, EmailVerifiedAt: time.Now().UTC()},
			{UserID: inviteeID, EmailVerifiedAt: time.Now().UTC()},
		},
		IdentitiesByUser: map[string][]string{
			inviterID: {"google"},
			inviteeID: {"google"},
		},
	}
	store := &failOnceRewardMarkStore{Store: accountpg.NewStore(pool.PgxPool())}
	inviteGranter := &accountInviteRewardGranter{}
	bonusGranter := &accountSignupBonusGranter{}
	signer, err := account.NewHMACInviteSigner(make([]byte, 32))
	if err != nil {
		t.Fatalf("NewHMACInviteSigner failed: %v", err)
	}
	accountService, err := account.NewService(account.ServiceDeps{
		Store:              store,
		Directory:          accountDirectoryAdapter{source: source},
		InviteSigner:       signer,
		InviteGranter:      inviteGranter,
		SignupBonusGranter: bonusGranter,
		Achievements:       account.NoAchievementRecorder{},
	})
	if err != nil {
		t.Fatalf("account.NewService failed: %v", err)
	}
	twinkleService, err := newTwinkleService(
		pool,
		&memorySpendSignals{},
		accountInviteResolver{service: accountService},
		accountTwinkleZone{service: accountService},
	)
	if err != nil {
		t.Fatalf("newTwinkleService failed: %v", err)
	}
	inviteGranter.service = twinkleService
	bonusGranter.service = twinkleService

	inviterScope := economyScope(t, inviterID)
	inviteeScope := economyScope(t, inviteeID)
	if _, _, err := accountService.SignUp(ctx, inviterScope, account.SignUpInput{
		Nickname: "inviter",
		Timezone: "UTC",
		Locale:   "en",
	}); err != nil {
		t.Fatalf("inviter SignUp failed: %v", err)
	}
	link, err := accountService.GetInviteLink(ctx, inviterScope)
	if err != nil {
		t.Fatalf("GetInviteLink failed: %v", err)
	}
	if _, bound, err := accountService.SignUp(ctx, inviteeScope, account.SignUpInput{
		Nickname:    "invitee",
		Timezone:    "UTC",
		Locale:      "en",
		InviteToken: link.Token,
	}); err != nil || !bound {
		t.Fatalf("invitee SignUp = bound %v err %v", bound, err)
	}
	if rows := countSignupSettlementLedgerRows(t, pool, inviterID, inviteeID); rows != 0 {
		t.Fatalf("signup wrote %d ledger rows, want 0", rows)
	}
	if _, err := twinkleService.ClaimInvite(ctx, inviteeScope, link.Token); !errors.Is(err, twinkle.ErrInviteNotEligible) {
		t.Fatalf("pre-launch wire-shaped ClaimInvite err = %v, want ErrInviteNotEligible", err)
	}
	if rows := countSignupSettlementLedgerRows(t, pool, inviterID, inviteeID); rows != 0 {
		t.Fatalf("pre-launch ClaimInvite wrote %d ledger rows, want 0", rows)
	}

	store.failNext = true
	if err := accountService.SettleSignup(ctx, inviteeScope); !errors.Is(err, errInjectedRewardMark) {
		t.Fatalf("first SettleSignup err = %v, want injected mark failure", err)
	}
	var rewardedAt *time.Time
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT rewarded_at FROM invites WHERE invitee_user_id = $1",
		inviteeID,
	).Scan(&rewardedAt); err != nil || rewardedAt != nil {
		t.Fatalf("rewarded_at after injected crash = %v err %v, want NULL", rewardedAt, err)
	}
	if rows := countSignupSettlementLedgerRows(t, pool, inviterID, inviteeID); rows != 3 {
		t.Fatalf("ledger rows after credits-before-mark crash = %d, want 3", rows)
	}

	if err := accountService.SettleSignup(ctx, inviteeScope); err != nil {
		t.Fatalf("replayed SettleSignup failed: %v", err)
	}
	if rows := countSignupSettlementLedgerRows(t, pool, inviterID, inviteeID); rows != 3 {
		t.Fatalf("ledger rows after replay = %d, want the same 3", rows)
	}
	var inviteID string
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT id, rewarded_at FROM invites WHERE invitee_user_id = $1",
		inviteeID,
	).Scan(&inviteID, &rewardedAt); err != nil || rewardedAt == nil {
		t.Fatalf("rewarded_at after replay = %v err %v, want stamped", rewardedAt, err)
	}
	keyRows, err := pool.PgxPool().Query(ctx,
		"SELECT dedup_key FROM twinkle_ledger_entries WHERE user_id = ANY($1::text[])",
		[]string{inviterID, inviteeID},
	)
	if err != nil {
		t.Fatalf("read settlement dedup keys: %v", err)
	}
	defer keyRows.Close()
	keys := map[string]bool{}
	for keyRows.Next() {
		var key string
		if err := keyRows.Scan(&key); err != nil {
			t.Fatalf("scan settlement dedup key: %v", err)
		}
		keys[key] = true
	}
	if err := keyRows.Err(); err != nil {
		t.Fatalf("iterate settlement dedup keys: %v", err)
	}
	for _, want := range []string{"invite:" + inviteID, "invite_signup:" + inviteID, "signup_bonus:" + inviteeID} {
		if !keys[want] {
			t.Fatalf("settlement dedup keys = %#v, missing %q", keys, want)
		}
	}

	inviterBalance, err := twinkleService.GetBalance(ctx, inviterScope)
	if err != nil {
		t.Fatalf("inviter balance failed: %v", err)
	}
	inviteeBalance, err := twinkleService.GetBalance(ctx, inviteeScope)
	if err != nil {
		t.Fatalf("invitee balance failed: %v", err)
	}
	if inviterBalance.General != values.TwinkleEarnInviteInviter {
		t.Fatalf("inviter general = %d, want %d", inviterBalance.General, values.TwinkleEarnInviteInviter)
	}
	wantInvitee := values.TwinkleEarnInviteInvitee + values.TwinkleEarnSignupBonus
	if inviteeBalance.General != wantInvitee {
		t.Fatalf("invitee general = %d, want %d", inviteeBalance.General, wantInvitee)
	}
}

func countSignupSettlementLedgerRows(t *testing.T, pool *platformdb.Pool, userIDs ...string) int {
	t.Helper()
	var rows int
	if err := pool.PgxPool().QueryRow(
		context.Background(),
		"SELECT count(*) FROM twinkle_ledger_entries WHERE user_id = ANY($1::text[])",
		userIDs,
	).Scan(&rows); err != nil {
		t.Fatalf("count settlement ledger rows: %v", err)
	}
	return rows
}

func cleanupSignupSettlementRows(t *testing.T, pool *platformdb.Pool, userIDs ...string) {
	t.Helper()
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, err := pool.PgxPool().Exec(ctx,
			"DELETE FROM invites WHERE user_id = ANY($1::text[]) OR invitee_user_id = ANY($1::text[])",
			userIDs,
		); err != nil {
			t.Fatalf("cleanup invites: %v", err)
		}
		for _, table := range []string{
			"twinkle_ledger_entries",
			"twinkle_balances",
			"auth_providers",
			"users",
		} {
			if _, err := pool.PgxPool().Exec(ctx,
				"DELETE FROM "+table+" WHERE user_id = ANY($1::text[])",
				userIDs,
			); err != nil {
				t.Fatalf("cleanup %s: %v", table, err)
			}
		}
	})
}
