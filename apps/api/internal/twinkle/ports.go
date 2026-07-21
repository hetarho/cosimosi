package twinkle

import (
	"context"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// The earn/spend use-cases' consumer-owned ports (§2.4/§2.9#6). Declared HERE
// because the twinkle use-cases are the consumers: the ledger store they compose
// their transactions from, the depth-signal reads a quote prices, the store-payment
// verifier ([G3]), and the trusted invite/signup resolver ([G6]). Domain-shaped in
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

// PaymentVerificationRequest is the untrusted purchase material Charge hands to
// the configured store adapter. BeneficiaryUserID always comes from the
// authenticated scope, never from the wire request.
type PaymentVerificationRequest struct {
	PackID            string
	Provider          string
	Receipt           string
	BeneficiaryUserID string
}

// VerifiedPayment is a verifier-authenticated purchase claim. The adapter binds
// one normalized provider transaction to its provider, catalog pack,
// authoritative amount, and authenticated beneficiary.
type VerifiedPayment struct {
	ProviderTransactionID string
	Provider              string
	PackID                string
	Amount                int
	BeneficiaryUserID     string
}

// StorePaymentVerifier is the external-service port ([G3], §2.8) Charge consults
// before crediting anything. Production uses the fail-closed unavailable
// adapter until a real store adapter is explicitly configured at the composition
// root.
type StorePaymentVerifier interface {
	Verify(ctx context.Context, request PaymentVerificationRequest) (VerifiedPayment, error)
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
