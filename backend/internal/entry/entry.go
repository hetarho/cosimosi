// Package entry is the "mood diary entry" feature.
//
// It owns everything about an Entry — the domain type, the repository
// interface (declared here at the consumer side, per Go idiom), the
// service that holds business rules, the pgx-backed repository
// implementation, the HTTP handler, and the HTTP DTOs.
//
// Architectural rule: this package depends inward only.
//
//	handler  ──►  service  ──►  repository (interface) ──►  repository_pg
//
// Cross-feature calls go service-to-service; never handler-to-handler.
package entry

import (
	"encoding/json"
	"time"
)

// Mood is the qualitative kind of feeling captured by an entry.
type Mood string

const (
	MoodCalm       Mood = "calm"
	MoodJoy        Mood = "joy"
	MoodStorm      Mood = "storm"
	MoodMelancholy Mood = "melancholy"
	MoodWonder     Mood = "wonder"
)

// ArtworkSpec captures the planet's state in the user's solar system —
// orbital radius, velocity, size, color, rotation axis, etc.
//
// The concrete schema is intentionally deferred; it gets pinned down
// when the 3D scene contract stabilizes. Until then we hold the raw
// JSON and let the frontend define the shape.
type ArtworkSpec = json.RawMessage

// Entry is one diary record — one planet in the user's solar system.
type Entry struct {
	ID        string
	Date      time.Time
	Mood      Mood
	Note      string
	Artwork   ArtworkSpec
	ThumbKey  string
	CreatedAt time.Time
	UpdatedAt time.Time
}
