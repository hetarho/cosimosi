package gift

import (
	"context"
	"math"
	"strings"
	"time"
	"unicode/utf8"
)

// Service owns the gift policy: token minting + 30-day expiry (crypto/rand), the send/
// accept/decline/cancel state machine, accept-input validation, the self-respond rule
// (acceptance 2.3), and folding spec-35 display names onto list/resonance reads. It depends
// only on ports — no transport, no db.
type Service struct {
	repo  Repository
	share ShareReader
}

// NewService wires the gift service over its persistence Repository and a ShareReader (the
// counterpart's spec-35 public identity, adapted from share.Service by the composition root).
func NewService(repo Repository, share ShareReader) *Service {
	return &Service{repo: repo, share: share}
}

// SendGift mints a token + 30-day expiry and persists a pending gift for the sender's own
// star (acceptance 1.1 — the FE shows the disclosure notice before calling this). The message
// is trimmed and bounded. ErrStarNotFound when the star isn't the sender's (repo guard).
func (s *Service) SendGift(ctx context.Context, senderUserID, memoryID, message string) (string, error) {
	message = strings.TrimSpace(message)
	if utf8.RuneCountInString(message) > maxMessageRunes {
		return "", ErrMessageTooLong
	}
	token, err := newToken()
	if err != nil {
		return "", err
	}
	if err := s.repo.CreateGift(ctx, CreateGiftInput{
		Token:          token,
		SenderUserID:   senderUserID,
		SenderMemoryID: memoryID,
		Message:        message,
		ExpiresAt:      time.Now().UTC().Add(GiftTTL),
	}); err != nil {
		return "", err
	}
	return token, nil
}

// GetGift assembles the recipient's view of a link (GetStarGift). Unknown token → ErrNotFound
// (uniform). Content (fragment text + mood) is returned ONLY when the gift is actionable
// (pending & not expired); a terminal state returns status alone (acceptance 1.3). The sender
// display name is best-effort — a share-read failure degrades to anonymous, never denies the view.
func (s *Service) GetGift(ctx context.Context, token string) (GiftView, error) {
	g, err := s.repo.GetByToken(ctx, token)
	if err != nil {
		return GiftView{}, err
	}
	status := effectiveStatus(g.Status, g.ExpiresAt, time.Now().UTC())
	view := GiftView{Status: status, ExpiresAt: g.ExpiresAt}
	// Terminal/expired = "status alone" (acceptance 1.3): a used/retracted/dead link reveals
	// NOTHING — not the fragment, not the message, not even the sender's name (a canceled link
	// must not survive as relationship/message metadata; codex). Only an actionable gift shows content.
	if status == StatusPending {
		view.Message = g.Message
		view.FragmentText = g.FragmentText
		view.Mood = g.Mood
		if name, _, _, derr := s.share.DisplayInfo(ctx, g.SenderUserID); derr == nil {
			view.SenderDisplayName = name
		}
	}
	return view, nil
}

// AcceptGift validates the rewrite (records are append-only, so this is the only defense),
// rejects self-accept (2.3) and a non-actionable state, then delegates the atomic transaction
// (record + single fragment star + resonance + embed job) to the repository (2.1). The repo's
// locked re-check is authoritative; the early check here just yields a clean error without a tx.
func (s *Service) AcceptGift(ctx context.Context, recipientUserID, token string, rw Rewrite) (AcceptResult, error) {
	rw.Text = strings.TrimSpace(rw.Text)
	if rw.Text == "" {
		return AcceptResult{}, ErrEmptyText
	}
	if utf8.RuneCountInString(rw.Text) > maxTextRunes {
		return AcceptResult{}, ErrTextTooLong
	}
	// NaN compares false to both bounds — reject explicitly (binary protobuf can carry NaN).
	if math.IsNaN(rw.Intensity) || rw.Intensity < 0 || rw.Intensity > 1 {
		return AcceptResult{}, ErrIntensityRange
	}
	if math.IsNaN(rw.Valence) || rw.Valence < -1 || rw.Valence > 1 {
		return AcceptResult{}, ErrValenceRange
	}
	g, err := s.repo.GetByToken(ctx, token)
	if err != nil {
		return AcceptResult{}, err
	}
	if g.SenderUserID == recipientUserID {
		return AcceptResult{}, ErrSelfRespond
	}
	if err := actionable(g, time.Now().UTC()); err != nil {
		return AcceptResult{}, err
	}
	return s.repo.AcceptGift(ctx, token, recipientUserID, rw, time.Now().UTC())
}

