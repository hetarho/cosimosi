package twinkle

import (
	"context"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// The earn/spend use-cases' consumer-owned ports (§2.4/§2.9#6). Declared HERE
// because the twinkle use-cases are the consumers: the ledger store they compose
// their transactions from, the depth-signal reads a quote prices, the SMALL day
// boundary ([U7]), and the trusted invite/signup resolver ([G6]). Domain-shaped in
// and out — no proto, sqlc, pgx, or SDK type crosses any of them, and no memory
// type either: depth signals arrive as scalars (§2.2).

// LedgerStore is the ledger repository surface one earn/spend composes: the balance
// facts read, the guarded balance delta, and the append-only log write. The concrete
// is twinkle/pg's Store — bound to the pool for reads, to a transaction inside
// InLedgerTx, or (via the composition root's economy seam) to a memory transaction
// so a spend/earn joins the recall/launch it belongs to.
type LedgerStore interface {
	GetBalanceRecord(ctx context.Context, scope platform.UserScope) (*BalanceRecord, error)
	ApplyBalanceDelta(ctx context.Context, scope platform.UserScope, resetWindow time.Time, generalDelta int, smallSpentDelta int) (BalanceRecord, error)
	AppendLedgerEntry(ctx context.Context, scope platform.UserScope, entry LedgerEntry) (bool, error)
	LockInviteRewardsByInviter(ctx context.Context, scope platform.UserScope) error
	GetInviteRewardState(ctx context.Context, scope platform.UserScope, dedupKey string) (rewardCount int64, replay bool, err error)
	// ListLedgerPage reads one keyset page of the user's history, newest first. A nil cursor starts at
	// the newest row; `limit` is the store's ceiling, and the use-case asks for one extra row to learn
	// whether a next page exists without a second count query.
	ListLedgerPage(ctx context.Context, scope platform.UserScope, cursor *LedgerCursor, limit int) ([]LedgerEntry, error)
}

// LedgerRepo is the standalone ledger seam: the pool-bound reads plus the
// own-transaction runner the RPC-driven earns (invite, charge) and the tx-less
// gist-view spend use.
type LedgerRepo interface {
	LedgerStore
	GetBalanceRecords(ctx context.Context, userIDs []string) (map[string]BalanceRecord, error)
	InLedgerTx(ctx context.Context, fn func(tx LedgerTx) error) error
}

// ZoneReader is the SMALL reset boundary's authority ([G2][U7]): the scoped user's IANA zone
// NAME. A scalar deliberately — no account type and no *time.Location crosses the boundary, so this
// context never imports account and never queries users (§2.2/§2.4); resolving the name to a
// location is the service's job, and an unresolvable one reads as UTC ([G5]: a missing zone may
// never deny a refill). The concrete adapter lives at the composition root over account's published
// profile read.
type ZoneReader interface {
	ZoneFor(ctx context.Context, scope platform.UserScope) (string, error)
}

// UserZoneReader is the pool-bound zone authority for reads outside a transaction, with the batch
// form the admin list uses.
type UserZoneReader interface {
	ZoneReader
	ZonesFor(ctx context.Context, userIDs []string) (map[string]string, error)
}

// LedgerTx is the ledger store of one open transaction together with a zone read on that same
// connection: an earn or spend inside a transaction already holds a pooled connection, so reading
// the zone through the pool would wait on a second one and can exhaust the pool (ARCH-9).
type LedgerTx interface {
	LedgerStore
	ZoneReader
}

// BindLedgerTx pairs a transaction-bound ledger store with the zone reader bound to the same
// transaction.
func BindLedgerTx(ledger LedgerStore, zones ZoneReader) LedgerTx {
	return boundLedgerTx{LedgerStore: ledger, zones: zones}
}

type boundLedgerTx struct {
	LedgerStore
	zones ZoneReader
}

func (b boundLedgerTx) ZoneFor(ctx context.Context, scope platform.UserScope) (string, error) {
	if b.zones == nil {
		return "", ErrZoneReaderRequired
	}
	return b.zones.ZoneFor(ctx, scope)
}

// SpendSignalReader resolves the authoritative depth signals a quote prices
// ([G4]): memory facts by target id, as scalars only. The concrete is a
// composition-root adapter over the memory context's published reads — this
// context never imports memory.
type SpendSignalReader interface {
	// RecallAccessibility is one memory's accessibility cost weight ([F4]) — the
	// recall quote's signal.
	RecallAccessibility(ctx context.Context, scope platform.UserScope, memoryID string) (float64, error)
	// DiaryRecallAccessibilities is the per-memory weight list of a diary's live
	// memories — the whole-diary recall quote's signals ([D3]).
	DiaryRecallAccessibilities(ctx context.Context, scope platform.UserScope, diaryID string) ([]float64, error)
	// ViewableGistStage is the gist stage a view of the memory reaches — the
	// gist-view quote's signal ([R8]).
	ViewableGistStage(ctx context.Context, scope platform.UserScope, memoryID string) (int, error)
}

// InviteResolutionRequest carries an opaque code plus the authenticated invitee
// to the account/signup boundary. The invite code is never interpreted as an
// account id inside the Twinkle context.
type InviteResolutionRequest struct {
	InviteCode    string
	InviteeUserID string
}

// ResolvedSignup is the trusted signup identity returned only after the outer
// account adapter has established inviter existence, distinctness, and signup
// eligibility.
type ResolvedSignup struct {
	SignupID      string
	InviterUserID string
	InviteeUserID string
}

// InviteResolver is the consumer-owned account/signup seam ([G6]). Production
// uses the fail-closed unavailable adapter until a real directory-backed
// resolver is explicitly configured at the composition root.
type InviteResolver interface {
	Resolve(ctx context.Context, request InviteResolutionRequest) (ResolvedSignup, error)
}
