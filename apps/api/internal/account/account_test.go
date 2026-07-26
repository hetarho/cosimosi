package account

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"sort"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

type fakeStore struct {
	palettes       map[string]string
	profiles       map[string]Profile
	providers      map[string][]AuthProvider
	getErr         error
	putErr         error
	profileReads   int
	profileUpdates int
	providerWrites int
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
	f.profileReads++
	if f.getErr != nil {
		return Profile{}, false, f.getErr
	}
	profile, ok := f.profiles[scope.UserID()]
	return profile, ok, nil
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

func (f *fakeStore) CountRewardedInvitesByInviter(context.Context, platform.UserScope) (int64, error) {
	return 0, f.getErr
}

type fakeDirectory struct {
	emails        map[string]string
	identities    map[string][]string
	emailErr      error
	identitiesErr error
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

func newTestService(t *testing.T, store Store) *Service {
	t.Helper()
	service, err := NewService(ServiceDeps{
		Store:        store,
		Directory:    &fakeDirectory{},
		InviteSigner: UnavailableInviteSigner{},
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
}

func TestGetReturnsDefaultWhenPaletteUnset(t *testing.T) {
	t.Parallel()
	service := newTestService(t, &fakeStore{})

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
	store := &fakeStore{}
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
	store := &fakeStore{}
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
	store := &fakeStore{palettes: map[string]string{"u1": "retired-palette"}}
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
	service, err := NewService(ServiceDeps{Store: store, Directory: directory})
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
	store := &fakeStore{providers: map[string][]AuthProvider{"u1": {
		{Kind: AuthProviderGoogle, ProviderUserID: "google-id", LinkedAt: linked},
		{Kind: AuthProviderPassword, ProviderUserID: "password-id", LinkedAt: linked.Add(time.Hour)},
	}}}
	directory := &fakeDirectory{identities: map[string][]string{"u1": {"google", "email", "github"}}}
	service, err := NewService(ServiceDeps{Store: store, Directory: directory})
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
	store := &fakeStore{providers: map[string][]AuthProvider{"u1": {
		{Kind: AuthProviderPassword},
	}}}
	directory := &fakeDirectory{identitiesErr: errors.New("directory unavailable")}
	service, err := NewService(ServiceDeps{Store: store, Directory: directory})
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

func TestInviteTokenRoundTripTamperMalformedExpiryAndNoStoreAccess(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 7, 26, 12, 0, 0, 0, time.UTC)
	store := &fakeStore{}
	signer, err := NewHMACInviteSigner(make([]byte, inviteSigningKeyBytes))
	if err != nil {
		t.Fatalf("NewHMACInviteSigner failed: %v", err)
	}
	service, err := NewService(ServiceDeps{
		Store:        store,
		Directory:    &fakeDirectory{},
		InviteSigner: signer,
		Now:          func() time.Time { return now },
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
	if store.profileReads != 0 || store.profileUpdates != 0 {
		t.Fatal("invite issuance and verification must not access the store")
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
	service := newTestService(t, &fakeStore{})
	if _, err := service.GetInviteLink(context.Background(), mustScope(t, "u1")); !errors.Is(err, ErrInviteLinkUnavailable) {
		t.Fatalf("GetInviteLink without key err = %v", err)
	}

	zeroValueService, err := NewService(ServiceDeps{
		Store:        &fakeStore{},
		Directory:    &fakeDirectory{},
		InviteSigner: HMACInviteSigner{},
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
