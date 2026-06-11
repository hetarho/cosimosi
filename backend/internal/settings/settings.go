// Package settings is per-user visual personalization (spec 30): background theme,
// star object shape, and per-mood star colors. The server stores only the user's
// OVERRIDES — the client owns the default palette/theme/object (it needs them for
// the unauth/offline path) and merges these over them — so there are no default
// constants here. A separate bounded context from the star graph (internal/memory),
// hence its own SettingsService.
package settings

import (
	"context"
	"errors"
)

// Validation sentinels — the handler maps these to InvalidArgument (the spec-17
// pattern), so the rejection reason reaches the client.
var (
	ErrInvalidColor  = errors.New("settings: color must be #RRGGBB")
	ErrInvalidMood   = errors.New("settings: unknown mood")
	ErrInvalidTheme  = errors.New("settings: unknown theme")
	ErrInvalidObject = errors.New("settings: unknown star object")
)

// EmotionColor is one mood→color override. Mood is the lowercase enum name
// ("joy".."emptiness", spec 29); Color is "#RRGGBB".
type EmotionColor struct {
	Mood  string
	Color string
}

// Settings is a user's stored visual overrides — NOT a complete config. Empty
// Theme/StarObject mean "not overridden" (the client falls back to its default).
type Settings struct {
	Theme         string
	StarObject    string
	EmotionColors []EmotionColor
}

// Patch is a partial update: a nil pointer means "field not sent — preserve it";
// EmotionColors is the subset of moods to upsert (it never deletes the others).
type Patch struct {
	Theme         *string
	StarObject    *string
	EmotionColors []EmotionColor
}

// Repository is the persistence port (pgx impl in repository_pg.go). There is no
// delete — overrides are only added or changed.
type Repository interface {
	// Get returns the user's stored overrides (zero-value Settings if none).
	Get(ctx context.Context, userID string) (Settings, error)
	// Update upserts the patch's present fields in one transaction.
	Update(ctx context.Context, userID string, p Patch) error
}
