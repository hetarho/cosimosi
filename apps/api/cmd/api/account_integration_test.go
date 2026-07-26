package main

import (
	"context"
	"encoding/base64"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/account"
	"github.com/cosimosi/api/internal/platform"
	platformsupabase "github.com/cosimosi/api/internal/platform/supabase"
)

type profileZoneStore struct {
	profile account.Profile
}

func (s profileZoneStore) GetUserProfile(context.Context, platform.UserScope) (account.Profile, bool, error) {
	return s.profile, true, nil
}

func (profileZoneStore) UpdateUserProfile(context.Context, platform.UserScope, account.UpdateProfileInput) (account.Profile, bool, error) {
	return account.Profile{}, false, nil
}

func (profileZoneStore) GetPalettePreference(context.Context, platform.UserScope) (string, bool, error) {
	return "", false, nil
}

func (profileZoneStore) UpsertPalettePreference(context.Context, platform.UserScope, string) (string, error) {
	return "", nil
}

func (profileZoneStore) ListAuthProviders(context.Context, platform.UserScope) ([]account.AuthProvider, error) {
	return nil, nil
}

func (profileZoneStore) RecordAuthProvider(context.Context, platform.UserScope, account.AuthProviderKind, string) error {
	return nil
}

func (profileZoneStore) CountRewardedInvitesByInviter(context.Context, platform.UserScope) (int64, error) {
	return 0, nil
}

func TestProductionMemoryZoneAdapterBindsAccountReader(t *testing.T) {
	t.Parallel()
	source := platformsupabase.Fake{}
	service, err := account.NewService(account.ServiceDeps{
		Store:     profileZoneStore{profile: account.Profile{UserID: "u1", Timezone: "Asia/Seoul"}},
		Directory: accountDirectoryAdapter{source: source},
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
