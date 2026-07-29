package main

import (
	"context"
	"errors"
	"net/http"

	"connectrpc.com/connect"
	dbgen "github.com/cosimosi/api/db/gen"
	storev1connect "github.com/cosimosi/api/internal/gen/cosimosi/store/v1/storev1connect"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/store"
	storepg "github.com/cosimosi/api/internal/store/pg"
	storerpc "github.com/cosimosi/api/internal/store/rpc"
	"github.com/cosimosi/api/internal/twinkle"
	twinklepg "github.com/cosimosi/api/internal/twinkle/pg"
)

// Store wiring (ARCHITECTURE §2.4). The context imports nothing and nothing imports it: its two
// cross-context edges — account's withdrawal sweep calling the purge leg, and a save's debit reaching
// the Twinkle ledger — are closed here, where both concretes are visible.

// errDecorateTxUnusable is the wiring fault of a save transaction the economy cannot be bound onto —
// never a client mistake.
var errDecorateTxUnusable = errors.New("store decorate tx does not expose a database handle")

func newStoreService(
	pool *platformdb.Pool,
	twinkleService *twinkle.Service,
	achievements store.AchievementRecorder,
) (*store.Service, error) {
	repo := storepg.NewStore(pool.PgxPool())
	return store.NewService(store.ServiceDeps{
		Ownerships: repo,
		Selections: repo,
		Purge:      repo,
		Decorate:   repo,
		Spend:      storeSpendGate{service: twinkleService},
		// The save's counter reports ride its own transaction, so a refused save counts nothing.
		Achievements: achievements,
	})
}

// storeSpendGate implements store.SpendGate over the Twinkle economy: it binds a ledger store onto the
// save's OWN transaction, so the ownership rows, the applied rows and the debit commit together or not
// at all ([P8]). twinkle learns an amount and a dedup key — never what was bought ([I11]) — and store
// never reads a balance.
type storeSpendGate struct {
	service *twinkle.Service
}

func (g storeSpendGate) CheckAndSpend(
	ctx context.Context,
	scope platform.UserScope,
	tx store.EconomyTx,
	spend store.PurchaseSpend,
) error {
	ledger, err := decorateLedger(tx)
	if err != nil {
		return err
	}
	intent := twinkle.PurchaseSpendIntent(spend.Amount, spend.DedupKey)
	if err := g.service.CheckAndSpend(ctx, scope, ledger, intent); err != nil {
		return storeSpendRefusal(err)
	}
	return nil
}

func decorateLedger(tx store.EconomyTx) (twinkle.LedgerStore, error) {
	carrier, ok := tx.(interface{ DB() dbgen.DBTX })
	if !ok || carrier.DB() == nil {
		return nil, errDecorateTxUnusable
	}
	return twinklepg.NewStore(carrier.DB()), nil
}

// storeSpendRefusal translates the economy's denial into the store context's vocabulary, carrying its
// numbers across verbatim: the shortfall is the economy's own arithmetic, and the item is the only
// thing the save adds to it.
func storeSpendRefusal(err error) error {
	var insufficient *twinkle.InsufficientTwinkle
	if errors.As(err, &insufficient) {
		return &store.InsufficientTwinkle{
			Cost:      insufficient.Cost,
			Eligible:  insufficient.Eligible,
			Shortfall: insufficient.Shortfall,
		}
	}
	if errors.Is(err, twinkle.ErrInsufficientTwinkle) {
		return store.ErrInsufficientTwinkle
	}
	return err
}

// storeWithdrawalPurgerFor is the sweep's store leg, satisfying account's UserDataPurger port. It is
// built straight over the pool: the sweep deletes rows and needs neither the catalog nor the economy.
func storeWithdrawalPurgerFor(pool *platformdb.Pool) store.WithdrawalPurger {
	return store.NewWithdrawalPurger(storepg.NewStore(pool.PgxPool()))
}

// storeServiceOption registers the StoreService Connect handler.
func storeServiceOption(service *store.Service) (platform.HandlerOption, error) {
	server, err := storerpc.NewServer(service)
	if err != nil {
		return nil, err
	}
	return platform.WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
		return storev1connect.NewStoreServiceHandler(server, opts...)
	}), nil
}
