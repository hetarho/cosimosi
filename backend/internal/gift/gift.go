// Package gift is the shared-memory resonance bounded context (spec 36): sending one
// fragment star to a friend over a token link, the friend accepting by REWRITING the event
// (which births a new star in their universe), and the RESONANCE that links the two stars —
// one event, two engrams across two brains. A separate context from the star graph
// (internal/memory) and universe sharing (internal/share), with its own authenticated
// GiftService.
//
// Domain types here are pure values — no json/db/proto tags (constitution §5). The accept
// path REUSES the spec-21 fan-out core (internal/db/fragment) to persist exactly ONE fragment
// (extract skipped — one event, one memory), so it can never drift from the normal record path.
package gift

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"time"
)

// Validation / control sentinels — the handler maps these to Connect codes (spec-17 pattern).
var (
	// ErrNotFound is the UNIFORM not-found for an unknown token (spec 35 pattern): a guess
	// that doesn't resolve is indistinguishable from any other, so tokens can't be enumerated.
	// A REAL token in a terminal state (accepted/declined/canceled/expired) does NOT return
	// this — the holder proved capability, so they learn the precise state (ErrExpired/…).
	ErrNotFound = errors.New("gift: not found")
	// ErrStarNotFound — SendStarGift on a star that isn't the sender's (or doesn't exist):
	// you can only send your own star.
	ErrStarNotFound = errors.New("gift: star not found")
	// ErrSelfRespond — you cannot accept/decline your OWN gift (acceptance 2.3). Use cancel.
	ErrSelfRespond = errors.New("gift: cannot respond to your own gift")
	// ErrNotPending — the gift was already responded to (accepted/declined/canceled).
	ErrNotPending = errors.New("gift: already responded")
	// ErrExpired — the link is past its 30-day expiry.
	ErrExpired = errors.New("gift: link expired")
	// ErrNotCancelable — CancelStarGift on a gift that isn't the caller's pending gift.
	ErrNotCancelable = errors.New("gift: not cancelable")
	// Rewrite input bounds (records are append-only — the only defense is up-front rejection).
	ErrEmptyText      = errors.New("gift: rewrite text is empty")
	ErrTextTooLong    = errors.New("gift: rewrite text exceeds max length")
	ErrIntensityRange = errors.New("gift: intensity out of range [0,1]")
	ErrValenceRange   = errors.New("gift: valence out of range [-1,1]")
	ErrMessageTooLong = errors.New("gift: message exceeds max length")
)

const (
	// tokenBytes = 16 bytes = 128 bits of crypto entropy → 22 base64url chars (mirrors the
	// spec-35 slug). Raw (unpadded) URL encoding keeps it path-safe with no '=' to escape.
	tokenBytes = 16
	// GiftTTL bounds an unaccepted link's life so it doesn't drift the public internet
	// forever (설계 요점): the gift expires 30 days after creation.
	GiftTTL = 30 * 24 * time.Hour
	// maxMessageRunes bounds the sender's one-line note (a short message, not free text).
	maxMessageRunes = 280
	// maxTextRunes caps the recipient's rewrite — MIRRORS memory.MaxBodyRunes (4000): the
	// rewrite becomes an immutable record body that the embedder must not silently truncate.
	maxTextRunes = 4000
)

// GiftStatus is the gift link's state machine. pending → accepted | declined (recipient) |
// canceled (sender). 'expired' is COMPUTED, never stored (a pending row past its expiry reads
// as expired) — the lazy-expiry pattern from spec 35 (no sweeper job).
type GiftStatus string

const (
	StatusPending  GiftStatus = "pending"
	StatusAccepted GiftStatus = "accepted"
	StatusDeclined GiftStatus = "declined"
	StatusCanceled GiftStatus = "canceled"
	StatusExpired  GiftStatus = "expired" // computed only — never written to the row
)

