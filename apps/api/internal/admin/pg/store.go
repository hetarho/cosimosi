// Package pg is the admin context's only sqlc/pgx seam (ARCHITECTURE §2.6): the concrete
// admin.Store over admin_users, admin_stardust_grants, admin_audit_log, and ai_provider_config,
// with row↔domain mapping at this edge — no dbgen type escapes inward. Every mutating method runs
// the mutation and its admin_audit_log append in ONE transaction, so a sensitive admin action is
// never recorded without its audit trail ([I1], A9). It declares no interface; the port is
// consumer-owned by the admin use-case.
package pg

import (
	"context"
	"encoding/json"
	"errors"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/admin"
	"github.com/cosimosi/api/internal/ai"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var (
	ErrQueriesRequired   = errors.New("admin store requires database queries")
	ErrTxStarterRequired = errors.New("admin store requires a transaction-capable pool")
)

type Store struct {
	queries *dbgen.Queries
	txer    txStarter
}

type txStarter interface {
	BeginTx(context.Context, pgx.TxOptions) (pgx.Tx, error)
}

func NewStore(db dbgen.DBTX) Store {
	store := Store{queries: dbgen.New(db)}
	if txer, ok := db.(txStarter); ok {
		store.txer = txer
	}
	return store
}

func (s Store) IsPromoted(ctx context.Context, userID string) (bool, error) {
	if s.queries == nil {
		return false, ErrQueriesRequired
	}
	return s.queries.IsPromotedAdmin(ctx, userID)
}

func (s Store) ListPromoted(ctx context.Context) ([]admin.PromotedAdmin, error) {
	if s.queries == nil {
		return nil, ErrQueriesRequired
	}
	rows, err := s.queries.ListPromotedAdmins(ctx)
	if err != nil {
		return nil, err
	}
	admins := make([]admin.PromotedAdmin, 0, len(rows))
	for _, row := range rows {
		admins = append(admins, admin.PromotedAdmin{
			UserID:    row.UserID,
			GrantedBy: row.GrantedBy,
			GrantedAt: row.GrantedAt.Time,
		})
	}
	return admins, nil
}

func (s Store) Promote(ctx context.Context, userID string, grantedBy string, audit admin.AuditEntry) error {
	return s.inTx(ctx, func(q *dbgen.Queries) error {
		if err := q.PromoteAdmin(ctx, dbgen.PromoteAdminParams{UserID: userID, GrantedBy: grantedBy}); err != nil {
			return err
		}
		return appendAudit(ctx, q, audit)
	})
}

func (s Store) Revoke(ctx context.Context, userID string, audit admin.AuditEntry) (bool, error) {
	removed := false
	err := s.inTx(ctx, func(q *dbgen.Queries) error {
		affected, err := q.RevokeAdmin(ctx, userID)
		if err != nil {
			return err
		}
		removed = affected > 0
		return appendAudit(ctx, q, audit)
	})
	if err != nil {
		return false, err
	}
	return removed, nil
}

func (s Store) RecordGrant(ctx context.Context, grant admin.TwinkleGrant, audit admin.AuditEntry) (bool, error) {
	applied := false
	err := s.inTx(ctx, func(q *dbgen.Queries) error {
		affected, err := q.InsertTwinkleGrant(ctx, dbgen.InsertTwinkleGrantParams{
			ID:         grant.ID,
			GrantedBy:  grant.GrantedBy,
			TargetUser: grant.TargetUser,
			Amount:     int32(grant.Amount),
			Note:       grant.Note,
		})
		if err != nil {
			return err
		}
		applied = affected > 0
		// A replay (applied=false) still records no second audit row: the grant id already
		// audited its first application, so skip the append to keep the log free of duplicates.
		if !applied {
			return nil
		}
		return appendAudit(ctx, q, audit)
	})
	if err != nil {
		return false, err
	}
	return applied, nil
}

func (s Store) ListGrants(ctx context.Context, page int, pageSize int) ([]admin.TwinkleGrant, bool, error) {
	if s.queries == nil {
		return nil, false, ErrQueriesRequired
	}
	// Over-fetch one row to detect a next page without a second count query.
	rows, err := s.queries.ListTwinkleGrants(ctx, dbgen.ListTwinkleGrantsParams{
		Limit:  int32(pageSize + 1),
		Offset: int32(page * pageSize),
	})
	if err != nil {
		return nil, false, err
	}
	hasMore := len(rows) > pageSize
	if hasMore {
		rows = rows[:pageSize]
	}
	grants := make([]admin.TwinkleGrant, 0, len(rows))
	for _, row := range rows {
		grants = append(grants, admin.TwinkleGrant{
			ID:         row.ID,
			GrantedBy:  row.GrantedBy,
			TargetUser: row.TargetUser,
			Amount:     int(row.Amount),
			Note:       row.Note,
			CreatedAt:  row.CreatedAt.Time,
		})
	}
	return grants, hasMore, nil
}

func (s Store) GetAIConfig(ctx context.Context, capability admin.AICapability) (*admin.StoredAIConfig, error) {
	if s.queries == nil {
		return nil, ErrQueriesRequired
	}
	row, err := s.queries.GetAIProviderConfig(ctx, string(capability))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &admin.StoredAIConfig{
		Capability:      admin.AICapability(row.Capability),
		Provider:        row.Provider,
		Model:           row.Model,
		BaseURL:         row.BaseUrl,
		APIKeyEncrypted: row.ApiKeyEncrypted,
		KeyHint:         row.KeyHint,
		UpdatedBy:       row.UpdatedBy,
		UpdatedAt:       row.UpdatedAt.Time,
	}, nil
}

func (s Store) UpsertAIConfig(ctx context.Context, cfg admin.StoredAIConfig, audit admin.AuditEntry) error {
	return s.inTx(ctx, func(q *dbgen.Queries) error {
		if err := q.UpsertAIProviderConfig(ctx, dbgen.UpsertAIProviderConfigParams{
			Capability:      string(cfg.Capability),
			Provider:        cfg.Provider,
			Model:           cfg.Model,
			BaseUrl:         cfg.BaseURL,
			ApiKeyEncrypted: cfg.APIKeyEncrypted,
			KeyHint:         cfg.KeyHint,
			UpdatedBy:       cfg.UpdatedBy,
			UpdatedAt:       pgtype.Timestamptz{Time: cfg.UpdatedAt, Valid: true},
		}); err != nil {
			return err
		}
		return appendAudit(ctx, q, audit)
	})
}

// ReadProviderConfig implements ai.ConfigReader: it feeds the runtime AI-config source the stored
// provider selection (the ai_provider_config table admin owns). Returned Found=false when unset,
// so the source falls back to env → keyless mock. The ciphertext is returned as-is; the source
// decrypts it (admin/pg never handles the plaintext key).
func (s Store) ReadProviderConfig(ctx context.Context, capability string) (ai.ConfigRecord, error) {
	if s.queries == nil {
		return ai.ConfigRecord{}, ErrQueriesRequired
	}
	row, err := s.queries.GetAIProviderConfig(ctx, capability)
	if errors.Is(err, pgx.ErrNoRows) {
		return ai.ConfigRecord{Found: false}, nil
	}
	if err != nil {
		return ai.ConfigRecord{}, err
	}
	return ai.ConfigRecord{
		Provider:        row.Provider,
		Model:           row.Model,
		BaseURL:         row.BaseUrl,
		APIKeyEncrypted: row.ApiKeyEncrypted,
		Found:           true,
	}, nil
}

// inTx runs fn against a queries bound to one pgx transaction, committing on success.
func (s Store) inTx(ctx context.Context, fn func(q *dbgen.Queries) error) error {
	if s.queries == nil {
		return ErrQueriesRequired
	}
	if s.txer == nil {
		return ErrTxStarterRequired
	}
	tx, err := s.txer.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	if err := fn(s.queries.WithTx(tx)); err != nil {
		_ = tx.Rollback(ctx)
		return err
	}
	return tx.Commit(ctx)
}

func appendAudit(ctx context.Context, q *dbgen.Queries, audit admin.AuditEntry) error {
	detail, err := json.Marshal(auditDetail(audit.Detail))
	if err != nil {
		return err
	}
	return q.InsertAdminAuditLog(ctx, dbgen.InsertAdminAuditLogParams{
		ID:     audit.ID,
		Actor:  audit.Actor,
		Action: audit.Action,
		Target: audit.Target,
		Detail: detail,
	})
}

// auditDetail normalizes a nil map to an empty object so the JSONB column is never NULL.
func auditDetail(detail map[string]string) map[string]string {
	if detail == nil {
		return map[string]string{}
	}
	return detail
}
