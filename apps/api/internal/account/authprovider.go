package account

import (
	"context"
	"sort"
	"strings"

	"github.com/cosimosi/api/internal/platform"
)

func (s *Service) ListAuthProviders(ctx context.Context, scope platform.UserScope) ([]AuthProvider, error) {
	if scope.UserID() == "" {
		return nil, ErrScopeRequired
	}
	stored, err := s.store.ListAuthProviders(ctx, scope)
	if err != nil {
		return nil, err
	}
	identities, directoryErr := s.directory.Identities(ctx, scope.UserID())
	if directoryErr != nil {
		return knownStoredProviders(stored), nil
	}

	storedByKind := make(map[AuthProviderKind]AuthProvider, len(stored))
	for _, provider := range stored {
		if knownAuthProvider(provider.Kind) {
			storedByKind[provider.Kind] = provider
		}
	}
	seen := make(map[AuthProviderKind]struct{}, len(identities))
	providers := make([]AuthProvider, 0, len(identities))
	for _, identity := range identities {
		kind, ok := providerKindForIdentity(identity)
		if !ok {
			continue
		}
		if _, duplicate := seen[kind]; duplicate {
			continue
		}
		seen[kind] = struct{}{}
		providers = append(providers, storedByKind[kind])
		providers[len(providers)-1].Kind = kind
	}
	sort.SliceStable(providers, func(i, j int) bool {
		return providers[i].LinkedAt.Before(providers[j].LinkedAt)
	})
	return providers, nil
}

// RecordAuthProvider appends the first product-observed linkage for a member of the closed set.
// The caller decides when observation is authoritative; repeated observations preserve linked_at.
func (s *Service) RecordAuthProvider(ctx context.Context, scope platform.UserScope, kind AuthProviderKind, providerUserID string) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	providerUserID = strings.TrimSpace(providerUserID)
	if !knownAuthProvider(kind) || providerUserID == "" {
		return ErrAuthProviderInvalid
	}
	return s.store.RecordAuthProvider(ctx, scope, kind, providerUserID)
}

func knownStoredProviders(stored []AuthProvider) []AuthProvider {
	providers := make([]AuthProvider, 0, len(stored))
	for _, provider := range stored {
		if knownAuthProvider(provider.Kind) {
			providers = append(providers, provider)
		}
	}
	return providers
}

func knownAuthProvider(kind AuthProviderKind) bool {
	return kind == AuthProviderGoogle || kind == AuthProviderPassword
}

func providerKindForIdentity(identity string) (AuthProviderKind, bool) {
	switch strings.ToLower(strings.TrimSpace(identity)) {
	case "google":
		return AuthProviderGoogle, true
	case "email", "password":
		return AuthProviderPassword, true
	default:
		return "", false
	}
}
