package main

import (
	"errors"
	"net/http"

	"connectrpc.com/connect"
	storev1connect "github.com/cosimosi/api/internal/gen/cosimosi/store/v1/storev1connect"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/store"
	storepg "github.com/cosimosi/api/internal/store/pg"
	storerpc "github.com/cosimosi/api/internal/store/rpc"
	"github.com/cosimosi/api/internal/twinkle"
)

// Store wiring (ARCH-8). The context imports nothing and nothing imports it: its two
// cross-context edges — account's withdrawal sweep calling the purge leg, and a save's debit reaching
// the Twinkle ledger — are closed here, where both concretes are visible.

func newStoreService(
	pool *platformdb.Pool,
	twinkleService *twinkle.Service,
	progress progressRecorder,
) (*store.Service, error) {
	// The save's debit and counter reports ride its own transaction, so a refused save counts nothing.
	repo, err := bindStoreTransactions(storepg.NewStore(pool.PgxPool()), twinkleService, progress)
	if err != nil {
		return nil, err
	}
	return store.NewService(store.ServiceDeps{
		Ownerships: repo,
		Selections: repo,
		Purge:      repo,
		Decorate:   repo,
	})
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