// Gift is the stored gift row (sender memory's emotion + fragment text folded in by the
// view query). RecipientUserID is "" until accepted/declined; RespondedAt is nil while pending.
type Gift struct {
	ID             string
	Token          string
	SenderUserID   string
	SenderMemoryID string
	Message        string
	Status         GiftStatus // the RAW stored status (effectiveStatus folds in expiry)
	RecipientUserID string
	// FragmentText is the ONE sent fragment (COALESCE(memories.fragment_text, records.body) —
	// never other fragments, never the whole original; acceptance 1.2). Mood is its emotion.
	FragmentText string
	Mood         string // lowercase mood name; "" = unspecified
	CreatedAt    time.Time
	ExpiresAt    time.Time
	RespondedAt  *time.Time
}

// GiftView is what the recipient sees when opening the link (GetStarGift). Content
// (FragmentText/Mood) is populated ONLY when the gift is actionable (pending & not expired) —
// a terminal state shows status alone (no content), so a stale/used link reveals nothing.
type GiftView struct {
	Status            GiftStatus
	SenderDisplayName string // spec 35 display name; "" = anonymous ("어느 우주")
	Message           string
	FragmentText      string
	Mood              string
	ExpiresAt         time.Time
}

// Rewrite is the recipient's own retelling — the accept input. It becomes their immutable
// record + a single fragment star (acceptance 2.1).
type Rewrite struct {
	Text      string
	Mood      string // lowercase mood name
	Intensity float64
	Valence   float64
}

// AcceptResult is the new star the accept transaction birthed — the universe flies to it.
type AcceptResult struct {
	RecordID string
	MemoryID string
}

// CreateGiftInput is the SendStarGift persistence input (the repository mints the row id;
// the service mints the token + expiry, mirroring spec 35's slug-in-service split).
type CreateGiftInput struct {
	Token          string
	SenderUserID   string
	SenderMemoryID string
	Message        string
	ExpiresAt      time.Time
}

// GiftRecord is one gift in a list (ListStarGifts) BEFORE the service folds in the
// counterpart's display name. CounterpartUserID is the recipient (sent list) or the sender
// (received list); "" when unknown (a pending sent gift has no recipient yet). Status is RAW.
type GiftRecord struct {
	GiftID            string
	Token             string
	Status            GiftStatus
	CounterpartUserID string
	Message           string
	CreatedAt         time.Time
	RespondedAt       *time.Time
	ExpiresAt         time.Time
}

// GiftSummary is one gift in a list AFTER enrichment: effective status (expiry folded in) +
// the counterpart's display name (the only cross-user info — acceptance 3.3).
type GiftSummary struct {
	GiftID                 string
	Token                  string
	Status                 GiftStatus
	CounterpartDisplayName string // "" = anonymous / not yet known
	Message                string
	CreatedAt              time.Time
	RespondedAt            *time.Time
	ExpiresAt              time.Time
}

// GiftList is the ListStarGifts result: gifts I sent (any status) + gifts I responded to.
type GiftList struct {
	Sent     []GiftSummary
	Received []GiftSummary
}

// ResonanceInfo is the star-detail panel's "○○의 우주와 공명 중" payload. PartnerSlug is set
// only when the partner shares publicly (spec 35) → a visit link.
type ResonanceInfo struct {
	Resonant           bool
	PartnerDisplayName string
	PartnerSlug        string
}

// ShareReader is the consumer port for the partner/sender public identity (spec 35
// universe_shares). The composition root adapts share.Service so gift never imports share —
// the segmenterAdapter / shareSettingsAdapter precedent. An anonymous / never-shared user
// resolves to displayName "" (→ "어느 우주") with enabled=false (no visit link).
type ShareReader interface {
	DisplayInfo(ctx context.Context, userID string) (displayName, slug string, enabled bool, err error)
}

// effectiveStatus folds lazy expiry into the stored status (spec 35's no-sweeper pattern): a
// still-pending gift whose expiry has passed reads as expired; every other state is returned
// as stored. now is injected so the projection is testable.
func effectiveStatus(stored GiftStatus, expiresAt, now time.Time) GiftStatus {
	if stored == StatusPending && !now.Before(expiresAt) {
		return StatusExpired
	}
	return stored
}

// newToken returns 128 bits of crypto entropy as 22 base64url chars (mirrors spec-35 newSlug).
func newToken() (string, error) {
	var b [tokenBytes]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}
