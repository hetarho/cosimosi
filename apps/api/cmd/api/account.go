package main

import (
	"net/http"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/account"
	accountpg "github.com/cosimosi/api/internal/account/pg"
	accountrpc "github.com/cosimosi/api/internal/account/rpc"
	accountv1connect "github.com/cosimosi/api/internal/gen/cosimosi/account/v1/accountv1connect"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
)

// accountServiceOption wires the account context over the shared pool and registers its Connect
// handler. The existing auth interceptor covers both RPCs — no new public procedure. It carries no
// cross-context seam (unlike memory↔twinkle): the preference is a self-contained per-user scalar.
func accountServiceOption(pool *platformdb.Pool) (platform.HandlerOption, error) {
	service, err := account.NewService(accountpg.NewStore(pool.PgxPool()))
	if err != nil {
		return nil, err
	}
	server, err := accountrpc.NewServer(service)
	if err != nil {
		return nil, err
	}
	return platform.WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
		return accountv1connect.NewAccountServiceHandler(server, opts...)
	}), nil
}
