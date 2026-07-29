package main

import (
	"net/http"

	"connectrpc.com/connect"
	storev1connect "github.com/cosimosi/api/internal/gen/cosimosi/store/v1/storev1connect"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/store"
	storepg "github.com/cosimosi/api/internal/store/pg"
	storerpc "github.com/cosimosi/api/internal/store/rpc"
)

// Store wiring (ARCHITECTURE §2.4). The context imports nothing and nothing imports it: the one
// cross-context edge it takes part in — account's withdrawal sweep calling its purge leg — is closed
// here, where both concretes are visible.

func newStoreService(pool *platformdb.Pool) (*store.Service, error) {
	repo := storepg.NewStore(pool.PgxPool())
	return store.NewService(store.ServiceDeps{
		Ownerships: repo,
		Selections: repo,
		Purge:      repo,
	})
}

// storeWithdrawalPurger is the sweep's store leg, satisfying account's UserDataPurger port.
func storeWithdrawalPurger(service *store.Service) store.WithdrawalPurger {
	return store.NewWithdrawalPurger(service)
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
