package admin

import (
	"context"
	"strings"

	"github.com/cosimosi/api/internal/platform/values"
)

// GrantInput is one 별가루 증정: the target, the amount, the operator's note and the client-minted
// grant id that makes a retry idempotent.
type GrantInput struct {
	UserID  string
	Amount  int
	Note    string
	GrantID string
}

// GrantStardust credits GENERAL Twinkle to a user (별가루 증정): validate the cap, record the grant
// + audit rows in one admin tx, then credit through the twinkle earn (idempotent by grantID). Both
// sides key off grantID, so a replay never double-credits or double-records. Returns the target's
// balance total after the grant. ([G3] admin_grant; nothing is deleted/priced/spent.)
func (s *Service) GrantStardust(ctx context.Context, actor string, input GrantInput) (int, error) {
	userID, amount, note, grantID := input.UserID, input.Amount, input.Note, input.GrantID
	target := strings.TrimSpace(userID)
	if target == "" {
		return 0, ErrUserIDRequired
	}
	if amount <= 0 || amount > values.TwinkleAdminGrantMax {
		return 0, ErrGrantAmountRange
	}
	// The client supplies grant_id so a retried grant is idempotent end to end (the twinkle earn
	// and the admin_stardust_grants row both key off it). An empty id is refused: minting one
	// server-side would make a retried direct-RPC call double-credit — the money-path idempotency
	// is server-enforced, not client convention.
	grantID = strings.TrimSpace(grantID)
	if grantID == "" {
		return 0, ErrGrantIDRequired
	}
	grant := TwinkleGrant{
		ID:         grantID,
		GrantedBy:  actor,
		TargetUser: target,
		Amount:     amount,
		Note:       strings.TrimSpace(note),
		CreatedAt:  s.now(),
	}
	audit := s.auditEntry(actor, ActionGrantStardust, target, map[string]string{
		"amount":   itoa(amount),
		"grant_id": grantID,
	})
	// Record BEFORE crediting: the globally-unique grant row is the idempotency lock. Twinkle
	// dedups per (user, grant id) only, so crediting first would let a grant id reused for a
	// DIFFERENT user credit them with no grant/audit row. Recording first turns that reuse into
	// a refusal below, and a crash between record and credit heals on replay (the credit dedups).
	applied, err := s.store.RecordGrant(ctx, grant, audit)
	if err != nil {
		return 0, err
	}
	if !applied {
		existing, err := s.store.GetGrant(ctx, grantID)
		if err != nil {
			return 0, err
		}
		if existing == nil || existing.TargetUser != target || existing.Amount != amount {
			return 0, ErrGrantIDConflict
		}
		// A true replay of the same grant: fall through — the credit below is a dedup no-op
		// that returns the current balance.
	}
	total, err := s.stardust.Grant(ctx, target, amount, grantID)
	if err != nil {
		return 0, err
	}
	return total, nil
}

// ListTwinkleGrants returns one page of the grant history (newest first) for accountability.
func (s *Service) ListTwinkleGrants(ctx context.Context, page int, pageSize int) (GrantPage, error) {
	if pageSize <= 0 {
		pageSize = values.AdminUserListPageSize
	}
	if page < 0 {
		page = 0
	}
	grants, hasMore, err := s.store.ListGrants(ctx, page, pageSize)
	if err != nil {
		return GrantPage{}, err
	}
	return GrantPage{Grants: grants, Page: page, HasMore: hasMore}, nil
}
