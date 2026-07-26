package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"strings"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/account"
	accountpg "github.com/cosimosi/api/internal/account/pg"
	accountrpc "github.com/cosimosi/api/internal/account/rpc"
	accountv1connect "github.com/cosimosi/api/internal/gen/cosimosi/account/v1/accountv1connect"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
)

const envInviteTokenSigningKey = "INVITE_TOKEN_SIGNING_KEY"

type accountDirectoryAdapter struct {
	source accountDirectorySource
}

func (a accountDirectoryAdapter) EmailFor(ctx context.Context, userID string) (string, error) {
	return a.source.EmailFor(ctx, userID)
}

func (a accountDirectoryAdapter) Identities(ctx context.Context, userID string) ([]string, error) {
	return a.source.Identities(ctx, userID)
}

// accountServiceOption wires the account context and returns its published behavior for the
// memory-owned timezone adapter.
func accountServiceOption(pool *platformdb.Pool, directory account.Directory) (platform.HandlerOption, *account.Service, error) {
	signer, err := inviteSignerFromEnv()
	if err != nil {
		return nil, nil, err
	}
	service, err := account.NewService(account.ServiceDeps{
		Store:        accountpg.NewStore(pool.PgxPool()),
		Directory:    directory,
		InviteSigner: signer,
	})
	if err != nil {
		return nil, nil, err
	}
	server, err := accountrpc.NewServer(service)
	if err != nil {
		return nil, nil, err
	}
	option := platform.WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
		return accountv1connect.NewAccountServiceHandler(server, opts...)
	})
	return option, service, nil
}

func inviteSignerFromEnv() (account.InviteSigner, error) {
	encoded := strings.TrimSpace(os.Getenv(envInviteTokenSigningKey))
	if encoded == "" {
		return account.UnavailableInviteSigner{}, nil
	}
	key, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("%s must be standard base64: %w", envInviteTokenSigningKey, err)
	}
	signer, err := account.NewHMACInviteSigner(key)
	if err != nil {
		return nil, fmt.Errorf("%s must decode to at least 32 bytes: %w", envInviteTokenSigningKey, err)
	}
	return signer, nil
}
