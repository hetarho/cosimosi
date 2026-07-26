package rpc

import (
	"context"
	"errors"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/account"
	accountv1 "github.com/cosimosi/api/internal/gen/cosimosi/account/v1"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/apperr"
)

func TestDomainErrorMapsAccountErrors(t *testing.T) {
	t.Parallel()

	for _, testCase := range []struct {
		err        error
		wantCode   connect.Code
		wantReason string
	}{
		{account.ErrUnknownPaletteID, connect.CodeInvalidArgument, reasonUnknownPalette},
		{account.ErrScopeRequired, connect.CodeUnauthenticated, reasonScopeRequired},
		{account.ErrNotProvisioned, connect.CodeFailedPrecondition, reasonNotProvisioned},
		{account.ErrNicknameInvalid, connect.CodeInvalidArgument, reasonNicknameInvalid},
		{account.ErrTimezoneInvalid, connect.CodeInvalidArgument, reasonTimezoneInvalid},
		{account.ErrLocaleInvalid, connect.CodeInvalidArgument, reasonLocaleInvalid},
		{account.ErrInviteLinkUnavailable, connect.CodeFailedPrecondition, reasonInviteLinkUnavailable},
	} {
		got := domainError(testCase.err)
		info, ok := apperr.Info(got)
		if connect.CodeOf(got) != testCase.wantCode || !ok || info.GetReason() != testCase.wantReason || info.GetDomain() != "account" {
			t.Fatalf("domainError(%v) = code %s info %#v", testCase.err, connect.CodeOf(got), info)
		}
	}

	cause := errors.New("database exploded")
	got := domainError(cause)
	info, ok := apperr.Info(got)
	if connect.CodeOf(got) != connect.CodeInternal || !ok || info.GetReason() != apperr.ReasonInternal || !errors.Is(got, cause) {
		t.Fatalf("unknown error should be internal and retain its cause, got %v", got)
	}
}

type absentProfileStore struct{}

func (absentProfileStore) GetPalettePreference(context.Context, platform.UserScope) (string, bool, error) {
	return "", false, nil
}

func (absentProfileStore) UpsertPalettePreference(context.Context, platform.UserScope, string) (string, error) {
	return "", nil
}

func (absentProfileStore) GetUserProfile(context.Context, platform.UserScope) (account.Profile, bool, error) {
	return account.Profile{}, false, nil
}

func (absentProfileStore) UpdateUserProfile(context.Context, platform.UserScope, account.UpdateProfileInput) (account.Profile, bool, error) {
	return account.Profile{}, false, nil
}

func (absentProfileStore) ListAuthProviders(context.Context, platform.UserScope) ([]account.AuthProvider, error) {
	return nil, nil
}

func (absentProfileStore) RecordAuthProvider(context.Context, platform.UserScope, account.AuthProviderKind, string) error {
	return nil
}

func (absentProfileStore) CountRewardedInvitesByInviter(context.Context, platform.UserScope) (int64, error) {
	return 0, nil
}

type emptyDirectory struct{}

func (emptyDirectory) EmailFor(context.Context, string) (string, error) { return "", nil }
func (emptyDirectory) Identities(context.Context, string) ([]string, error) {
	return nil, nil
}

func TestGetProfileKeepsUnprovisionedProfileMessageAbsent(t *testing.T) {
	t.Parallel()
	service, err := account.NewService(account.ServiceDeps{
		Store:     absentProfileStore{},
		Directory: emptyDirectory{},
		Now:       func() time.Time { return time.Time{} },
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	server, err := NewServer(service)
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}
	ctx := platform.ContextWithUserID(context.Background(), "unprovisioned")

	response, err := server.GetProfile(ctx, connect.NewRequest(&accountv1.GetProfileRequest{}))
	if err != nil {
		t.Fatalf("GetProfile failed: %v", err)
	}
	if response.Msg.GetProfile() != nil {
		t.Fatalf("profile = %#v, want absent", response.Msg.GetProfile())
	}
}