// DeclineGift records a recipient's refusal (status only — no reason). Unknown → ErrNotFound;
// own gift → ErrSelfRespond (use cancel); non-actionable → ErrExpired/ErrNotPending. The
// guarded UPDATE is authoritative — a lost race (someone accepted meanwhile) surfaces as
// ErrNotPending.
func (s *Service) DeclineGift(ctx context.Context, recipientUserID, token string) error {
	g, err := s.repo.GetByToken(ctx, token)
	if err != nil {
		return err
	}
	if g.SenderUserID == recipientUserID {
		return ErrSelfRespond
	}
	if err := actionable(g, time.Now().UTC()); err != nil {
		return err
	}
	ok, err := s.repo.DeclineGift(ctx, token, recipientUserID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrNotPending
	}
	return nil
}

// CancelGift invalidates the sender's own pending gift (acceptance 1.4). Not-theirs / already-
// responded / unknown → ErrNotCancelable (the repo guard matched no row).
func (s *Service) CancelGift(ctx context.Context, senderUserID, giftID string) error {
	ok, err := s.repo.CancelGift(ctx, giftID, senderUserID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrNotCancelable
	}
	return nil
}

// ListGifts returns the caller's sent + received gifts with effective status and the
// counterpart's display name folded in (acceptance 3.3). Display names are resolved
// best-effort and deduped within the call (a share-read failure degrades that row to "").
func (s *Service) ListGifts(ctx context.Context, userID string) (GiftList, error) {
	sent, err := s.repo.ListSent(ctx, userID)
	if err != nil {
		return GiftList{}, err
	}
	received, err := s.repo.ListReceived(ctx, userID)
	if err != nil {
		return GiftList{}, err
	}
	now := time.Now().UTC()
	names := map[string]string{} // dedupe display-name lookups across both lists
	return GiftList{
		Sent:     s.toSummaries(ctx, sent, now, names),
		Received: s.toSummaries(ctx, received, now, names),
	}, nil
}

// GetResonanceInfo answers the star-detail panel: is this star resonant, and if so who is the
// partner (display name + visit slug when they share publicly). Not resonant → Resonant:false.
func (s *Service) GetResonanceInfo(ctx context.Context, userID, memoryID string) (ResonanceInfo, error) {
	partnerID, ok, err := s.repo.ResonancePartnerUserID(ctx, memoryID, userID)
	if err != nil {
		return ResonanceInfo{}, err
	}
	if !ok {
		return ResonanceInfo{Resonant: false}, nil
	}
	info := ResonanceInfo{Resonant: true}
	if name, slug, enabled, derr := s.share.DisplayInfo(ctx, partnerID); derr == nil {
		info.PartnerDisplayName = name
		if enabled {
			info.PartnerSlug = slug // visit link only when the partner shares (spec 35)
		}
	}
	return info, nil
}

// ResonancesBetween returns the caller↔owner resonance pairs for the overlay (spec 37). A
// pure pass-through to the repo: the share context owns the index mapping + party policy, so
// gift just supplies which of the caller's stars resonate with which of the owner's. Self
// (caller == owner) yields none — a resonance always spans two users (self-accept is rejected).
func (s *Service) ResonancesBetween(ctx context.Context, callerUserID, ownerUserID string) ([]ResonancePair, error) {
	if callerUserID == ownerUserID {
		return nil, nil
	}
	return s.repo.ResonancesBetween(ctx, callerUserID, ownerUserID)
}

// toSummaries folds effective status (expiry) + the counterpart display name onto raw gift
// rows. names caches lookups within the call so a counterpart appearing twice costs one read.
func (s *Service) toSummaries(ctx context.Context, recs []GiftRecord, now time.Time, names map[string]string) []GiftSummary {
	out := make([]GiftSummary, 0, len(recs))
	for _, r := range recs {
		name := ""
		if r.CounterpartUserID != "" {
			if cached, seen := names[r.CounterpartUserID]; seen {
				name = cached
			} else if n, _, _, derr := s.share.DisplayInfo(ctx, r.CounterpartUserID); derr == nil {
				name = n
				names[r.CounterpartUserID] = n
			}
		}
		out = append(out, GiftSummary{
			GiftID:                 r.GiftID,
			Token:                  r.Token,
			Status:                 effectiveStatus(r.Status, r.ExpiresAt, now),
			CounterpartDisplayName: name,
			Message:                r.Message,
			CreatedAt:              r.CreatedAt,
			RespondedAt:            r.RespondedAt,
			ExpiresAt:              r.ExpiresAt,
		})
	}
	return out
}

// actionable reports whether a gift can still be accepted/declined: ErrExpired when past
// expiry, ErrNotPending for any other non-pending state, nil when pending & live.
func actionable(g Gift, now time.Time) error {
	switch effectiveStatus(g.Status, g.ExpiresAt, now) {
	case StatusPending:
		return nil
	case StatusExpired:
		return ErrExpired
	default:
		return ErrNotPending
	}
}
