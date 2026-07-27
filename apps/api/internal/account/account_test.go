package account

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
	"sort"
	"sync"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

type fakeStore struct {
	mu             sync.Mutex
	settlementMu   sync.Mutex
	palettes       map[string]string
	profiles       map[string]Profile
	providers      map[string][]AuthProvider
	invites        map[string]SettleableInvite
	rewardedCounts map[string]int64
	getErr         error
	inviteFindErr  error
	putErr         error
	bindErr        error
	profileReads   int
	profileUpdates int
	providerWrites int
	bindWrites     int
	lastBound      Invite
}

func (f *fakeStore) InSignupTx(ctx context.Context, fn func(Store) error) error {
	f.mu.Lock()
	profiles := cloneMap(f.profiles)
	providers := cloneProviderMap(f.providers)
	invites := cloneMap(f.invites)
	providerWrites := f.providerWrites
	bindWrites := f.bindWrites
	lastBound := f.lastBound
	f.mu.Unlock()
	if err := fn(f); err != nil {
		f.mu.Lock()
		f.profiles = profiles
		f.providers = providers
		f.invites = invites
		f.providerWrites = providerWrites
		f.bindWrites = bindWrites
		f.lastBound = lastBound
		f.mu.Unlock()
		return err
	}
	return nil
}

func (f *fakeStore) WithInviteSettlementLock(
	_ context.Context,
	_ platform.UserScope,
	fn func() error,
) error {
	f.settlementMu.Lock()
	defer f.settlementMu.Unlock()
	return fn()
}

func cloneMap[K comparable, V any](source map[K]V) map[K]V {
	if source == nil {
		return nil
	}
	cloned := make(map[K]V, len(source))
	for key, value := range source {
		cloned[key] = value
	}
	return cloned
}

func cloneProviderMap(source map[string][]AuthProvider) map[string][]AuthProvider {
	if source == nil {
		return nil
	}
	cloned := make(map[string][]AuthProvider, len(source))
	for key, value := range source {
		cloned[key] = append([]AuthProvider(nil), value...)
	}
	return cloned
}

func (f *fakeStore) GetPalettePreference(_ context.Context, scope platform.UserScope) (string, bool, error) {
	if f.getErr != nil {
		return "", false, f.getErr
	}
	id, ok := f.palettes[scope.UserID()]
	return id, ok, nil
}

func (f *fakeStore) UpsertPalettePreference(_ context.Context, scope platform.UserScope, paletteID string) (string, error) {
	if f.putErr != nil {
		return "", f.putErr
	}
	if f.palettes == nil {
		f.palettes = map[string]string{}
	}
	f.palettes[scope.UserID()] = paletteID
	return paletteID, nil
}

func (f *fakeStore) GetUserProfile(_ context.Context, scope platform.UserScope) (Profile, bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.profileReads++
	if f.getErr != nil {
		return Profile{}, false, f.getErr
	}
	profile, ok := f.profiles[scope.UserID()]
	return profile, ok, nil
}

func (f *fakeStore) CreateUserIfAbsent(
	_ context.Context,
	scope platform.UserScope,
	input SignUpInput,
	provider *AuthProvider,
) (Profile, bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.putErr != nil {
		return Profile{}, false, f.putErr
	}
	if profile, ok := f.profiles[scope.UserID()]; ok {
		return profile, false, nil
	}
	if f.profiles == nil {
		f.profiles = map[string]Profile{}
	}
	profile := Profile{
		UserID:    scope.UserID(),
		Nickname:  input.Nickname,
		Timezone:  input.Timezone,
		Locale:    input.Locale,
		CreatedAt: time.Now().UTC(),
	}
	f.profiles[scope.UserID()] = profile
	if provider != nil {
		if f.providers == nil {
			f.providers = map[string][]AuthProvider{}
		}
		f.providers[scope.UserID()] = append(f.providers[scope.UserID()], *provider)
		f.providerWrites++
	}
	return profile, true, nil
}

func (f *fakeStore) UpdateUserProfile(_ context.Context, scope platform.UserScope, input UpdateProfileInput) (Profile, bool, error) {
	f.profileUpdates++
	if f.putErr != nil {
		return Profile{}, false, f.putErr
	}
	profile, ok := f.profiles[scope.UserID()]
	if !ok || profile.DeletedAt != nil {
		return Profile{}, false, nil
	}
	profile.Nickname = input.Nickname
	profile.Timezone = input.Timezone
	profile.Locale = input.Locale
	f.profiles[scope.UserID()] = profile
	return profile, true, nil
}

func (f *fakeStore) ListAuthProviders(_ context.Context, scope platform.UserScope) ([]AuthProvider, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	return append([]AuthProvider(nil), f.providers[scope.UserID()]...), nil
}

func (f *fakeStore) RecordAuthProvider(_ context.Context, scope platform.UserScope, kind AuthProviderKind, providerUserID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.providerWrites++
	if f.providers == nil {
		f.providers = map[string][]AuthProvider{}
	}
	for _, provider := range f.providers[scope.UserID()] {
		if provider.Kind == kind {
			return nil
		}
	}
	f.providers[scope.UserID()] = append(f.providers[scope.UserID()], AuthProvider{
		Kind:           kind,
		ProviderUserID: providerUserID,
	})
	return nil
}

func (f *fakeStore) BindInviteToInvitee(_ context.Context, scope platform.UserScope, invite Invite) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.putErr != nil {
		return false, f.putErr
	}
	if f.bindErr != nil {
		return false, f.bindErr
	}
	if f.invites == nil {
		f.invites = map[string]SettleableInvite{}
	}
	if _, exists := f.invites[scope.UserID()]; exists {
		return false, nil
	}
	for _, existing := range f.invites {
		if existing.Token == invite.Token {
			return false, nil
		}
	}
	if inviter, ok := f.profiles[invite.InviterUserID]; !ok || inviter.DeletedAt != nil ||
		invite.InviterUserID == scope.UserID() {
		return false, nil
	}
	f.invites[scope.UserID()] = SettleableInvite{
		InviteID:      invite.ID,
		InviterUserID: invite.InviterUserID,
		InviteeUserID: scope.UserID(),
		Token:         invite.Token,
	}
	f.bindWrites++
	f.lastBound = invite
	return true, nil
}

