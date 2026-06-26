// Package ai is the provider abstraction (constitution §7): the worker and
// services depend only on these ports, and concrete adapters (mock, OpenAI, …)
// are injected at the edge. Types here are pure domain — no transport/db tags.
package ai

import "context"

// Embedder turns diary text into a fixed-dimension semantic vector. The adapter
// guarantees the returned slice has length Dim() (MVP: 1536). Model() names the
// adapter/model that produced the vector so it is recorded alongside the
// embedding (acceptance 1.2) and can be re-embedded if the model/dimension ever
// changes (Architecture §4.7).
type Embedder interface {
	Embed(ctx context.Context, text string) ([]float32, error)
	Dim() int
	Model() string
}

// Mood is ai's OWN emotion enum (spec 20). It deliberately does not import
// memory.Mood — an extractor coupled to the star domain could not be reused by
// other adapters or platforms. The 13 values (4 affective quadrants ×3 + neutral,
// spec 29) are string-aligned 1:1 with memory.Mood; the mapping is the caller's
// job (spec 21). Mood is the color/UX layer only — memory weight is carried by
// the dimensional variables (Intensity = arousal, Valence).
type Mood string

const (
	MoodUnspecified Mood = ""
	MoodJoy         Mood = "joy"
	MoodCalm        Mood = "calm"
	MoodSad         Mood = "sad"
	MoodAnger       Mood = "anger"
	MoodFear        Mood = "fear"
	MoodLove        Mood = "love"
	MoodNeutral     Mood = "neutral"
	MoodExcitement  Mood = "excitement"
	MoodGratitude   Mood = "gratitude"
	MoodRelief      Mood = "relief"
	MoodStress      Mood = "stress"
	MoodTired       Mood = "tired"
	MoodEmptiness   Mood = "emptiness"
)

// Entities are the named things a segment mentions — hooks for future entity
// links; empty slices are fine.
type Entities struct {
	People []string
	Places []string
	Topics []string
}

// Segment is one event-boundary fragment of a diary (Event Segmentation Theory,
// spec 20). The original record stays immutable (constitution §1) — Text is the
// fragment's own content, the embedding input when spec 21 fans it out to a star.
type Segment struct {
	Index     int      // 0-based, contiguous; spec 21 persists it as fragment_index
	Text      string   // fragment body/summary (embedding input — never a record mutation)
	Mood      Mood     // validated 13-value enum (spec 29) — color/UX layer
	Intensity float64  // 0..1 = arousal/salience (memory weight; 21+ wires brightness/links/decay)
	Valence   float64  // -1..1 signed affect (durability/link axis; 0 = neutral/unknown). 21 persists, 26 consumes in λ_eff
	Entities  Entities // people/places/topics
}

// Extraction is the pure result of an Extractor: the diary split into event
// segments. Adapters guarantee Segments is never empty — any parse/validation
// failure degrades to a single whole-text fallback segment (concept §4.6).
type Extraction struct {
	Segments []Segment
}
