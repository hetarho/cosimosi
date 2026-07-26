package account

import (
	"context"

	"github.com/cosimosi/api/internal/platform"
)

// DefaultPaletteID is the fail-safe for an unset or retired stored palette id. It mirrors the
// client registry's default id as a contract constant, not a tuning value.
const DefaultPaletteID = "cosimosi-default"

var registryPaletteIDs = []string{
	DefaultPaletteID,
	"muted-dusk",
}

// RegistryPaletteIDs returns a copy for the fixture drift guard.
func RegistryPaletteIDs() []string {
	ids := make([]string, len(registryPaletteIDs))
	copy(ids, registryPaletteIDs)
	return ids
}

func (s *Service) GetPalettePreference(ctx context.Context, scope platform.UserScope) (string, error) {
	if scope.UserID() == "" {
		return "", ErrScopeRequired
	}
	if err := s.requireSignup(ctx, scope); err != nil {
		return "", err
	}
	id, found, err := s.store.GetPalettePreference(ctx, scope)
	if err != nil {
		return "", err
	}
	if !found || !s.knownPalette(id) {
		return DefaultPaletteID, nil
	}
	return id, nil
}

func (s *Service) SetPalettePreference(ctx context.Context, scope platform.UserScope, paletteID string) (string, error) {
	if scope.UserID() == "" {
		return "", ErrScopeRequired
	}
	if err := s.requireSignup(ctx, scope); err != nil {
		return "", err
	}
	if !s.knownPalette(paletteID) {
		return "", ErrUnknownPaletteID
	}
	return s.store.UpsertPalettePreference(ctx, scope, paletteID)
}

func (s *Service) knownPalette(id string) bool {
	_, ok := s.paletteIDs[id]
	return ok
}