func (f *fakeStore) FindSettleableInviteForInvitee(_ context.Context, scope platform.UserScope) (*SettleableInvite, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.inviteFindErr != nil {
		return nil, f.inviteFindErr
	}
	if f.getErr != nil {
		return nil, f.getErr
	}
	invite, ok := f.invites[scope.UserID()]
	if !ok {
		return nil, nil
	}
	if inviter, ok := f.profiles[invite.InviterUserID]; !ok || inviter.DeletedAt != nil {
		return nil, nil
	}
	copy := invite
	return &copy, nil
}

func (f *fakeStore) CountRewardedInvitesByInviter(_ context.Context, scope platform.UserScope) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.rewardedCounts[scope.UserID()], f.getErr
}

func (f *fakeStore) MarkInviteRewarded(_ context.Context, scope platform.UserScope, inviteID string, _ time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.putErr != nil {
		return f.putErr
	}
	for inviteeID, invite := range f.invites {
		if invite.InviterUserID == scope.UserID() && invite.InviteID == inviteID {
			delete(f.invites, inviteeID)
			if f.rewardedCounts == nil {
				f.rewardedCounts = map[string]int64{}
			}
			f.rewardedCounts[scope.UserID()]++
			return nil
		}
	}
	return nil
}

type fakeDirectory struct {
	emails            map[string]string
	verifiedAt        map[string]time.Time
	identities        map[string][]string
	emailErr          error
	verifiedErr       error
	identitiesErr     error
	verificationReads int
}

func (f *fakeDirectory) EmailVerifiedAt(_ context.Context, userID string) (time.Time, error) {
	f.verificationReads++
	if f.verifiedErr != nil {
		return time.Time{}, f.verifiedErr
	}
	return f.verifiedAt[userID], nil
}

func (f *fakeDirectory) EmailFor(_ context.Context, userID string) (string, error) {
	if f.emailErr != nil {
		return "", f.emailErr
	}
	return f.emails[userID], nil
}

func (f *fakeDirectory) Identities(_ context.Context, userID string) ([]string, error) {
	if f.identitiesErr != nil {
		return nil, f.identitiesErr
	}
	return append([]string(nil), f.identities[userID]...), nil
}

type fakeInviteGranter struct {
	err    error
	grants int
	tokens []string
}

func (f *fakeInviteGranter) Grant(_ context.Context, _ platform.UserScope, token string) error {
	f.grants++
	f.tokens = append(f.tokens, token)
	return f.err
}

type fakeSignupBonusGranter struct {
	err    error
	grants int
}

type resolvingInviteGranter struct {
	mu      sync.Mutex
	service *Service
	grants  int
}

func (g *resolvingInviteGranter) Grant(
	ctx context.Context,
	scope platform.UserScope,
	token string,
) error {
	_, err := g.service.ResolveInviteSettlement(ctx, InviteSettlementRequest{
		Token:         token,
		InviteeUserID: scope.UserID(),
	})
	if err != nil {
		return err
	}
	g.mu.Lock()
	g.grants++
	g.mu.Unlock()
	return nil
}

func (f *fakeSignupBonusGranter) Grant(context.Context, platform.UserScope) error {
	f.grants++
	return f.err
}

