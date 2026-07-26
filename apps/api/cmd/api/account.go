package main

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/account"
	accountpg "github.com/cosimosi/api/internal/account/pg"
	accountrpc "github.com/cosimosi/api/internal/account/rpc"
	accountv1connect "github.com/cosimosi/api/internal/gen/cosimosi/account/v1/accountv1connect"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/twinkle"
)

const envInviteTokenSigningKey = "INVITE_TOKEN_SIGNING_KEY"

type accountDirectoryAdapter struct {
	source accountDirectorySource
}

func (a accountDirectoryAdapter) EmailFor(ctx context.Context, userID string) (string, error) {
	return a.source.EmailFor(ctx, userID)
}

func (a accountDirectoryAdapter) EmailVerifiedAt(ctx context.Context, userID string) (time.Time, error) {
	return a.source.EmailVerifiedAt(ctx, userID)
}

func (a accountDirectoryAdapter) Identities(ctx context.Context, userID string) ([]string, error) {
	return a.source.Identities(ctx, userID)
}

// accountServiceOption wires the account context and returns its published behavior for the
// memory-owned timezone adapter.
func accountServiceOption(
	pool *platformdb.Pool,
	directory account.Directory,
	inviteGranter account.InviteRewardGranter,
	signupBonusGranter account.SignupBonusGranter,
) (platform.HandlerOption, *account.Service, error) {
	signer, err := inviteSignerFromEnv()
	if err != nil {
		return nil, nil, err
	}
	service, err := account.NewService(account.ServiceDeps{
		Store:              accountpg.NewStore(pool.PgxPool()),
		Directory:          directory,
		InviteSigner:       signer,
		InviteGranter:      inviteGranter,
		SignupBonusGranter: signupBonusGranter,
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

// accountInviteResolver translates the account context's eligible bound invite into Twinkle's
// consumer-owned signup identity. No policy lives in this adapter.
type accountInviteResolver struct {
	service *account.Service
}

func (r accountInviteResolver) Resolve(
	ctx context.Context,
	request twinkle.InviteResolutionRequest,
) (twinkle.ResolvedSignup, error) {
	settled, err := r.service.ResolveInviteSettlement(ctx, account.InviteSettlementRequest{
		Token:         request.InviteCode,
		InviteeUserID: request.InviteeUserID,
	})
	if err != nil {
		if errors.Is(err, account.ErrInviteNotEligible) {
			return twinkle.ResolvedSignup{}, twinkle.ErrInviteNotEligible
		}
		// Twinkle's public error must remain safe while account's post-launch observer still
		// receives a retryable class to log.
		return twinkle.ResolvedSignup{}, twinkle.ErrInviteResolutionUnavailable
	}
	return twinkle.ResolvedSignup{
		SignupID:      settled.InviteID,
		InviterUserID: settled.InviterUserID,
		InviteeUserID: settled.InviteeUserID,
	}, nil
}

type accountInviteRewardGranter struct {
	service *twinkle.Service
}

func (g accountInviteRewardGranter) Grant(
	ctx context.Context,
	scope platform.UserScope,
	token string,
) error {
	if g.service == nil {
		return account.ErrInviteGranterRequired
	}
	_, err := g.service.ClaimInvite(ctx, scope, token)
	if errors.Is(err, twinkle.ErrInviteNotEligible) {
		return account.ErrInviteNotEligible
	}
	return err
}

type accountSignupBonusGranter struct {
	service *twinkle.Service
}

func (g accountSignupBonusGranter) Grant(ctx context.Context, scope platform.UserScope) error {
	if g.service == nil {
		return account.ErrSignupBonusGranterRequired
	}
	_, err := g.service.EarnSignupBonus(ctx, scope)
	return err
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
