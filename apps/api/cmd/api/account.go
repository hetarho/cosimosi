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
	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/apperr"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	platformsupabase "github.com/cosimosi/api/internal/platform/supabase"
	"github.com/cosimosi/api/internal/twinkle"
	twinklepg "github.com/cosimosi/api/internal/twinkle/pg"
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

func (a accountDirectoryAdapter) SetUserBanned(ctx context.Context, userID string, banned bool) error {
	return a.source.SetUserBanned(ctx, userID, banned)
}

func (a accountDirectoryAdapter) DeleteUser(ctx context.Context, userID string) error {
	return a.source.DeleteUser(ctx, userID)
}

// accountServiceOption wires the account context and returns its published behavior for the
// memory-owned timezone adapter.
type accountServiceDirectory interface {
	account.Directory
	account.CredentialDirectory
}

type withdrawalComposition struct {
	scheduler account.WithdrawalSweepScheduler
	purgers   []account.UserDataPurger
}

func newWithdrawalComposition(
	jobStore memory.UserJobStore,
	memoryPurgeRepo memory.UserPurgeRepo,
	twinklePurgeRepo twinkle.UserPurgeRepo,
) (withdrawalComposition, error) {
	userJobs, err := memory.NewUserJobService(jobStore, nil, nil)
	if err != nil {
		return withdrawalComposition{}, err
	}
	return withdrawalComposition{
		scheduler: userJobs,
		purgers: []account.UserDataPurger{
			memory.NewWithdrawalPurger(memoryPurgeRepo),
			twinkle.NewWithdrawalPurger(twinklePurgeRepo),
		},
	}, nil
}

func accountServiceOption(
	pool *platformdb.Pool,
	directory accountServiceDirectory,
	inviteGranter account.InviteRewardGranter,
	signupBonusGranter account.SignupBonusGranter,
) ([]platform.HandlerOption, *account.Service, error) {
	if err := requireProductionCredentialDirectory(directory); err != nil {
		return nil, nil, err
	}
	signer, err := inviteSignerFromEnv()
	if err != nil {
		return nil, nil, err
	}
	accountStore := accountpg.NewStore(pool.PgxPool())
	memoryStore := memorypg.NewStore(pool.PgxPool())
	twinkleStore := twinklepg.NewStore(pool.PgxPool())
	withdrawalAdapters, err := newWithdrawalComposition(
		memoryStore,
		memoryStore,
		twinkleStore,
	)
	if err != nil {
		return nil, nil, err
	}
	service, err := account.NewService(account.ServiceDeps{
		Store:              accountStore,
		Directory:          directory,
		InviteSigner:       signer,
		InviteGranter:      inviteGranter,
		SignupBonusGranter: signupBonusGranter,
		Withdrawals:        accountStore,
		Purgers:            withdrawalAdapters.purgers,
		Scheduler:          withdrawalAdapters.scheduler,
		Credentials:        directory,
	})
	if err != nil {
		return nil, nil, err
	}
	server, err := accountrpc.NewServer(service)
	if err != nil {
		return nil, nil, err
	}
	serviceOption := platform.WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
		return accountv1connect.NewAccountServiceHandler(server, opts...)
	})
	return []platform.HandlerOption{
		serviceOption,
		platform.WithAccountStatusReader(service),
		platform.WithWithdrawnScopeExemptProcedures([]string{
			accountv1connect.AccountServiceRestoreAccountProcedure,
		}),
	}, service, nil
}

func requireProductionCredentialDirectory(directory accountServiceDirectory) error {
	if !strings.EqualFold(strings.TrimSpace(os.Getenv(apperr.EnvDeployEnvironment)), "production") {
		return nil
	}
	adapter, ok := directory.(accountDirectoryAdapter)
	if !ok || !platformsupabase.CredentialMutationsAvailable(adapter.source) {
		return errors.New("production account withdrawal requires Supabase Admin API credentials")
	}
	return nil
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
		if strings.EqualFold(
			strings.TrimSpace(os.Getenv(apperr.EnvDeployEnvironment)),
			"production",
		) {
			return nil, errors.New(
				"production account invite capability requires INVITE_TOKEN_SIGNING_KEY",
			)
		}
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