func newTestService(t *testing.T, store Store) *Service {
	t.Helper()
	service, err := NewService(ServiceDeps{
		Store:              store,
		Directory:          &fakeDirectory{},
		InviteSigner:       UnavailableInviteSigner{},
		InviteGranter:      &fakeInviteGranter{},
		SignupBonusGranter: &fakeSignupBonusGranter{},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	return service
}

func mustScope(t *testing.T, userID string) platform.UserScope {
	t.Helper()
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope(%s) failed: %v", userID, err)
	}
	return scope
}

func provisionedProfile(userID string) Profile {
	return Profile{
		UserID:    userID,
		Nickname:  "cosimo",
		Timezone:  "UTC",
		Locale:    "en",
		CreatedAt: time.Date(2026, 7, 26, 1, 2, 3, 0, time.UTC),
	}
}

func TestNewServiceRequiresDependencies(t *testing.T) {
	t.Parallel()
	if _, err := NewService(ServiceDeps{}); !errors.Is(err, ErrStoreRequired) {
		t.Fatalf("NewService(empty) err = %v, want ErrStoreRequired", err)
	}
	if _, err := NewService(ServiceDeps{Store: &fakeStore{}}); !errors.Is(err, ErrDirectoryRequired) {
		t.Fatalf("NewService(no directory) err = %v, want ErrDirectoryRequired", err)
	}
	if _, err := NewService(ServiceDeps{Store: &fakeStore{}, Directory: &fakeDirectory{}}); !errors.Is(err, ErrInviteGranterRequired) {
		t.Fatalf("NewService(no invite granter) err = %v, want ErrInviteGranterRequired", err)
	}
	if _, err := NewService(ServiceDeps{
		Store:         &fakeStore{},
		Directory:     &fakeDirectory{},
		InviteGranter: &fakeInviteGranter{},
	}); !errors.Is(err, ErrSignupBonusGranterRequired) {
		t.Fatalf("NewService(no signup bonus granter) err = %v, want ErrSignupBonusGranterRequired", err)
	}
}

func TestGetReturnsDefaultWhenPaletteUnset(t *testing.T) {
	t.Parallel()
	service := newTestService(t, &fakeStore{profiles: map[string]Profile{"u1": provisionedProfile("u1")}})

	got, err := service.GetPalettePreference(context.Background(), mustScope(t, "u1"))
	if err != nil {
		t.Fatalf("GetPalettePreference failed: %v", err)
	}
	if got != DefaultPaletteID {
		t.Fatalf("unset get = %q, want %q", got, DefaultPaletteID)
	}
}

func TestSetThenGetPaletteRoundTrips(t *testing.T) {
	t.Parallel()
	store := &fakeStore{profiles: map[string]Profile{"u1": provisionedProfile("u1")}}
	service := newTestService(t, store)
	scope := mustScope(t, "u1")

	set, err := service.SetPalettePreference(context.Background(), scope, "muted-dusk")
	if err != nil || set != "muted-dusk" {
		t.Fatalf("SetPalettePreference = %q, %v", set, err)
	}
	got, err := service.GetPalettePreference(context.Background(), scope)
	if err != nil || got != "muted-dusk" {
		t.Fatalf("GetPalettePreference = %q, %v", got, err)
	}
}

func TestSetRejectsUnknownPaletteID(t *testing.T) {
	t.Parallel()
	store := &fakeStore{profiles: map[string]Profile{"u1": provisionedProfile("u1")}}
	service := newTestService(t, store)
	scope := mustScope(t, "u1")

	if _, err := service.SetPalettePreference(context.Background(), scope, "not-a-palette"); !errors.Is(err, ErrUnknownPaletteID) {
		t.Fatalf("set(unknown) err = %v, want ErrUnknownPaletteID", err)
	}
	if _, ok := store.palettes["u1"]; ok {
		t.Fatal("a rejected palette write must not persist")
	}
}

func TestGetCoercesUnknownStoredPaletteIDToDefault(t *testing.T) {
	t.Parallel()
	store := &fakeStore{
		palettes: map[string]string{"u1": "retired-palette"},
		profiles: map[string]Profile{"u1": provisionedProfile("u1")},
	}
	service := newTestService(t, store)

	got, err := service.GetPalettePreference(context.Background(), mustScope(t, "u1"))
	if err != nil || got != DefaultPaletteID {
		t.Fatalf("unknown stored id get = %q, %v; want %q", got, err, DefaultPaletteID)
	}
}

func TestGetProfileTreatsUnprovisionedAsAbsentWithoutWriting(t *testing.T) {
	t.Parallel()
	store := &fakeStore{}
	service := newTestService(t, store)

	profile, err := service.GetProfile(context.Background(), mustScope(t, "unprovisioned"))
	if err != nil {
		t.Fatalf("GetProfile failed: %v", err)
	}
	if profile != nil {
		t.Fatalf("GetProfile = %#v, want absent", profile)
	}
	if store.profileUpdates != 0 || len(store.profiles) != 0 {
		t.Fatal("an unprovisioned profile read must not create or update a row")
	}
}

func TestUnprovisionedAccountReadsProfileButOtherRPCBehaviorsRequireSignup(t *testing.T) {
	t.Parallel()
	service := newTestService(t, &fakeStore{})
	scope := mustScope(t, "unprovisioned")
	if _, err := service.UpdateProfile(context.Background(), scope, UpdateProfileInput{
		Nickname: "valid name",
		Timezone: "UTC",
		Locale:   "en",
	}); !errors.Is(err, ErrSignupRequired) {
		t.Fatalf("UpdateProfile err = %v, want ErrSignupRequired", err)
	}
	if _, err := service.ListAuthProviders(context.Background(), scope); !errors.Is(err, ErrSignupRequired) {
		t.Fatalf("ListAuthProviders err = %v, want ErrSignupRequired", err)
	}
	if _, err := service.GetInviteLink(context.Background(), scope); !errors.Is(err, ErrSignupRequired) {
		t.Fatalf("GetInviteLink err = %v, want ErrSignupRequired", err)
	}
	if _, err := service.GetPalettePreference(context.Background(), scope); !errors.Is(err, ErrSignupRequired) {
		t.Fatalf("GetPalettePreference err = %v, want ErrSignupRequired", err)
	}
	if _, err := service.SetPalettePreference(context.Background(), scope, DefaultPaletteID); !errors.Is(err, ErrSignupRequired) {
		t.Fatalf("SetPalettePreference err = %v, want ErrSignupRequired", err)
	}
}

func TestUpdateProfileValidatesRuneBoundsTimezoneAndLocaleBeforeWriting(t *testing.T) {
	t.Parallel()
	scope := mustScope(t, "u1")
	store := &fakeStore{profiles: map[string]Profile{"u1": provisionedProfile("u1")}}
	service := newTestService(t, store)

	got, err := service.UpdateProfile(context.Background(), scope, UpdateProfileInput{
		Nickname: "  코시모시  ",
		Timezone: "Asia/Seoul",
		Locale:   "ko",
	})
	if err != nil {
		t.Fatalf("valid Korean profile failed: %v", err)
	}
	if got.Profile.Nickname != "코시모시" || got.Profile.Timezone != "Asia/Seoul" || got.Profile.Locale != "ko" {
		t.Fatalf("normalized profile = %#v", got.Profile)
	}

	for _, testCase := range []struct {
		name  string
		input UpdateProfileInput
		want  error
	}{
		{"nickname too short", UpdateProfileInput{Nickname: "x", Timezone: "UTC", Locale: "en"}, ErrNicknameInvalid},
		{"nickname too long", UpdateProfileInput{Nickname: string(make([]rune, values.AccountNicknameMaxLength+1)), Timezone: "UTC", Locale: "en"}, ErrNicknameInvalid},
		{"unknown timezone", UpdateProfileInput{Nickname: "valid", Timezone: "Mars/Olympus", Locale: "en"}, ErrTimezoneInvalid},
		{"off-set locale", UpdateProfileInput{Nickname: "valid", Timezone: "UTC", Locale: "fr"}, ErrLocaleInvalid},
	} {
		before := store.profileUpdates
		_, err := service.UpdateProfile(context.Background(), scope, testCase.input)
		if !errors.Is(err, testCase.want) {
			t.Fatalf("%s err = %v, want %v", testCase.name, err, testCase.want)
		}
		if store.profileUpdates != before {
			t.Fatalf("%s reached persistence", testCase.name)
		}
	}
}

func TestProfilesNeedNotHaveUniqueNicknames(t *testing.T) {
	t.Parallel()
	store := &fakeStore{profiles: map[string]Profile{
		"u1": provisionedProfile("u1"),
		"u2": provisionedProfile("u2"),
	}}
	service := newTestService(t, store)
	for _, userID := range []string{"u1", "u2"} {
		if _, err := service.UpdateProfile(context.Background(), mustScope(t, userID), UpdateProfileInput{
			Nickname: "same nickname",
			Timezone: "UTC",
			Locale:   "en",
		}); err != nil {
			t.Fatalf("UpdateProfile(%s) failed: %v", userID, err)
		}
	}
}

func TestProfileEmailIsReadThroughAndStoredTimezoneCoerces(t *testing.T) {
	t.Parallel()
	store := &fakeStore{profiles: map[string]Profile{"u1": {
		UserID:   "u1",
		Nickname: "cosimo",
		Timezone: "Removed/Zone",
		Locale:   "en",
	}}}
	directory := &fakeDirectory{emails: map[string]string{"u1": "first@example.com"}}
	service, err := NewService(ServiceDeps{
		Store:              store,
		Directory:          directory,
		InviteGranter:      &fakeInviteGranter{},
		SignupBonusGranter: &fakeSignupBonusGranter{},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	scope := mustScope(t, "u1")

	first, err := service.GetProfile(context.Background(), scope)
	if err != nil || first.Profile.Timezone != DefaultTimezone || first.Email != "first@example.com" {
		t.Fatalf("first read = %#v, %v", first, err)
	}
	directory.emails["u1"] = "changed@example.com"
	second, err := service.GetProfile(context.Background(), scope)
	if err != nil || second.Email != "changed@example.com" {
		t.Fatalf("changed directory email = %#v, %v", second, err)
	}
	if store.profileUpdates != 0 {
		t.Fatal("email and timezone read coercion must not write the profile row")
	}
}

func TestZoneForDefaultsForMissingAndUnresolvableProfiles(t *testing.T) {
	t.Parallel()
	store := &fakeStore{profiles: map[string]Profile{
		"invalid": {UserID: "invalid", Timezone: "Removed/Zone"},
		"seoul":   {UserID: "seoul", Timezone: "Asia/Seoul"},
	}}
	service := newTestService(t, store)
	for userID, want := range map[string]string{
		"missing": DefaultTimezone,
		"invalid": DefaultTimezone,
		"seoul":   "Asia/Seoul",
	} {
		got, err := service.ZoneFor(context.Background(), mustScope(t, userID))
		if err != nil || got != want {
			t.Fatalf("ZoneFor(%s) = %q, %v; want %q", userID, got, err, want)
		}
	}
	if location, err := time.LoadLocation("Asia/Seoul"); err != nil || location.String() != "Asia/Seoul" {
		t.Fatalf("embedded tzdata did not resolve Asia/Seoul: %v, %v", location, err)
	}
}

func TestListAuthProvidersUsesDirectoryClosedSetAndStoredTimestamps(t *testing.T) {
	t.Parallel()
	linked := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	store := &fakeStore{
		profiles: map[string]Profile{"u1": provisionedProfile("u1")},
		providers: map[string][]AuthProvider{"u1": {
			{Kind: AuthProviderGoogle, ProviderUserID: "google-id", LinkedAt: linked},
			{Kind: AuthProviderPassword, ProviderUserID: "password-id", LinkedAt: linked.Add(time.Hour)},
		}},
	}
	directory := &fakeDirectory{identities: map[string][]string{"u1": {"google", "email", "github"}}}
	service, err := NewService(ServiceDeps{
		Store:              store,
		Directory:          directory,
		InviteGranter:      &fakeInviteGranter{},
		SignupBonusGranter: &fakeSignupBonusGranter{},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}

	providers, err := service.ListAuthProviders(context.Background(), mustScope(t, "u1"))
	if err != nil || len(providers) != 2 {
		t.Fatalf("ListAuthProviders = %#v, %v", providers, err)
	}
	if providers[0].Kind != AuthProviderGoogle || providers[0].LinkedAt != linked ||
		providers[1].Kind != AuthProviderPassword {
		t.Fatalf("providers = %#v", providers)
	}
}

func TestListAuthProvidersFallsBackToStoredRowsOnDirectoryFailure(t *testing.T) {
	t.Parallel()
	store := &fakeStore{
		profiles: map[string]Profile{"u1": provisionedProfile("u1")},
		providers: map[string][]AuthProvider{"u1": {
			{Kind: AuthProviderPassword},
		}},
	}
	directory := &fakeDirectory{identitiesErr: errors.New("directory unavailable")}
	service, err := NewService(ServiceDeps{
		Store:              store,
		Directory:          directory,
		InviteGranter:      &fakeInviteGranter{},
		SignupBonusGranter: &fakeSignupBonusGranter{},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}

	providers, err := service.ListAuthProviders(context.Background(), mustScope(t, "u1"))
	if err != nil || len(providers) != 1 || providers[0].Kind != AuthProviderPassword {
		t.Fatalf("fallback providers = %#v, %v", providers, err)
	}
}

func TestRecordAuthProviderAcceptsOnlyTheClosedSetAndIsAppendOnly(t *testing.T) {
	t.Parallel()
	store := &fakeStore{}
	service := newTestService(t, store)
	scope := mustScope(t, "u1")

	if err := service.RecordAuthProvider(context.Background(), scope, AuthProviderGoogle, "google-user"); err != nil {
		t.Fatalf("RecordAuthProvider failed: %v", err)
	}
	if err := service.RecordAuthProvider(context.Background(), scope, AuthProviderGoogle, "changed-id"); err != nil {
		t.Fatalf("RecordAuthProvider replay failed: %v", err)
	}
	if len(store.providers["u1"]) != 1 || store.providers["u1"][0].ProviderUserID != "google-user" {
		t.Fatalf("recorded providers = %#v", store.providers["u1"])
	}
	before := store.providerWrites
	if err := service.RecordAuthProvider(context.Background(), scope, AuthProviderKind("GITHUB"), "id"); !errors.Is(err, ErrAuthProviderInvalid) {
		t.Fatalf("unknown provider err = %v", err)
	}
	if store.providerWrites != before {
		t.Fatal("unknown provider reached persistence")
	}
}

func TestSignUpHasExactlyFourInputsAndCreatesDirectoryProviderWithoutCrediting(t *testing.T) {
	t.Parallel()
	if got := reflect.TypeOf(SignUpInput{}).NumField(); got != 4 {
		t.Fatalf("SignUpInput fields = %d, want exactly nickname/timezone/locale/invite token", got)
	}

	now := time.Date(2026, 7, 26, 12, 0, 0, 0, time.UTC)
	store := &fakeStore{profiles: map[string]Profile{"inviter": provisionedProfile("inviter")}}
	directory := &fakeDirectory{identities: map[string][]string{"invitee": {"google"}}}
	inviteGranter := &fakeInviteGranter{}
	bonusGranter := &fakeSignupBonusGranter{}
	nowCalls := 0
	signer, err := NewHMACInviteSigner(make([]byte, inviteSigningKeyBytes))
	if err != nil {
		t.Fatalf("NewHMACInviteSigner failed: %v", err)
	}
	service, err := NewService(ServiceDeps{
		Store:              store,
		Directory:          directory,
		InviteSigner:       signer,
		InviteGranter:      inviteGranter,
		SignupBonusGranter: bonusGranter,
		Now: func() time.Time {
			nowCalls++
			if nowCalls >= 3 {
				return now.Add(time.Minute)
			}
			return now
		},
		NewID: func() string { return "invite-1" },
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	link, err := service.GetInviteLink(context.Background(), mustScope(t, "inviter"))
	if err != nil {
		t.Fatalf("GetInviteLink failed: %v", err)
	}

	profile, bound, err := service.SignUp(context.Background(), mustScope(t, "invitee"), SignUpInput{
		Nickname:    "  코시모시  ",
		Timezone:    "Asia/Seoul",
		Locale:      "unknown-negotiated-locale",
		InviteToken: link.Token,
	})
	if err != nil {
		t.Fatalf("SignUp failed: %v", err)
	}
	if profile.Nickname != "코시모시" || profile.Timezone != "Asia/Seoul" || profile.Locale != defaultLocale || !bound {
		t.Fatalf("SignUp = %#v, bound %v", profile, bound)
	}
	providers := store.providers["invitee"]
	if len(providers) != 1 || providers[0].Kind != AuthProviderGoogle || providers[0].ProviderUserID != "invitee" {
		t.Fatalf("initial providers = %#v", providers)
	}
	if inviteGranter.grants != 0 || bonusGranter.grants != 0 {
		t.Fatal("SignUp reached an economy granter")
	}
	if !store.lastBound.CreatedAt.Equal(now) || !store.lastBound.BoundAt.Equal(now.Add(time.Minute)) {
		t.Fatalf("bound timestamps = created %v bound %v, want distinct issue/bind times", store.lastBound.CreatedAt, store.lastBound.BoundAt)
	}
}

func TestSignUpValidationIdempotencyConcurrencyAndDirectoryDegradation(t *testing.T) {
	t.Parallel()
	for _, testCase := range []struct {
		name     string
		nickname string
		timezone string
		want     error
	}{
		{"short nickname", "x", "UTC", ErrNicknameInvalid},
		{"control character", "valid\x00name", "UTC", ErrNicknameInvalid},
		{"line break", "valid\nname", "UTC", ErrNicknameInvalid},
		{"unicode line separator", "valid\u2028name", "UTC", ErrNicknameInvalid},
		{"unknown timezone", "valid name", "Mars/Olympus", ErrTimezoneInvalid},
		{"process-local timezone", "valid name", "Local", ErrTimezoneInvalid},
	} {
		store := &fakeStore{}
		service := newTestService(t, store)
		_, _, err := service.SignUp(context.Background(), mustScope(t, "invalid"), SignUpInput{
			Nickname: testCase.nickname,
			Timezone: testCase.timezone,
			Locale:   "en",
		})
		if !errors.Is(err, testCase.want) {
			t.Fatalf("%s err = %v, want %v", testCase.name, err, testCase.want)
		}
		if len(store.profiles) != 0 {
			t.Fatalf("%s reached persistence", testCase.name)
		}
	}

	store := &fakeStore{}
	directory := &fakeDirectory{identitiesErr: errors.New("directory unavailable")}
	service, err := NewService(ServiceDeps{
		Store:              store,
		Directory:          directory,
		InviteGranter:      &fakeInviteGranter{},
		SignupBonusGranter: &fakeSignupBonusGranter{},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	scope := mustScope(t, "same-user")
	first, _, err := service.SignUp(context.Background(), scope, SignUpInput{
		Nickname: "first name",
		Timezone: "UTC",
		Locale:   "en",
	})
	if err != nil {
		t.Fatalf("first SignUp failed: %v", err)
	}
	replayed, bound, err := service.SignUp(context.Background(), scope, SignUpInput{
		Nickname:    "overwritten name",
		Timezone:    "Asia/Seoul",
		Locale:      "ko",
		InviteToken: "invalid-token",
	})
	if err != nil || replayed.Nickname != first.Nickname || replayed.Timezone != first.Timezone || replayed.Locale != first.Locale || bound {
		t.Fatalf("replayed SignUp = %#v bound %v err %v; want original profile and no bind", replayed, bound, err)
	}
	if len(store.providers["same-user"]) != 0 {
		t.Fatal("directory failure must not fabricate an auth provider")
	}

	concurrentStore := &fakeStore{}
	concurrentService := newTestService(t, concurrentStore)
	concurrentScope := mustScope(t, "concurrent-user")
	start := make(chan struct{})
	results := make(chan Profile, 2)
	errs := make(chan error, 2)
	for _, nickname := range []string{"first contender", "second contender"} {
		nickname := nickname
		go func() {
			<-start
			profile, _, err := concurrentService.SignUp(context.Background(), concurrentScope, SignUpInput{
				Nickname: nickname,
				Timezone: "UTC",
				Locale:   "en",
			})
			results <- profile
			errs <- err
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
	if left.Nickname != right.Nickname || len(concurrentStore.profiles) != 1 {
		t.Fatalf("concurrent profiles = %#v / %#v; want the same once-born row", left, right)
	}
}

func TestSignUpRollsBackProfileWhenInviteBindingInfrastructureFails(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 7, 26, 12, 0, 0, 0, time.UTC)
	bindErr := errors.New("bind unavailable")
	store := &fakeStore{
		profiles: map[string]Profile{"inviter": provisionedProfile("inviter")},
		bindErr:  bindErr,
	}
	signer, err := NewHMACInviteSigner(make([]byte, inviteSigningKeyBytes))
	if err != nil {
		t.Fatalf("NewHMACInviteSigner failed: %v", err)
	}
	service, err := NewService(ServiceDeps{
		Store:              store,
		Directory:          &fakeDirectory{},
		InviteSigner:       signer,
		InviteGranter:      &fakeInviteGranter{},
		SignupBonusGranter: &fakeSignupBonusGranter{},
		Now:                func() time.Time { return now },
		NewID:              func() string { return "invite-atomic" },
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	link, err := service.GetInviteLink(context.Background(), mustScope(t, "inviter"))
	if err != nil {
		t.Fatalf("GetInviteLink failed: %v", err)
	}
	input := SignUpInput{
		Nickname:    "invitee",
		Timezone:    "UTC",
		Locale:      "en",
		InviteToken: link.Token,
	}
	if _, _, err := service.SignUp(context.Background(), mustScope(t, "invitee"), input); !errors.Is(err, bindErr) {
		t.Fatalf("SignUp bind failure = %v, want %v", err, bindErr)
	}
	if _, orphaned := store.profiles["invitee"]; orphaned {
		t.Fatal("failed invite binding committed an orphaned user profile")
	}
	store.bindErr = nil
	if _, bound, err := service.SignUp(context.Background(), mustScope(t, "invitee"), input); err != nil || !bound {
		t.Fatalf("retried SignUp = bound %v err %v, want atomic success", bound, err)
	}
}

func TestAcceptInviteRefusalsAreBestEffort(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 7, 26, 12, 0, 0, 0, time.UTC)
	store := &fakeStore{profiles: map[string]Profile{
		"inviter": provisionedProfile("inviter"),
		"invitee": provisionedProfile("invitee"),
	}}
	signer, err := NewHMACInviteSigner(make([]byte, inviteSigningKeyBytes))
	if err != nil {
		t.Fatalf("NewHMACInviteSigner failed: %v", err)
	}
	nextID := 0
	service, err := NewService(ServiceDeps{
		Store:              store,
		Directory:          &fakeDirectory{},
		InviteSigner:       signer,
		InviteGranter:      &fakeInviteGranter{},
		SignupBonusGranter: &fakeSignupBonusGranter{},
		Now:                func() time.Time { return now },
		NewID: func() string {
			nextID++
			return fmt.Sprintf("invite-%d", nextID)
		},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	link, err := service.GetInviteLink(context.Background(), mustScope(t, "inviter"))
	if err != nil {
		t.Fatalf("GetInviteLink failed: %v", err)
	}
	if bound, err := service.AcceptInvite(context.Background(), mustScope(t, "invitee"), "unknown"); err != nil || bound {
		t.Fatalf("unknown token = bound %v err %v", bound, err)
	}
	if bound, err := service.AcceptInvite(context.Background(), mustScope(t, "inviter"), link.Token); err != nil || bound {
		t.Fatalf("self invite = bound %v err %v", bound, err)
	}
	withdrawnAt := now
	withdrawn := store.profiles["inviter"]
	withdrawn.DeletedAt = &withdrawnAt
	store.profiles["inviter"] = withdrawn
	if bound, err := service.AcceptInvite(context.Background(), mustScope(t, "invitee"), link.Token); err != nil || bound {
		t.Fatalf("withdrawn inviter = bound %v err %v", bound, err)
	}
	withdrawn.DeletedAt = nil
	store.profiles["inviter"] = withdrawn
	if bound, err := service.AcceptInvite(context.Background(), mustScope(t, "invitee"), link.Token); err != nil || !bound {
		t.Fatalf("valid invite = bound %v err %v", bound, err)
	}
	if bound, err := service.AcceptInvite(context.Background(), mustScope(t, "invitee"), link.Token); err != nil || bound {
		t.Fatalf("already-bound invitee = bound %v err %v", bound, err)
	}
	now = link.ExpiresAt.Add(time.Second)
	if bound, err := service.AcceptInvite(context.Background(), mustScope(t, "other"), link.Token); err != nil || bound {
		t.Fatalf("expired invite = bound %v err %v", bound, err)
	}
}

func TestAcceptInviteSurfacesUnavailableSigner(t *testing.T) {
	t.Parallel()
	store := &fakeStore{}
	service := newTestService(t, store)

	bound, err := service.AcceptInvite(
		context.Background(),
		mustScope(t, "invitee"),
		"payload.issue.nonce.YQ",
	)
	if bound || !errors.Is(err, ErrInviteLinkUnavailable) {
		t.Fatalf("unavailable signer = bound %v err %v, want ErrInviteLinkUnavailable", bound, err)
	}

	_, bound, err = service.SignUp(context.Background(), mustScope(t, "new-user"), SignUpInput{
		Nickname:    "new user",
		Timezone:    "UTC",
		Locale:      "en",
		InviteToken: "payload.issue.nonce.YQ",
	})
	if bound || !errors.Is(err, ErrInviteLinkUnavailable) {
		t.Fatalf("signup with unavailable signer = bound %v err %v", bound, err)
	}
	if _, committed := store.profiles["new-user"]; committed {
		t.Fatal("unavailable invite signer committed an unbound profile")
	}
}

func TestResolveInviteSettlementAppliesPermanentGatesBeforeDirectory(t *testing.T) {
	t.Parallel()
	invite := SettleableInvite{
		InviteID:      "invite-1",
		InviterUserID: "inviter",
		InviteeUserID: "invitee",
		Token:         "token",
	}
	profiles := map[string]Profile{
		"inviter": provisionedProfile("inviter"),
		"invitee": provisionedProfile("invitee"),
	}
	store := &fakeStore{
		profiles: profiles,
		invites:  map[string]SettleableInvite{"invitee": invite},
	}
	directory := &fakeDirectory{verifiedAt: map[string]time.Time{"invitee": time.Now().UTC()}}
	service, err := NewService(ServiceDeps{
		Store:              store,
		Directory:          directory,
		InviteGranter:      &fakeInviteGranter{},
		SignupBonusGranter: &fakeSignupBonusGranter{},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	request := InviteSettlementRequest{Token: "token", InviteeUserID: "invitee"}
	if _, err := service.ResolveInviteSettlement(context.Background(), request); !errors.Is(err, ErrInviteNotEligible) {
		t.Fatalf("resolver outside launch settlement err = %v, want ErrInviteNotEligible", err)
	}
	resolved, err := service.ResolveInviteSettlement(withSignupSettlement(context.Background()), request)
	if err != nil || resolved.InviteID != invite.InviteID {
		t.Fatalf("eligible settlement = %#v err %v", resolved, err)
	}

	directory.verificationReads = 0
	store.rewardedCounts = map[string]int64{"inviter": int64(values.TwinkleInviteRewardMaxPerInviter)}
	if _, err := service.ResolveInviteSettlement(withSignupSettlement(context.Background()), request); !errors.Is(err, ErrInviteNotEligible) {
		t.Fatalf("capped inviter err = %v, want ErrInviteNotEligible", err)
	}
	if directory.verificationReads != 0 {
		t.Fatal("reward cap failure made a directory call")
	}

	store.rewardedCounts = nil
	withdrawnAt := time.Now().UTC()
	withdrawn := store.profiles["inviter"]
	withdrawn.DeletedAt = &withdrawnAt
	store.profiles["inviter"] = withdrawn
	if _, err := service.ResolveInviteSettlement(withSignupSettlement(context.Background()), request); !errors.Is(err, ErrInviteNotEligible) {
		t.Fatalf("withdrawn inviter err = %v, want ErrInviteNotEligible", err)
	}
	if directory.verificationReads != 0 {
		t.Fatal("withdrawn inviter failure made a directory call")
	}

	withdrawn.DeletedAt = nil
	store.profiles["inviter"] = withdrawn
	directory.verifiedAt = nil
	if _, err := service.ResolveInviteSettlement(withSignupSettlement(context.Background()), request); !errors.Is(err, ErrInviteNotEligible) {
		t.Fatalf("unverified invitee err = %v, want ErrInviteNotEligible", err)
	}
	store.providers = map[string][]AuthProvider{"invitee": {{Kind: AuthProviderGoogle}}}
	directory.verifiedErr = errors.New("must not be called for Google")
	if _, err := service.ResolveInviteSettlement(withSignupSettlement(context.Background()), request); err != nil {
		t.Fatalf("Google-linked invitee should be implicitly verified: %v", err)
	}
}

func TestSettleSignupRequiresProvisionedAccountAndSerializesInviterCap(t *testing.T) {
	t.Parallel()
	bonus := &fakeSignupBonusGranter{}
	missingService, err := NewService(ServiceDeps{
		Store:              &fakeStore{},
		Directory:          &fakeDirectory{},
		InviteGranter:      &fakeInviteGranter{},
		SignupBonusGranter: bonus,
	})
	if err != nil {
		t.Fatalf("NewService(missing) failed: %v", err)
	}
	if err := missingService.SettleSignup(context.Background(), mustScope(t, "missing")); !errors.Is(err, ErrSignupRequired) {
		t.Fatalf("missing-account settlement err = %v, want ErrSignupRequired", err)
	}
	if bonus.grants != 0 {
		t.Fatal("missing account received a signup bonus")
	}

	store := &fakeStore{
		profiles: map[string]Profile{
			"inviter":   provisionedProfile("inviter"),
			"invitee-a": provisionedProfile("invitee-a"),
			"invitee-b": provisionedProfile("invitee-b"),
		},
		invites: map[string]SettleableInvite{
			"invitee-a": {InviteID: "invite-a", InviterUserID: "inviter", InviteeUserID: "invitee-a", Token: "token-a"},
			"invitee-b": {InviteID: "invite-b", InviterUserID: "inviter", InviteeUserID: "invitee-b", Token: "token-b"},
		},
		rewardedCounts: map[string]int64{
			"inviter": int64(values.TwinkleInviteRewardMaxPerInviter - 1),
		},
	}
	directory := &fakeDirectory{verifiedAt: map[string]time.Time{
		"invitee-a": time.Now().UTC(),
		"invitee-b": time.Now().UTC(),
	}}
	granter := &resolvingInviteGranter{}
	service, err := NewService(ServiceDeps{
		Store:              store,
		Directory:          directory,
		InviteGranter:      granter,
		SignupBonusGranter: &fakeSignupBonusGranter{},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	granter.service = service
	start := make(chan struct{})
	errs := make(chan error, 2)
	for _, userID := range []string{"invitee-a", "invitee-b"} {
		userID := userID
		go func() {
			<-start
			errs <- service.SettleSignup(context.Background(), mustScope(t, userID))
		}()
	}
	close(start)
	for range 2 {
		if err := <-errs; err != nil {
			t.Fatalf("concurrent settlement failed: %v", err)
		}
	}
	if got := store.rewardedCounts["inviter"]; got != int64(values.TwinkleInviteRewardMaxPerInviter) {
		t.Fatalf("rewarded count = %d, want cap %d", got, values.TwinkleInviteRewardMaxPerInviter)
	}
	if granter.grants != 1 || len(store.invites) != 1 {
		t.Fatalf("concurrent cap = grants %d pending %d, want 1/1", granter.grants, len(store.invites))
	}
}

func TestSettleSignupCreditsBeforeMarkAndAlwaysAttemptsBonus(t *testing.T) {
	t.Parallel()
	store := &fakeStore{
		profiles: map[string]Profile{
			"inviter": provisionedProfile("inviter"),
			"invitee": provisionedProfile("invitee"),
		},
		invites: map[string]SettleableInvite{"invitee": {
			InviteID:      "invite-1",
			InviterUserID: "inviter",
			InviteeUserID: "invitee",
			Token:         "token",
		}},
	}
	inviteGranter := &fakeInviteGranter{}
	bonusGranter := &fakeSignupBonusGranter{}
	service, err := NewService(ServiceDeps{
		Store:              store,
		Directory:          &fakeDirectory{},
		InviteGranter:      inviteGranter,
		SignupBonusGranter: bonusGranter,
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	if err := service.SettleSignup(context.Background(), mustScope(t, "invitee")); err != nil {
		t.Fatalf("SettleSignup failed: %v", err)
	}
	if inviteGranter.grants != 1 || bonusGranter.grants != 1 || store.rewardedCounts["inviter"] != 1 {
		t.Fatalf("settlement = invite grants %d bonus grants %d rewarded %d", inviteGranter.grants, bonusGranter.grants, store.rewardedCounts["inviter"])
	}

	store.invites["invitee"] = SettleableInvite{
		InviteID:      "invite-2",
		InviterUserID: "inviter",
		InviteeUserID: "invitee",
		Token:         "token-2",
	}
	inviteGranter.err = ErrInviteNotEligible
	if err := service.SettleSignup(context.Background(), mustScope(t, "invitee")); err != nil {
		t.Fatalf("ineligible invite should not suppress signup bonus: %v", err)
	}
	if _, stillPending := store.invites["invitee"]; !stillPending || bonusGranter.grants != 2 {
		t.Fatal("ineligible invite was marked or the unconditional bonus was skipped")
	}

	probeErr := errors.New("invite probe unavailable")
	store.inviteFindErr = probeErr
	if err := service.SettleSignup(context.Background(), mustScope(t, "invitee")); !errors.Is(err, probeErr) {
		t.Fatalf("probe failure err = %v, want retained probe error", err)
	}
	if bonusGranter.grants != 3 {
		t.Fatal("invite probe failure skipped the unconditional signup bonus")
	}
}

func TestInviteTokenRoundTripTamperMalformedExpiryAndOnlySignupStoreRead(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 7, 26, 12, 0, 0, 0, time.UTC)
	store := &fakeStore{profiles: map[string]Profile{"inviter": provisionedProfile("inviter")}}
	signer, err := NewHMACInviteSigner(make([]byte, inviteSigningKeyBytes))
	if err != nil {
		t.Fatalf("NewHMACInviteSigner failed: %v", err)
	}
	service, err := NewService(ServiceDeps{
		Store:              store,
		Directory:          &fakeDirectory{},
		InviteSigner:       signer,
		InviteGranter:      &fakeInviteGranter{},
		SignupBonusGranter: &fakeSignupBonusGranter{},
		Now:                func() time.Time { return now },
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}

	link, err := service.GetInviteLink(context.Background(), mustScope(t, "inviter"))
	if err != nil {
		t.Fatalf("GetInviteLink failed: %v", err)
	}
	if want := now.Add(time.Duration(values.AccountInviteLinkTtlDays) * 24 * time.Hour); !link.ExpiresAt.Equal(want) {
		t.Fatalf("expires_at = %v, want %v", link.ExpiresAt, want)
	}
	verified, err := service.VerifyInviteToken(link.Token)
	if err != nil || verified.InviterUserID != "inviter" || !verified.IssuedAt.Equal(now) {
		t.Fatalf("VerifyInviteToken = %#v, %v", verified, err)
	}
	if store.profileReads != 1 || store.profileUpdates != 0 {
		t.Fatal("invite issuance may check signup state once; verification must not write the store")
	}

	tampered := "A" + link.Token[1:]
	if _, err := service.VerifyInviteToken(tampered); !errors.Is(err, ErrInviteTokenInvalid) {
		t.Fatalf("tampered token err = %v", err)
	}
	if _, err := service.VerifyInviteToken("malformed"); !errors.Is(err, ErrInviteTokenInvalid) {
		t.Fatalf("malformed token err = %v", err)
	}
	now = link.ExpiresAt.Add(time.Second)
	if _, err := service.VerifyInviteToken(link.Token); !errors.Is(err, ErrInviteTokenExpired) {
		t.Fatalf("expired token err = %v", err)
	}
}

func TestInviteLinkFailsClosedWithoutSigningKey(t *testing.T) {
	t.Parallel()
	service := newTestService(t, &fakeStore{profiles: map[string]Profile{"u1": provisionedProfile("u1")}})
	if _, err := service.GetInviteLink(context.Background(), mustScope(t, "u1")); !errors.Is(err, ErrInviteLinkUnavailable) {
		t.Fatalf("GetInviteLink without key err = %v", err)
	}

	zeroValueService, err := NewService(ServiceDeps{
		Store:              &fakeStore{profiles: map[string]Profile{"u1": provisionedProfile("u1")}},
		Directory:          &fakeDirectory{},
		InviteSigner:       HMACInviteSigner{},
		InviteGranter:      &fakeInviteGranter{},
		SignupBonusGranter: &fakeSignupBonusGranter{},
	})
	if err != nil {
		t.Fatalf("NewService with zero-value signer failed: %v", err)
	}
	if _, err := zeroValueService.GetInviteLink(context.Background(), mustScope(t, "u1")); !errors.Is(err, ErrInviteLinkUnavailable) {
		t.Fatalf("GetInviteLink with zero-value signer err = %v, want ErrInviteLinkUnavailable", err)
	}
}

func TestScopeRequired(t *testing.T) {
	t.Parallel()
	service := newTestService(t, &fakeStore{})
	var anonymous platform.UserScope

	if _, err := service.GetPalettePreference(context.Background(), anonymous); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("get(anonymous) err = %v, want ErrScopeRequired", err)
	}
	if _, err := service.GetProfile(context.Background(), anonymous); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("GetProfile(anonymous) err = %v, want ErrScopeRequired", err)
	}
}

func TestRegistryAllowListMatchesFixture(t *testing.T) {
	t.Parallel()
	assertStringFixture(t, "testdata/palette-ids.json", RegistryPaletteIDs())
}

func TestShippedLocalesMatchFixture(t *testing.T) {
	t.Parallel()
	assertStringFixture(t, "testdata/locales.json", ShippedLocales())
}

func assertStringFixture(t *testing.T, path string, actual []string) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var fixture []string
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("decode fixture: %v", err)
	}
	sort.Strings(fixture)
	sort.Strings(actual)
	if len(fixture) != len(actual) {
		t.Fatalf("actual %v does not match fixture %v", actual, fixture)
	}
	for index := range fixture {
		if fixture[index] != actual[index] {
			t.Fatalf("actual %v does not match fixture %v", actual, fixture)
		}
	}
}
