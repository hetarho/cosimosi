package invite

import (
	"context"
	"strings"
	"time"

	"github.com/cosimosi/backend/internal/values"
)

// Service owns the invite-gate policy: membership status (gate-aware), non-consuming validation,
// atomic redeem, and admin issuance/list/revoke. It depends only on the Repository port — no
// transport, no db. Code generation (id/code) and the orthogonal model's expiry math live here;
// the consume atomicity lives in the repository tx.
type Service struct {
	repo        Repository
	gateEnabled bool
}

// NewService wires the service over its persistence Repository. gateEnabled mirrors
// INVITE_GATE_ENABLED: when false the gate is transparent — MembershipStatus reports everyone a
// member, so the client never routes to /invite (and server.go omits the membership interceptor).
func NewService(repo Repository, gateEnabled bool) *Service {
	return &Service{repo: repo, gateEnabled: gateEnabled}
}

// MembershipStatus reports whether the caller may enter the core universe. With the gate off,
// every authenticated caller is a member (removability — acceptance A13).
func (s *Service) MembershipStatus(ctx context.Context, userID string) (bool, error) {
	if !s.gateEnabled {
		return true, nil
	}
	return s.repo.IsMember(ctx, userID)
}

// Validate is the non-consuming pre-check for the /invite inline UX. Not authoritative — Redeem
// re-checks atomically. An unknown code is ReasonNotFound (no error).
func (s *Service) Validate(ctx context.Context, code string, now time.Time) (Reason, error) {
	c, ok, err := s.repo.GetByCode(ctx, normalize(code))
	if err != nil {
		return ReasonNotFound, err
	}
	if !ok {
		return ReasonNotFound, nil
	}
	return evaluate(c, now), nil
}

// Redeem atomically consumes a code and grants membership (idempotent for an existing member).
func (s *Service) Redeem(ctx context.Context, code, userID string, now time.Time) (RedeemOutcome, error) {
	return s.repo.Redeem(ctx, normalize(code), userID, now)
}

// Issue mints a code from the orthogonal params: MaxUses nil = unlimited, TTL nil = never. The
// human-enterable code is values.InviteCodeLength chars from crypto/rand.
func (s *Service) Issue(ctx context.Context, p IssueParams, now time.Time) (InviteCode, error) {
	if p.MaxUses != nil && *p.MaxUses <= 0 {
		return InviteCode{}, ErrInvalidMaxUses
	}
	if p.TTL != nil && *p.TTL <= 0 {
		return InviteCode{}, ErrInvalidTTL
	}
	id, err := newID()
	if err != nil {
		return InviteCode{}, err
	}
	code, err := newCode(values.InviteCodeLength)
	if err != nil {
		return InviteCode{}, err
	}
	var expiresAt *time.Time
	if p.TTL != nil {
		t := now.Add(*p.TTL)
		expiresAt = &t
	}
	return s.repo.Issue(ctx, InviteCode{
		ID:        id,
		Code:      code,
		Label:     strings.TrimSpace(p.Label),
		CreatedBy: p.CreatedBy,
		ExpiresAt: expiresAt,
		MaxUses:   p.MaxUses,
	})
}

// List returns all codes newest-first (admin surface).
func (s *Service) List(ctx context.Context) ([]InviteCode, error) {
	return s.repo.List(ctx)
}

// Revoke marks a code revoked, or ErrNotFound when it does not exist.
func (s *Service) Revoke(ctx context.Context, id string) (InviteCode, error) {
	c, ok, err := s.repo.Revoke(ctx, id)
	if err != nil {
		return InviteCode{}, err
	}
	if !ok {
		return InviteCode{}, ErrNotFound
	}
	return c, nil
}
