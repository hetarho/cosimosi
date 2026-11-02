package twinkle

import "errors"

var (
	ErrLedgerRequired         = errors.New("twinkle service requires a ledger repo")
	ErrInviteResolverRequired = errors.New("twinkle service requires an invite resolver")
	ErrSignalsRequired        = errors.New("twinkle service requires a spend-signal reader")
	// ErrZoneReaderRequired keeps the [U7] day boundary bound: production may not boot with an
	// unresolved SMALL reset window. The package deliberately exports no permissive UTC adapter
	// for a composition root to bind here by accident.
	ErrZoneReaderRequired = errors.New("twinkle service requires a user zone reader")
	// ErrScopeRequired mirrors the transport guard: every derivation, quote, earn,
	// and spend is scoped to an authenticated user (§4).
	ErrScopeRequired = errors.New("twinkle requires an authenticated user scope")
	// ErrEarnTxRequired is the wiring fault of a write grant fired outside its
	// launch transaction — the grant must commit or roll back with the launch.
	ErrEarnTxRequired = errors.New("twinkle write earn requires the launch transaction")
	// ErrGrantAmountInvalid rejects a non-positive admin grant amount ([G3] admin_grant,
	// the admin console). The per-grant cap is the admin context's policy; twinkle only refuses a
	// zero/negative gift.
	ErrGrantAmountInvalid = errors.New("twinkle admin grant amount must be positive")
	// ErrInsufficientTwinkle is the canonical spend denial ([G1]): the plan does not
	// fit the two tiers, nothing is written, the caller's action is refused ([I1] —
	// refused, never erased).
	ErrInsufficientTwinkle = errors.New("insufficient twinkle for this action")
	// ErrSpendIntentInvalid rejects a SpendIntent whose reason is not a spend
	// reason — a composition fault, not a user input.
	ErrSpendIntentInvalid = errors.New("twinkle spend intent carries no spendable reason")
	// ErrPurchaseAmountInvalid rejects a non-positive purchase total. The catalog owns the price; this
	// only refuses a total that cannot be one.
	ErrPurchaseAmountInvalid = errors.New("twinkle purchase amount must be positive")
	// ErrRewardClaimRequired rejects an achievement reward with no claim identity — without one the
	// credit has no idempotency key and a retried claim would pay twice.
	ErrRewardClaimRequired = errors.New("twinkle achievement reward requires a claim id")
	// ErrLedgerCursorInvalid rejects a page token the client did not get from a previous page. Cursors
	// are opaque and echoed, never constructed.
	ErrLedgerCursorInvalid = errors.New("twinkle ledger page token is not a valid cursor")
	// Invite refusals reveal no account-directory detail to the transport.
	ErrInviteInputRequired         = errors.New("invite claim requires an invite code")
	ErrInviteResolutionUnavailable = errors.New("invite verification is unavailable")
	ErrInviteBeneficiaryMismatch   = errors.New("invite claim beneficiary does not match the authenticated user")
	ErrInviteNotEligible           = errors.New("invite claim is not an eligible signup")
	ErrInviteGrantConflict         = errors.New("invite signup grant is inconsistent with existing ledger state")
	// ErrQuoteInputRequired rejects a quote without its required action inputs.
	ErrQuoteInputRequired = errors.New("spend quote requires a kind, target id, and action inputs")
	// ErrQuoteTargetNotFound / ErrQuoteTargetUnavailable are the canonical quote-target
	// refusals the composition root maps the signal reader's context errors onto
	// (this context names the refusal, never the memory error): no such target
	// for the caller, and a target that exists but cannot be quoted (soft-deleted, or
	// a gist that has not risen).
	ErrQuoteTargetNotFound    = errors.New("spend quote target not found")
	ErrQuoteTargetUnavailable = errors.New("spend quote target is unavailable")
)
