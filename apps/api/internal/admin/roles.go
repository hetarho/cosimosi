package admin

import (
	"context"
	"strings"
)

// IsAdmin reports whether the caller is an admin: a seed id, a seed email (resolved through the
// directory only when email seeds exist, so the common id-only case makes no extra call), or a
// DB-promoted row. The admin-authorization interceptor calls this to gate every admin.v1 method.
func (s *Service) IsAdmin(ctx context.Context, userID string) (bool, error) {
	if userID == "" {
		return false, nil
	}
	// Dev-auth bypass: any authenticated caller is an admin so `pnpm dev` reaches /admin without
	// seeding ADMIN_USER_IDS. Gated behind COSIMOSI_DEV_AUTH — never set in production.
	if s.devMode {
		return true, nil
	}
	if _, ok := s.seedIDs[userID]; ok {
		return true, nil
	}
	if len(s.seedEmails) > 0 {
		email, err := s.directory.EmailFor(ctx, userID)
		if err == nil {
			if _, ok := s.seedEmails[strings.ToLower(strings.TrimSpace(email))]; ok {
				return true, nil
			}
		}
		// A directory lookup failure is not authorization — fall through to the DB role check.
	}
	return s.store.IsPromoted(ctx, userID)
}

// GetAdminSelf is the FE gate/affordance source: whether the caller is an admin.
func (s *Service) GetAdminSelf(ctx context.Context, userID string) (bool, error) {
	return s.IsAdmin(ctx, userID)
}

// ListAdmins returns the effective admin set: seed ids first (undemotable), then DB-promoted rows.
func (s *Service) ListAdmins(ctx context.Context) ([]AdminEntry, error) {
	promoted, err := s.store.ListPromoted(ctx)
	if err != nil {
		return nil, err
	}
	entries := make([]AdminEntry, 0, len(s.seedIDs)+len(promoted))
	for id := range s.seedIDs {
		entries = append(entries, AdminEntry{UserID: id, IsSeed: true})
	}
	for _, p := range promoted {
		if _, isSeed := s.seedIDs[p.UserID]; isSeed {
			continue // a seed id also promoted in DB is reported once, as seed
		}
		entries = append(entries, AdminEntry{
			UserID:    p.UserID,
			GrantedBy: p.GrantedBy,
			GrantedAt: p.GrantedAt,
		})
	}
	return entries, nil
}

// GrantAdmin promotes a user (idempotent) and audits it. Returns the new admin status (always
// true on success).
func (s *Service) GrantAdmin(ctx context.Context, actor string, userID string) (bool, error) {
	target := strings.TrimSpace(userID)
	if target == "" {
		return false, ErrUserIDRequired
	}
	audit := s.auditEntry(actor, ActionGrantAdmin, target, nil)
	if err := s.store.Promote(ctx, target, actor, audit); err != nil {
		return false, err
	}
	return true, nil
}

// RevokeAdmin demotes a DB-promoted admin and audits it. A seed admin is refused
// (ErrSeedAdminUndemotable) — the env set is the trust anchor. Returns the admin status after the
// call (false when demoted or already not promoted).
func (s *Service) RevokeAdmin(ctx context.Context, actor string, userID string) (bool, error) {
	target := strings.TrimSpace(userID)
	if target == "" {
		return false, ErrUserIDRequired
	}
	if _, isSeed := s.seedIDs[target]; isSeed {
		return true, ErrSeedAdminUndemotable
	}
	// Email seeds are as undemotable as id seeds (mirrors isSeedIdentity). Unlike IsAdmin's
	// read-only fall-through, a directory failure here fails CLOSED: proceeding would delete a
	// DB promotion that may be the target's only effective admin bit during the same outage
	// (IsAdmin also falls back to the DB row then), and would record a revoke_admin audit for a
	// seed the env still protects. Revoke is rare — refusing on a flaky lookup costs nothing.
	if len(s.seedEmails) > 0 {
		email, err := s.directory.EmailFor(ctx, target)
		if err != nil {
			return false, err
		}
		if _, isSeed := s.seedEmails[strings.ToLower(strings.TrimSpace(email))]; isSeed {
			return true, ErrSeedAdminUndemotable
		}
	}
	audit := s.auditEntry(actor, ActionRevokeAdmin, target, nil)
	if _, err := s.store.Revoke(ctx, target, audit); err != nil {
		return false, err
	}
	return false, nil
}

func (s *Service) isSeedIdentity(userID string, email string) bool {
	if _, ok := s.seedIDs[userID]; ok {
		return true
	}
	if _, ok := s.seedEmails[strings.ToLower(strings.TrimSpace(email))]; ok {
		return true
	}
	return false
}
