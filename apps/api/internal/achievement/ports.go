package achievement

import (
	"context"

	"github.com/cosimosi/api/internal/platform"
)

// The context's consumer-owned ports (§2.4/§2.9#6). Domain-shaped in and out — no sqlc row, pgx
// handle or proto type crosses them, and no memory/store/twinkle type either: a counter write is
// (key, delta) and nothing else, which is how "achievements touch no meaning field" holds
// structurally ([A6][I11]).

// Store is achievement/pg's surface, bindable to a caller's transaction so a counter write commits
// or rolls back with the launch/recall/decorate that caused it (the shared-tx recorder seam). The
// write primitives ship with the table's owner and are first CALLED by the tracking use-case —
// the owner provides, the use-case composes.
//
// TouchCounter's boolean is the first-touch signal the derived variety counters are bumped on;
// MarkAchieved's and MarkClaimed's report whether THIS call changed the row, so a replay reads as
// false rather than as a second grant.
type Store interface {
	ListCounters(ctx context.Context, scope platform.UserScope) (map[CounterKey]int64, error)
	ListProgress(ctx context.Context, scope platform.UserScope) ([]ProgressRecord, error)
	GetProgress(ctx context.Context, scope platform.UserScope, achievementID string) (*ProgressRecord, error)
	TouchCounter(ctx context.Context, scope platform.UserScope, key CounterKey) (created bool, err error)
	AddCounter(ctx context.Context, scope platform.UserScope, key CounterKey, delta int64) (int64, error)
	RaiseCounter(ctx context.Context, scope platform.UserScope, key CounterKey, level int64) (int64, error)
	MarkAchieved(ctx context.Context, scope platform.UserScope, achievementID string) (marked bool, err error)
	MarkClaimed(ctx context.Context, scope platform.UserScope, achievementID string, claimID string) (claimed bool, err error)
}

// There is deliberately **no purge on Store**: a counter write composed inside InAchievementTx would
// otherwise be able to delete the caller's whole history, which is not a mistake the recorder should
// be able to make — it cannot express it (the shape store's DecorateTx already uses). The purge
// arrives through UserPurgeRepo instead, and only Repo carries both.

// Repo is the standalone seam: the tx-bindable surface, the own-transaction runner the RPC-driven
// paths use, and the withdrawal purge.
type Repo interface {
	Store
	UserPurgeRepo
	InAchievementTx(ctx context.Context, fn func(tx Store) error) error
}

// The two reward legs a claim pays, consumer-owned and bound at the composition root — this context
// imports neither the economy nor the ornament catalog. Both are paid AFTER the claim commits, as an
// idempotent pairing keyed on the claim id rather than as one cross-context transaction, which would
// make this context the transaction owner of another context's tables (§2.3).
//
// Neither port has a kind parameter, which is where [A3]'s "no SMALL reward" actually holds: there is
// no argument in which a tier could be named, so the earn credits the permanent balance by
// construction.

// TwinkleGranter credits a claim's stardust and answers the balance after it, for the reveal. The
// claim id is the dedup key, so a replayed claim credits nothing and still reports the same total.
type TwinkleGranter interface {
	EarnAchievementReward(ctx context.Context, scope platform.UserScope, claimID string, amount int) (generalTotal int, err error)
}

// OrnamentGranter records permanent ownership of a capstone's ornament. Idempotent on the ownership
// row, so a replay grants once.
type OrnamentGranter interface {
	Grant(ctx context.Context, scope platform.UserScope, claimID string, ornamentID string) error
}
