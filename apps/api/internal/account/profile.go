package account

import (
	"context"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// DefaultTimezone is the fail-safe day boundary for an absent or no-longer-resolvable stored
// IANA name.
const DefaultTimezone = "UTC"

var shippedLocales = []string{"en", "ko"}

func ShippedLocales() []string {
	locales := make([]string, len(shippedLocales))
	copy(locales, shippedLocales)
	return locales
}

func (s *Service) GetProfile(ctx context.Context, scope platform.UserScope) (*ProfileView, error) {
	if scope.UserID() == "" {
		return nil, ErrScopeRequired
	}
	profile, found, err := s.store.GetUserProfile(ctx, scope)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}
	profile = normalizeStoredProfile(profile)
	email, err := s.directory.EmailFor(ctx, scope.UserID())
	if err != nil {
		return nil, err
	}
	return &ProfileView{Profile: profile, Email: email}, nil
}

func (s *Service) UpdateProfile(ctx context.Context, scope platform.UserScope, input UpdateProfileInput) (ProfileView, error) {
	if scope.UserID() == "" {
		return ProfileView{}, ErrScopeRequired
	}
	if err := s.requireSignup(ctx, scope); err != nil {
		return ProfileView{}, err
	}
	normalized, err := validateProfileInput(input)
	if err != nil {
		return ProfileView{}, err
	}
	profile, found, err := s.store.UpdateUserProfile(ctx, scope, normalized)
	if err != nil {
		return ProfileView{}, err
	}
	if !found {
		return ProfileView{}, ErrSignupRequired
	}
	email, err := s.directory.EmailFor(ctx, scope.UserID())
	if err != nil {
		return ProfileView{}, err
	}
	return ProfileView{Profile: normalizeStoredProfile(profile), Email: email}, nil
}

func (s *Service) requireSignup(ctx context.Context, scope platform.UserScope) error {
	_, found, err := s.store.GetUserProfile(ctx, scope)
	if err != nil {
		return err
	}
	if !found {
		return ErrSignupRequired
	}
	return nil
}

// ZoneFor publishes the IANA name only. Runtime resolution belongs to each consumer's
// composition-root adapter.
func (s *Service) ZoneFor(ctx context.Context, scope platform.UserScope) (string, error) {
	if scope.UserID() == "" {
		return "", ErrScopeRequired
	}
	profile, found, err := s.store.GetUserProfile(ctx, scope)
	if err != nil {
		return "", err
	}
	if !found {
		return DefaultTimezone, nil
	}
	return normalizeStoredTimezone(profile.Timezone), nil
}

// ZonesFor is the batch form of ZoneFor published for Twinkle's admin-list enrichment. The store
// resolves all stored names in one query — `Store.UserTimezones` is part of the port rather than a
// capability probed at runtime, so a store that cannot answer in one read fails to compile instead
// of degrading to a scalar read per user. Every requested ID is present in the result, with missing
// or invalid profile values mapped to the same UTC default as ZoneFor.
func (s *Service) ZonesFor(ctx context.Context, userIDs []string) (map[string]string, error) {
	stored, err := s.store.UserTimezones(ctx, userIDs)
	if err != nil {
		return nil, err
	}
	zones := make(map[string]string, len(userIDs))
	for _, userID := range userIDs {
		zones[userID] = normalizeStoredTimezone(stored[userID])
	}
	return zones, nil
}

func validateProfileInput(input UpdateProfileInput) (UpdateProfileInput, error) {
	nickname, err := normalizeNickname(input.Nickname)
	if err != nil {
		return UpdateProfileInput{}, err
	}
	input.Nickname = nickname
	input.Timezone = strings.TrimSpace(input.Timezone)
	if input.Timezone == "" || !resolvesTimezone(input.Timezone) {
		return UpdateProfileInput{}, ErrTimezoneInvalid
	}
	input.Locale = strings.TrimSpace(input.Locale)
	if !knownLocale(input.Locale) {
		// UpdateProfile rejects an off-set locale because it came from an explicit control; signup
		// may coerce a negotiated guess instead, so silent coercion here would misreport the choice.
		return UpdateProfileInput{}, ErrLocaleInvalid
	}
	return input, nil
}

func resolvesTimezone(name string) bool {
	// time.LoadLocation accepts "Local" as a process-specific special case. Profiles
	// must remain portable IANA/UTC identifiers, never inherit the API host's zone.
	if name == "Local" {
		return false
	}
	_, err := time.LoadLocation(name)
	return err == nil
}

func normalizeStoredProfile(profile Profile) Profile {
	profile.Timezone = normalizeStoredTimezone(profile.Timezone)
	return profile
}

func normalizeStoredTimezone(name string) string {
	if name == "" {
		return DefaultTimezone
	}
	if _, err := time.LoadLocation(name); err != nil {
		return DefaultTimezone
	}
	return name
}

func knownLocale(locale string) bool {
	for _, candidate := range shippedLocales {
		if locale == candidate {
			return true
		}
	}
	return false
}
