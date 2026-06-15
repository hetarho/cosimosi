package gift

import (
	"context"
	"time"
)

// Repository is the persistence port for the gift context (pgx/sqlc impl in repository_pg.go).
// The service owns policy (token minting, input validation, self-respond rule, display-name
// enrichment); the repository owns the atomic state transitions and the accept transaction.
type Repository interface {
	// CreateGift inserts a pending gift, but ONLY if SenderMemoryID is the sender's own star —
	// otherwise ErrStarNotFound (you can't send someone else's star). The row id is minted here.
	CreateGift(ctx context.Context, in CreateGiftInput) error

	// GetByToken resolves a token to its stored gift (+ the sent fragment's text/mood folded in
	// by the view query). ErrNotFound for an unknown token (uniform — spec 35).
	GetByToken(ctx context.Context, token string) (Gift, error)

	// AcceptGift runs the accept transaction ATOMICALLY (acceptance 2.1): lock the gift row,
	// re-check it's pending & not expired (the authoritative guard — TOCTOU-safe), then create
	// the recipient's immutable record + a SINGLE fragment star (extract skipped) + the embed
	// job + the resonance, and mark the gift accepted. Any failure rolls the whole thing back.
	// Sentinels: ErrNotFound (unknown token), ErrExpired, ErrNotPending, ErrSelfRespond.
	AcceptGift(ctx context.Context, token, recipientUserID string, rw Rewrite, now time.Time) (AcceptResult, error)

	// DeclineGift atomically transitions a pending, unexpired gift to declined (single guarded
	// UPDATE — atomic on its own). ok=false when the guard matches no row (already responded /
	// expired / raced); the caller maps that to ErrNotPending.
	DeclineGift(ctx context.Context, token, recipientUserID string) (ok bool, err error)

	// CancelGift atomically transitions the SENDER's own pending gift to canceled (acceptance
	// 1.4 — the link dies at once). ok=false when no matching pending row (not theirs / already
	// responded / unknown) → ErrNotCancelable.
	CancelGift(ctx context.Context, giftID, senderUserID string) (ok bool, err error)

	// ListSent / ListReceived return the user's gift rows (RAW status; CounterpartUserID set —
	// recipient for sent, sender for received). The service folds in effective status + display
	// names. A pending sent gift has no recipient yet (CounterpartUserID "").
	ListSent(ctx context.Context, userID string) ([]GiftRecord, error)
	ListReceived(ctx context.Context, userID string) ([]GiftRecord, error)

	// ResonancePartnerUserID returns the owner of the star on the OTHER side of memoryID's
	// resonance (if memoryID is one of the caller's resonant stars). ok=false = not resonant.
	ResonancePartnerUserID(ctx context.Context, memoryID, userID string) (partnerUserID string, ok bool, err error)
}
