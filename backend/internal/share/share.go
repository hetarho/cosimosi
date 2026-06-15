// Package share is the universe-sharing bounded context (spec 35): owner share settings
// (toggle / display name / slug rotation) plus the assembly of a PUBLIC, content-zero
// snapshot of a universe's landscape (stars' color·intensity·dates + synapses + the owner's
// visual settings). A separate context from the star graph (internal/memory) and settings
// (internal/settings), with its own ShareService (authenticated) + VisitService (public).
//
// Domain types here are pure values — no json/db/proto tags (constitution §5). The public
// snapshot carries NO diary/fragment text, NO ids, NO precise timestamps — content-zero is a
// type guarantee (acceptance 1.1): the fields simply do not exist on SharedStar/SharedSynapse.
package share

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"time"
)

// Validation / control sentinels — the handler maps these to Connect codes (spec-17 pattern).
var (
	// ErrNotFound is the UNIFORM not-found for the public surface (acceptance 1.2): an unknown
	// slug AND a disabled share both surface as this, so a visitor can't distinguish "never
	// existed" from "turned off" from "empty universe" (existence is not advertised).
	ErrNotFound = errors.New("share: not found")
	// ErrNotShared is returned when rotating a slug for a user who has never enabled sharing —
	// there is nothing to rotate yet (the UI enables first, then can rotate).
	ErrNotShared = errors.New("share: sharing not enabled yet")
	// ErrDisplayNameTooLong rejects an over-long display name before it is persisted (17 — input
	// bounds on a public-facing string).
	ErrDisplayNameTooLong = errors.New("share: display name too long")
)

// maxDisplayNameRunes bounds the owner's public display name (a short label like "○○의 우주",
// not free text). Generous, but shuts down an unbounded public string.
const maxDisplayNameRunes = 60

// slugBytes is 16 bytes = 128 bits of crypto entropy → 22 base64url chars (acceptance 1.4).
const slugBytes = 16

// Settings is the owner's share configuration (the ShareService surface). Slug is "" until
// sharing is first enabled (the first enable mints it). A zero Settings = "never shared".
type Settings struct {
	Enabled     bool
	Slug        string
	DisplayName string
}

// EmotionColor / Appearance MIRROR the spec-30 visual overrides without importing the settings
// bounded context — the composition root adapts settings.Service into SettingsReader (the
// segmenterAdapter precedent). Empty Theme/StarObject = "use the client default".
type EmotionColor struct {
	Mood  string // lowercase enum name ("joy".."emptiness", spec 29)
	Color string // "#RRGGBB"
}

// Appearance is the owner's visual landscape (part of what's shared — spec 35 참고/30).
type Appearance struct {
	Theme         string
	StarObject    string
	EmotionColors []EmotionColor
}

// SharedStar is the PUBLIC projection of one star: emotion (→ color) + intensity (→ size) +
// DAY-quantized timestamps. Deliberately NO id / text / precise time — content-zero by type.
type SharedStar struct {
	Mood            string // lowercase enum name; "" = unspecified
	Intensity       float64
	LastRecalledDay int64 // epoch days (UTC), quantized
	CreatedDay      int64 // epoch days (UTC), quantized
}

// SharedSynapse links two SharedStars by their snapshot-array INDEX (not ids — those never
// leave the server). Only weight is exposed.
type SharedSynapse struct {
	A      int
	B      int
	Weight float64
}

// Snapshot is the assembled public landscape for one shared universe. Ambient (요즘 하늘색,
// spec 25) is intentionally NOT computed here — the client derives it from these same stars
// (deriveAmbient, the demo/fallback path), keeping this context decoupled from memory's
// ambient aggregation; the proto Ambient field stays unset for forward server-side use.
type Snapshot struct {
	DisplayName string
	Stars       []SharedStar
	Synapses    []SharedSynapse
	Appearance  Appearance
}

// StarLandscape is the repository read model for one star's landscape columns. ID stays
// server-side — used ONLY to map synapse endpoints → snapshot indices; it never enters a DTO.
type StarLandscape struct {
	ID             string
	Mood           string
	Intensity      float64
	LastRecalledAt time.Time
	CreatedAt      time.Time
}

// SynapseLandscape is the repository read model for one synapse's landscape columns (endpoint
// ids + weight; activation time / co-activation are NOT read — behavioral signals stay private).
type SynapseLandscape struct {
	AID    string
	BID    string
	Weight float64
}

// Repository is the persistence port (pgx/sqlc impl in repository_pg.go).
type Repository interface {
	// GetByUser returns the owner's settings; ok=false when no row exists (never shared).
	GetByUser(ctx context.Context, userID string) (Settings, bool, error)
	// Upsert creates (with the given freshly-minted slug) or updates the owner's row; on an
	// existing row the slug is PRESERVED (rotation is the only way to change it).
	Upsert(ctx context.Context, userID, slug string, enabled bool, displayName string) (Settings, error)
	// Rotate replaces the slug; ok=false when no row exists (nothing to rotate).
	Rotate(ctx context.Context, userID, slug string) (Settings, bool, error)
	// UserBySlug resolves an ENABLED slug to its owner (+ display name); ok=false for an
	// unknown or disabled slug (→ uniform NotFound).
	UserBySlug(ctx context.Context, slug string) (userID, displayName string, ok bool, err error)
	// ListStars / ListSynapses read only the landscape columns for the public snapshot.
	ListStars(ctx context.Context, userID string) ([]StarLandscape, error)
	ListSynapses(ctx context.Context, userID string) ([]SynapseLandscape, error)
}

// SettingsReader is the consumer port for the owner's spec-30 visual overrides — adapted from
// settings.Service by the composition root so this package never imports settings.
type SettingsReader interface {
	Appearance(ctx context.Context, userID string) (Appearance, error)
}

// ResonancePair is one caller↔owner resonance (spec 36) as the gift context reports it:
// MyMemoryID is the CALLER's star, TheirMemoryID the owner's. The share service maps
// TheirMemoryID to a public-snapshot index (the owner's id never leaves the server).
type ResonancePair struct {
	MyMemoryID    string
	TheirMemoryID string
}

// ResonanceReader is the consumer port for spec-36 resonances (spec 37 overlay bridges) —
// adapted from gift.Service by the composition root so share never imports gift (the
// SettingsReader precedent). Returns the pairs whose two ends belong to caller and owner;
// empty for a non-party caller (the existence of a resonance is never disclosed).
type ResonanceReader interface {
	ResonancesBetween(ctx context.Context, callerUserID, ownerUserID string) ([]ResonancePair, error)
}

// ResonanceBridge is the PUBLIC overlay datum (spec 37): the caller's own star id + the
// partner star's INDEX in this slug's GetSharedUniverse response array. No partner id, no
// content — the client places a bridge endpoint by index without learning anything private.
type ResonanceBridge struct {
	MyMemoryID     string
	TheirStarIndex int
}

// newSlug returns 128 bits of crypto entropy as 22 base64url chars (acceptance 1.4). Raw
// (unpadded) URL encoding keeps it path-safe with no '=' to escape.
func newSlug() (string, error) {
	var b [slugBytes]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}

// toEpochDay quantizes an instant to its UTC epoch-day count — the public projection (acceptance
// 1.1 / 설계 요점): the visitor learns the DAY a star was last touched, never the exact instant
// (blunts behavioral fingerprinting). A zero time → 0.
func toEpochDay(t time.Time) int64 {
	if t.IsZero() {
		return 0
	}
	return t.UTC().Unix() / int64((24 * time.Hour).Seconds())
}
