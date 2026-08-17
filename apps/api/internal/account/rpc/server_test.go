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
	"google.golang.org/protobuf/reflect/protoreflect"
)

func TestDomainErrorMapsAccountErrors(t *testing.T) {
	t.Parallel()

	for _, testCase := range []struct {
		err        error
		wantCode   connect.Code
		wantReason string
	}{
		{account.ErrScopeRequired, connect.CodeUnauthenticated, reasonScopeRequired},
		{account.ErrNotProvisioned, connect.CodeFailedPrecondition, reasonNotProvisioned},
		{account.ErrSignupRequired, connect.CodeFailedPrecondition, reasonSignupRequired},
		{account.ErrNicknameInvalid, connect.CodeInvalidArgument, reasonNicknameInvalid},
		{account.ErrTimezoneInvalid, connect.CodeInvalidArgument, reasonTimezoneInvalid},
		{account.ErrLocaleInvalid, connect.CodeInvalidArgument, reasonLocaleInvalid},
		{account.ErrMoodInvalid, connect.CodeInvalidArgument, reasonMoodColorInvalid},
		{account.ErrColorInvalid, connect.CodeInvalidArgument, reasonMoodColorInvalid},
		{account.ErrInviteLinkUnavailable, connect.CodeFailedPrecondition, reasonInviteLinkUnavailable},
		{account.ErrNotWithdrawn, connect.CodeFailedPrecondition, reasonNotWithdrawn},
		{account.ErrRestoreWindowExpired, connect.CodeFailedPrecondition, reasonRestoreWindowExpired},
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

func TestMoodColorStatsWireCarriesAggregateFieldsOnly(t *testing.T) {
	t.Parallel()

	statsFields := (&accountv1.MoodColorStat{}).ProtoReflect().Descriptor().Fields()
	if statsFields.Len() != 3 {
		t.Fatalf("mood color stat fields = %d, want exactly 3", statsFields.Len())
	}
	for i, want := range []string{"bucket", "share", "swatch_color"} {
		if got := string(statsFields.Get(i).Name()); got != want {
			t.Fatalf("mood color stat field %d = %q, want %q", i, got, want)
		}
	}
	responseFields := (&accountv1.GetMoodColorStatsResponse{}).ProtoReflect().Descriptor().Fields()
	if responseFields.Len() != 1 || string(responseFields.Get(0).Name()) != "stats" {
		t.Fatalf("mood color stats response exposes unexpected fields: %v", responseFields)
	}
}

type signupRPCStore struct {
	absentProfileStore
	input account.SignUpInput
}

func (s *signupRPCStore) InSignupTx(ctx context.Context, fn func(account.Store) error) error {
	return fn(s)
}

func (s *signupRPCStore) CreateUserIfAbsent(
	_ context.Context,
	scope platform.UserScope,
	input account.SignUpInput,
	_ *account.AuthProvider,
) (account.Profile, bool, error) {
	s.input = input
	return account.Profile{
		UserID:   scope.UserID(),
		Nickname: input.Nickname,
		Timezone: input.Timezone,
		Locale:   input.Locale,
	}, true, nil
}

func TestSignUpHandlerMapsOnlyThePinnedWireFields(t *testing.T) {
	t.Parallel()
	requestFields := (&accountv1.SignUpRequest{}).ProtoReflect().Descriptor().Fields()
	responseFields := (&accountv1.SignUpResponse{}).ProtoReflect().Descriptor().Fields()
	if requestFields.Len() != 4 || responseFields.Len() != 4 {
		t.Fatalf("signup wire fields = request %d response %d, want exactly 4/4", requestFields.Len(), responseFields.Len())
	}
	for i, want := range []string{"nickname", "timezone", "locale", "invite_token"} {
		if got := string(requestFields.Get(i).Name()); got != want {
			t.Fatalf("request field %d = %q, want %q", i, got, want)
		}
	}
	for i, want := range []string{"nickname", "timezone", "locale", "invite_bound"} {
		if got := string(responseFields.Get(i).Name()); got != want {
			t.Fatalf("response field %d = %q, want %q", i, got, want)
		}
	}
	serviceMethods := accountv1.File_cosimosi_account_v1_account_proto.Services().ByName("AccountService").Methods()
	for _, forbidden := range []string{"AcceptInvite", "SettleSignup"} {
		if serviceMethods.ByName(protoreflect.Name(forbidden)) != nil {
			t.Fatalf("forbidden wire method %s exists", forbidden)
		}
	}

	store := &signupRPCStore{}
	service, err := account.NewService(account.ServiceDeps{
		Store:              store,
		Directory:          emptyDirectory{},
		InviteGranter:      emptyInviteGranter{},
		SignupBonusGranter: emptySignupBonusGranter{},
		Achievements:       account.NoAchievementRecorder{},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	server, err := NewServer(service)
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}
	response, err := server.SignUp(
		platform.ContextWithUserID(context.Background(), "new-user"),
		connect.NewRequest(&accountv1.SignUpRequest{
			Nickname:    "  cosimo  ",
			Timezone:    "UTC",
			Locale:      "not-shipped",
			InviteToken: "invalid-best-effort-token",
		}),
	)
	if err != nil {
		t.Fatalf("SignUp failed: %v", err)
	}
	if response.Msg.GetNickname() != "cosimo" || response.Msg.GetTimezone() != "UTC" ||
		response.Msg.GetLocale() != "en" || response.Msg.GetInviteBound() {
		t.Fatalf("SignUp response = %#v", response.Msg)
	}
	if store.input.InviteToken != "invalid-best-effort-token" {
		t.Fatalf("handler did not map invite token: %#v", store.input)
	}
}

type absentProfileStore struct{}

func (s absentProfileStore) InSignupTx(ctx context.Context, fn func(account.Store) error) error {
	return fn(s)
}

func (absentProfileStore) WithInviteSettlementLock(
	_ context.Context,
	_ platform.UserScope,
	fn func() error,
) error {
	return fn()
}

func (absentProfileStore) UserTimezones(context.Context, []string) (map[string]string, error) {
	return nil, nil
}

func (absentProfileStore) ListMoodColors(context.Context, platform.UserScope) ([]account.MoodColor, error) {
	return nil, nil
}

func (absentProfileStore) SetMoodColor(context.Context, platform.UserScope, account.MoodColor, int32) (account.MoodColor, error) {
	return account.MoodColor{}, nil
}

func (absentProfileStore) ListMoodColorStats(context.Context, account.Mood, int32) ([]account.MoodColorStatCount, error) {
	return nil, nil
}

func (absentProfileStore) GetUserProfile(context.Context, platform.UserScope) (account.Profile, bool, error) {
	return account.Profile{}, false, nil
}

func (absentProfileStore) CreateUserIfAbsent(context.Context, platform.UserScope, account.SignUpInput, *account.AuthProvider) (account.Profile, bool, error) {
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

func (absentProfileStore) BindInviteToInvitee(context.Context, platform.UserScope, account.Invite) (bool, error) {
	return false, nil
}

func (absentProfileStore) FindSettleableInviteForInvitee(context.Context, platform.UserScope) (*account.SettleableInvite, error) {
	return nil, nil
}

func (absentProfileStore) CountRewardedInvitesByInviter(context.Context, platform.UserScope) (int64, error) {
	return 0, nil
}

func (absentProfileStore) MarkInviteRewarded(context.Context, platform.UserScope, string, time.Time) error {
	return nil
}

type emptyDirectory struct{}

func (emptyDirectory) EmailFor(context.Context, string) (string, error) { return "", nil }
func (emptyDirectory) EmailVerifiedAt(context.Context, string) (time.Time, error) {
	return time.Time{}, nil
}
func (emptyDirectory) Identities(context.Context, string) ([]string, error) {
	return nil, nil
}

type emptyInviteGranter struct{}

func (emptyInviteGranter) Grant(context.Context, platform.UserScope, string) error { return nil }

type emptySignupBonusGranter struct{}

func (emptySignupBonusGranter) Grant(context.Context, platform.UserScope) error { return nil }

func TestGetProfileKeepsUnprovisionedProfileMessageAbsent(t *testing.T) {
	t.Parallel()
	service, err := account.NewService(account.ServiceDeps{
		Store:              absentProfileStore{},
		Directory:          emptyDirectory{},
		InviteGranter:      emptyInviteGranter{},
		SignupBonusGranter: emptySignupBonusGranter{},
		Achievements:       account.NoAchievementRecorder{},
		Now:                func() time.Time { return time.Time{} },
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
