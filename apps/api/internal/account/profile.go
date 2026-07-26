package account

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
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
	normalized, err := validateProfileInput(input)
	if err != nil {
		return ProfileView{}, err
	}
	profile, found, err := s.store.UpdateUserProfile(ctx, scope, normalized)
	if err != nil {
		return ProfileView{}, err
	}
	if !found {
		return ProfileView{}, ErrNotProvisioned
	}
	email, err := s.directory.EmailFor(ctx, scope.UserID())
	if err != nil {
		return ProfileView{}, err
	}
	return ProfileView{Profile: normalizeStoredProfile(profile), Email: email}, nil
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

func validateProfileInput(input UpdateProfileInput) (UpdateProfileInput, error) {
	input.Nickname = strings.TrimSpace(input.Nickname)
	length := utf8.RuneCountInString(input.Nickname)
	if length < values.AccountNicknameMinLength || length > values.AccountNicknameMaxLength {
		return UpdateProfileInput{}, ErrNicknameInvalid
	}
	input.Timezone = strings.TrimSpace(input.Timezone)
	if input.Timezone == "" {
		return UpdateProfileInput{}, ErrTimezoneInvalid
	}
	if _, err := time.LoadLocation(input.Timezone); err != nil {
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
