package settings

import (
	"context"
	"regexp"
)

// hexColor matches "#RRGGBB" (case-insensitive). The server validates the format
// only — the color choice itself is the user's (spec 30).
var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// Known ids the client offers. The client owns the catalog (entities/appearance
// themes + star kinds); the server keeps a minimal mirror only to reject
// clearly-unknown values (AC 1.3). Keep in sync if the client catalog grows.
var (
	validThemes  = map[string]bool{"vast": true, "lively": true, "calm": true}
	validObjects = map[string]bool{"deepfield": true, "aurora": true, "liquid": true, "ember": true}
)

// Service holds the settings policy: validation + partial-update orchestration.
type Service struct {
	repo Repository
}

// NewService wires the settings service over its persistence Repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Get returns the user's stored visual overrides (the client merges its defaults).
func (s *Service) Get(ctx context.Context, userID string) (Settings, error) {
	return s.repo.Get(ctx, userID)
}

// Update validates the whole patch BEFORE any write (no partial application — AC 1.3),
// upserts it, then returns the merged stored overrides. Mood validity is already
// enforced at the handler (proto enum → lowercase name), so colors arrive keyed by a
// known mood; here we only check the color format and the theme/object ids.
func (s *Service) Update(ctx context.Context, userID string, p Patch) (Settings, error) {
	if p.Theme != nil && !validThemes[*p.Theme] {
		return Settings{}, ErrInvalidTheme
	}
	if p.StarObject != nil && !validObjects[*p.StarObject] {
		return Settings{}, ErrInvalidObject
	}
	for _, c := range p.EmotionColors {
		if !hexColor.MatchString(c.Color) {
			return Settings{}, ErrInvalidColor
		}
	}
	if err := s.repo.Update(ctx, userID, p); err != nil {
		return Settings{}, err
	}
	return s.repo.Get(ctx, userID)
}
