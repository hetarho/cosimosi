// Package wiring holds what both composition roots build the same way (ARCH-7): the withdrawal
// sweep's purge legs, the job worker with its achievement settle drain and fail-closed bindings, the
// AI adapters and the account directory. cmd/worker runs the job worker in production and cmd/api runs
// it in-process for development; building it once here keeps the two from drifting.
package wiring

import (
	"github.com/cosimosi/api/internal/account"
	"github.com/cosimosi/api/internal/achievement"
	achievementpg "github.com/cosimosi/api/internal/achievement/pg"
	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	queuepg "github.com/cosimosi/api/internal/platform/jobqueue/pg"
	"github.com/cosimosi/api/internal/store"
	storepg "github.com/cosimosi/api/internal/store/pg"
	"github.com/cosimosi/api/internal/twinkle"
	twinklepg "github.com/cosimosi/api/internal/twinkle/pg"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PurgeLegs is the withdrawal sweep's leg list: one leg per context that owns per-user rows, in the
// order the sweep runs them. A missing leg leaves that context's rows behind a hard-deleted account
// ([I1][U1]), so the package test pins the list against the per-context query directories.
func PurgeLegs(db *pgxpool.Pool) []account.UserDataPurger {
	return []account.UserDataPurger{
		memory.NewWithdrawalPurger(memorypg.NewStore(db)),
		twinkle.NewWithdrawalPurger(twinklepg.NewStore(db)),
		store.NewWithdrawalPurger(storepg.NewStore(db)),
		achievement.NewWithdrawalPurger(achievementpg.NewStore(db)),
	}
}

// Withdrawal is the sweep account binds: the scheduler that arms it and the legs it runs.
type Withdrawal struct {
	Scheduler account.WithdrawalSweepScheduler
	Purgers   []account.UserDataPurger
}

// NewWithdrawal composes the sweep over one pool.
func NewWithdrawal(db *pgxpool.Pool) (Withdrawal, error) {
	scheduler, err := account.NewWithdrawalJobScheduler(queuepg.NewStore(db), nil, nil)
	if err != nil {
		return Withdrawal{}, err
	}
	return Withdrawal{Scheduler: scheduler, Purgers: PurgeLegs(db)}, nil
}
