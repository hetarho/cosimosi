package account

import (
	"context"
	"errors"

	"github.com/cosimosi/api/internal/platform"
)

// DefaultPaletteID is applied when a user never chose a palette, and is the fail-safe an unknown
// stored id coerces to on read. It mirrors the client registry's default id — a contract constant,
// not a tuning value.
const DefaultPaletteID = "cosimosi-default"

var (
	ErrScopeRequired    = errors.New("account preference requires authenticated user scope")
	ErrStoreRequired    = errors.New("account service requires a preference store")
	ErrUnknownPaletteID = errors.New("palette id is not a known registry palette")
)

// registryPaletteIDs is the first-party allow-list of palette ids the client registry publishes.
// It is the Go mirror of the shared id fixture (a byte-identical testdata copy keeps the two in
// sync); a write is accepted only for an id in this set, so a client cannot store an arbitrary
// color table through the preference.
var registryPaletteIDs = []string{
	DefaultPaletteID,
	"muted-dusk",
}

// PreferenceStore is the get/set behavior's consumer-owned store port (§2.4): per-user scoped, the
// concrete lives in account/pg. found=false means the user has no stored preference row yet.
type PreferenceStore interface {
	GetPalettePreference(ctx context.Context, scope platform.UserScope) (paletteID string, found bool, err error)
	UpsertPalettePreference(ctx context.Context, scope platform.UserScope, paletteID string) (string, error)
}

// Service is the account context's get/set behavior over the palette preference.
type Service struct {
	store   PreferenceStore
	allowed map[string]struct{}
}

func NewService(store PreferenceStore) (*Service, error) {
	if store == nil {
		return nil, ErrStoreRequired
	}
	allowed := make(map[string]struct{}, len(registryPaletteIDs))
	for _, id := range registryPaletteIDs {
		allowed[id] = struct{}{}
	}
	return &Service{store: store, allowed: allowed}, nil
}

// RegistryPaletteIDs returns a copy of the first-party allow-list — the sync guard reads it to
// assert it equals the shared id fixture, catching drift from the client registry.
func RegistryPaletteIDs() []string {
	ids := make([]string, len(registryPaletteIDs))
	copy(ids, registryPaletteIDs)
	return ids
}

// GetPalettePreference returns the user's stored palette id, or the default when unset. A stored
// id no longer in the registry (a palette retired after the user chose it) coerces to the default,
// so the client always resolves a real palette.
func (s *Service) GetPalettePreference(ctx context.Context, scope platform.UserScope) (string, error) {
	if scope.UserID() == "" {
		return "", ErrScopeRequired
	}
	id, found, err := s.store.GetPalettePreference(ctx, scope)
	if err != nil {
		return "", err
	}
	if !found || !s.known(id) {
		return DefaultPaletteID, nil
	}
	return id, nil
}

// SetPalettePreference validates the id against the first-party allow-list — an unknown id is
// rejected, never stored — then upserts it and echoes the stored value.
func (s *Service) SetPalettePreference(ctx context.Context, scope platform.UserScope, paletteID string) (string, error) {
	if scope.UserID() == "" {
		return "", ErrScopeRequired
	}
	if !s.known(paletteID) {
		return "", ErrUnknownPaletteID
	}
	return s.store.UpsertPalettePreference(ctx, scope, paletteID)
}

func (s *Service) known(id string) bool {
	_, ok := s.allowed[id]
	return ok
}
