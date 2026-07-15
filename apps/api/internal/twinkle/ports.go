package twinkle

import (
	"context"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// The earn/spend use-cases' consumer-owned ports (§2.4/§2.9#6). Declared HERE
// because the twinkle use-cases are the consumers: the ledger store they compose
// their transactions from, the depth-signal reads a quote prices, the store-payment
// verifier ([G3]), and the invite valid-signup predicate ([G6]). Domain-shaped in
// and out — no proto, sqlc, pgx, or SDK type crosses any of them, and no memory
// type either: depth signals arrive as scalars (§2.2, CC8).

// LedgerStore is the ledger repository surface one earn/spend composes: the balance
// facts read, the guarded balance delta, and the append-only log write. The concrete
// is twinkle/pg's Store — bound to the pool for reads, to a transaction inside
// InLedgerTx, or (via the composition root's economy seam) to a memory transaction
// so a spend/earn joins the recall/launch it belongs to ([CC2]).
type LedgerStore interface {
	GetBalanceRecord(ctx context.Context, scope platform.UserScope) (*BalanceRecord, error)
	ApplyBalanceDelta(ctx context.Context, scope platform.UserScope, resetWindow time.Time, additionalDelta int, basicSpentDelta int) (BalanceRecord, error)
	AppendLedgerEntry(ctx context.Context, scope platform.UserScope, entry LedgerEntry) (bool, error)
}

// LedgerRepo is the standalone ledger seam: the pool-bound reads plus the
// own-transaction runner the RPC-driven earns (invite, charge) and the tx-less
// gist-view spend use.
type LedgerRepo interface {
	LedgerStore
	InLedgerTx(ctx context.Context, fn func(tx LedgerStore) error) error
}

// SpendSignalReader resolves the authoritative depth signals a quote prices
// ([G4]): memory facts by target id, as scalars only. The concrete is a
// composition-root adapter over the memory context's published reads — this
// context never imports memory (CC8).
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

// PaymentReceipt is a store purchase claim as the client hands it over: the pack,
// the store platform, and the opaque receipt blob the store issued.
type PaymentReceipt struct {
	PackID   string
	Platform string
	Receipt  string
}

// VerifiedPayment is a verifier-authenticated grant: the authoritative Twinkle
// amount the receipt is worth and the idempotency key that makes a replayed
// receipt credit exactly once.
type VerifiedPayment struct {
	Amount   int
	DedupKey string
}

// StorePaymentVerifier is the external-service port ([G3], §2.8) Charge consults
// before crediting anything: only a verified receipt for a known pack carries
// value. The shipped concrete is the deterministic keyless fake (dev/test); the
// production store-SDK adapter is a deferred seam behind this same port —
// production config credits nothing unverified.
type StorePaymentVerifier interface {
	Verify(ctx context.Context, receipt PaymentReceipt) (VerifiedPayment, error)
}

// ValidSignup is the reserved invite anti-abuse seam ([G6]): consulted before
// either invite side is credited. The shipped binding is the permissive default
// (a real, distinct signup — DistinctSignup); the concrete criteria (min-activity,
// device dedup, rate caps) bind behind this same predicate with no change to the
// invite earn.
type ValidSignup func(ctx context.Context, inviterID string, inviteeID string) (bool, error)
