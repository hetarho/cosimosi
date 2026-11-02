package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/cmd/internal/wiring"
	dbgen "github.com/cosimosi/api/db/gen"
	twinklev1connect "github.com/cosimosi/api/internal/gen/cosimosi/twinkle/v1/twinklev1connect"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/twinkle"
	twinklepg "github.com/cosimosi/api/internal/twinkle/pg"
	twinklerpc "github.com/cosimosi/api/internal/twinkle/rpc"
)

// Twinkle wiring + the cross-context economy adapters (ARCHITECTURE §2.4): twinkle
// never imports memory and memory never imports twinkle — the two meet only here.
// The adapters map memory's EconomyTx vocabulary onto twinkle
// use-case inputs, and twinkle's SpendSignalReader onto memory's published reads.

// newTwinkleService builds the twinkle context over the shared pool. The invite seam stays
// fail-closed until a real account/signup adapter is explicitly selected here; write earns and
// metered spends remain available.
func newTwinkleService(
	pool *platformdb.Pool,
	signals *memorySpendSignals,
	inviteResolver twinkle.InviteResolver,
	userZone twinkle.UserZoneReader,
) (*twinkle.Service, error) {
	return twinkle.NewService(twinkle.ServiceDeps{
		Ledger:         twinkleLedgerStore(pool),
		InviteResolver: inviteResolver,
		Signals:        signals,
		UserZone:       userZone,
	})
}

// twinkleLedgerStore is twinkle's pool-bound ledger whose own transactions read the user zone on
// the transaction's connection.
func twinkleLedgerStore(pool *platformdb.Pool) twinklepg.Store {
	return twinklepg.NewStore(pool.PgxPool()).WithZoneBinding(wiring.LedgerZoneReader)
}

// twinkleLedgerTx is twinkle's ledger bound to another context's open transaction.
func twinkleLedgerTx(tx dbgen.DBTX) twinkle.LedgerTx {
	return twinkle.BindLedgerTx(twinklepg.NewStore(tx), wiring.LedgerZoneReader(tx))
}

// twinkleServiceOption registers the TwinkleService Connect handler.
func twinkleServiceOption(service *twinkle.Service) (platform.HandlerOption, error) {
	server, err := twinklerpc.NewServer(service)
	if err != nil {
		return nil, err
	}
	return platform.WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
		return twinklev1connect.NewTwinkleServiceHandler(server, opts...)
	}), nil
}

// spendMemory charges a memory spend on the caller's transaction-bound ledger: it maps the
// SpendIntent's kind and depth signal onto twinkle's intent and translates the canonical denial back
// into memory's vocabulary.
func spendMemory(ctx context.Context, service *twinkle.Service, scope platform.UserScope, ledger twinkle.LedgerTx, spend memory.SpendIntent) error {
	intent, err := twinkleIntent(spend)
	if err != nil {
		return err
	}
	if err := service.CheckAndSpend(ctx, scope, ledger, intent); err != nil {
		if errors.Is(err, twinkle.ErrInsufficientTwinkle) {
			return fmt.Errorf("%w: %w", memory.ErrInsufficientTwinkle, err)
		}
		return err
	}
	return nil
}

// twinkleIntent maps memory's spend vocabulary onto twinkle's: kind → entry reason,
// the depth signals carried through as scalars, and the operation identity → the spend's
// dedup key. Prices exist on neither side of this mapping ([CC3]).
func twinkleIntent(spend memory.SpendIntent) (twinkle.SpendIntent, error) {
	switch spend.Kind {
	case memory.SpendKindRecall:
		return twinkle.RecallSpendIntent(spend.AccessibilityCost, spendDedupKey(spend)), nil
	case memory.SpendKindViewGist:
		return twinkle.GistViewSpendIntent(int(spend.Stage), spendDedupKey(spend)), nil
	default:
		return twinkle.SpendIntent{}, fmt.Errorf("%w: %q", twinkle.ErrSpendIntentInvalid, spend.Kind)
	}
}

// spendDedupKey derives the twinkle spend row's idempotency key from the paid action's operation
// id and target memory (A3). One recall/view spends once (its op id + memory id); a whole-diary
// recall spends once per member under one op id, so folding the member id in gives each member a
// distinct key — a replayed diary recall re-charges no member. Empty when no operation id rode
// along (a non-paid path); the append then only guards backend id collisions.
func spendDedupKey(spend memory.SpendIntent) string {
	if spend.OperationID == "" {
		return ""
	}
	payload := fmt.Sprintf("%d:%s%d:%s", len(spend.OperationID), spend.OperationID, len(spend.MemoryID), spend.MemoryID)
	digest := sha256.Sum256([]byte(payload))
	return "spend:" + hex.EncodeToString(digest[:])
}

// memorySpendSignals translates independent read capabilities into economy quote signals.
type memorySpendSignals struct {
	service interface {
		RecallAccessibility(context.Context, platform.UserScope, string) (float64, error)
		DiaryRecallAccessibilities(context.Context, platform.UserScope, string) ([]float64, error)
		ViewableGistStage(context.Context, platform.UserScope, string) (int, error)
	}
}

func (r *memorySpendSignals) RecallAccessibility(ctx context.Context, scope platform.UserScope, memoryID string) (float64, error) {
	weight, err := r.service.RecallAccessibility(ctx, scope, memoryID)
	return weight, quoteTargetError(err)
}

func (r *memorySpendSignals) DiaryRecallAccessibilities(ctx context.Context, scope platform.UserScope, diaryID string) ([]float64, error) {
	weights, err := r.service.DiaryRecallAccessibilities(ctx, scope, diaryID)
	return weights, quoteTargetError(err)
}

func (r *memorySpendSignals) ViewableGistStage(ctx context.Context, scope platform.UserScope, memoryID string) (int, error) {
	stage, err := r.service.ViewableGistStage(ctx, scope, memoryID)
	return stage, quoteTargetError(err)
}

func quoteTargetError(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, memory.ErrRecallMemoryNotFound),
		errors.Is(err, memory.ErrViewSemanticMemoryNotFound):
		return fmt.Errorf("%w: %w", twinkle.ErrQuoteTargetNotFound, err)
	case errors.Is(err, memory.ErrRecallMemoryUnavailable),
		errors.Is(err, memory.ErrViewSemanticStageNotRisen):
		return fmt.Errorf("%w: %w", twinkle.ErrQuoteTargetUnavailable, err)
	case errors.Is(err, memory.ErrSpendSignalInputRequired):
		return fmt.Errorf("%w: %w", twinkle.ErrQuoteInputRequired, err)
	default:
		return err
	}
}
