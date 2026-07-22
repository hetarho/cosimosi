package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"

	"connectrpc.com/connect"
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
// The adapters map memory's SpendGate/EarnPort/EconomyTx vocabulary onto twinkle
// use-case inputs, and twinkle's SpendSignalReader onto memory's published reads.

// errEconomyTxUnusable is the wiring fault of an EconomyTx handle the economy
// cannot bind a ledger store to — never a client mistake.
var errEconomyTxUnusable = errors.New("economy tx does not expose a database handle")

// newTwinkleService builds the twinkle context over the shared pool. External earn
// paths stay fail-closed until real store and account/signup adapters are
// explicitly selected here; write earns and metered spends remain available.
func newTwinkleService(pool *platformdb.Pool, signals *memorySpendSignals) (*twinkle.Service, error) {
	return twinkle.NewService(twinkle.ServiceDeps{
		Ledger:         twinklepg.NewStore(pool.PgxPool()),
		Verifier:       twinkle.UnavailablePaymentVerifier{},
		InviteResolver: twinkle.UnavailableInviteResolver{},
		Signals:        signals,
	})
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

// twinkleSpendGate implements memory.SpendGate over the twinkle economy: it binds
// the ledger store onto the caller's transaction (or lets the gate open its own for
// the tx-less gist view), maps the SpendIntent's kind + depth signal onto twinkle's
// intent, and translates the canonical denial back into memory's vocabulary.
type twinkleSpendGate struct {
	service *twinkle.Service
}

func (g twinkleSpendGate) CheckAndSpend(ctx context.Context, scope platform.UserScope, tx memory.EconomyTx, spend memory.SpendIntent) error {
	ledger, err := economyLedger(tx)
	if err != nil {
		return err
	}
	intent, err := twinkleIntent(spend)
	if err != nil {
		return err
	}
	if err := g.service.CheckAndSpend(ctx, scope, ledger, intent); err != nil {
		if errors.Is(err, twinkle.ErrInsufficientTwinkle) {
			return fmt.Errorf("%w: %w", memory.ErrInsufficientTwinkle, err)
		}
		return err
	}
	return nil
}

// twinkleEarnPort implements memory.EarnPort: the write grant fired inside the
// launch transaction, once per launched diary ([G3]).
type twinkleEarnPort struct {
	service *twinkle.Service
}

func (p twinkleEarnPort) OnDiaryLaunched(ctx context.Context, scope platform.UserScope, tx memory.EconomyTx, diaryID string) error {
	if tx == nil {
		// The grant must join the launch transaction; a nil handle is a wiring
		// fault, not a grantless launch.
		return errEconomyTxUnusable
	}
	ledger, err := economyLedger(tx)
	if err != nil {
		return err
	}
	return p.service.EarnOnWrite(ctx, scope, ledger, diaryID)
}

// economyLedger binds a twinkle ledger store onto the caller's open transaction.
// The memory/pg store (the EconomyTx concrete) exposes its handle via DB(); the
// two contexts still touch only their own tables — they share the transaction,
// never the queries. nil in, nil out: no transaction means the use-case runs its
// own.
func economyLedger(tx memory.EconomyTx) (twinkle.LedgerStore, error) {
	if tx == nil {
		return nil, nil
	}
	carrier, ok := tx.(interface{ DB() dbgen.DBTX })
	if !ok || carrier.DB() == nil {
		return nil, errEconomyTxUnusable
	}
	return twinklepg.NewStore(carrier.DB()), nil
}

// twinkleIntent maps memory's spend vocabulary onto twinkle's: kind → entry reason,
// the depth signals carried through as scalars, and the operation identity → the spend's
// dedup key. Prices exist on neither side of this mapping ([CC3]).
func twinkleIntent(spend memory.SpendIntent) (twinkle.SpendIntent, error) {
	switch spend.Kind {
	case memory.SpendKindRecall:
		return twinkle.SpendIntent{Reason: twinkle.ReasonRecall, AccessibilityCost: spend.AccessibilityCost, DedupKey: spendDedupKey(spend)}, nil
	case memory.SpendKindViewGist:
		return twinkle.SpendIntent{Reason: twinkle.ReasonGistView, SemanticStage: int(spend.Stage), DedupKey: spendDedupKey(spend)}, nil
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

// memorySpendSignals implements twinkle.SpendSignalReader over memory's published
// reads, translating memory's canonical refusals into twinkle's quote-target
// vocabulary. The memory service is bound after construction (the two services
// need each other: memory takes the gate, twinkle's quote takes these signals).
type memorySpendSignals struct {
	service *memory.Service
}

func (r *memorySpendSignals) bind(service *memory.Service) {
	r.service = service
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
