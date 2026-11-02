package rpc

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	twinklev1 "github.com/cosimosi/api/internal/gen/cosimosi/twinkle/v1"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/rpctest"
	"github.com/cosimosi/api/internal/twinkle"
)

// stubUseCases records what each handler forwarded.
type stubUseCases struct {
	userIDs  []string
	kind     twinkle.SpendKind
	targetID string
	pageSize int
	token    string
	err      error
}

func (s *stubUseCases) seen(scope platform.UserScope) { s.userIDs = append(s.userIDs, scope.UserID()) }

func (s *stubUseCases) GetBalance(_ context.Context, scope platform.UserScope) (twinkle.Balance, error) {
	s.seen(scope)
	return twinkle.Balance{}, s.err
}

func (s *stubUseCases) GetLedger(_ context.Context, scope platform.UserScope, pageSize int, pageToken string) (twinkle.LedgerPage, error) {
	s.seen(scope)
	s.pageSize, s.token = pageSize, pageToken
	return twinkle.LedgerPage{}, s.err
}

func (s *stubUseCases) QuoteSpend(_ context.Context, scope platform.UserScope, kind twinkle.SpendKind, targetID string) (twinkle.Quote, error) {
	s.seen(scope)
	s.kind, s.targetID = kind, targetID
	return twinkle.Quote{}, s.err
}

func twinkleHandlers(server *Server) []rpctest.Handler {
	return []rpctest.Handler{
		{Name: "GetBalance", Call: func(ctx context.Context) error {
			_, err := server.GetBalance(ctx, connect.NewRequest(&twinklev1.GetBalanceRequest{}))
			return err
		}},
		{Name: "QuoteSpend", Call: func(ctx context.Context) error {
			_, err := server.QuoteSpend(ctx, connect.NewRequest(&twinklev1.QuoteSpendRequest{
				Kind: twinklev1.SpendKind_SPEND_KIND_DIARY_RECALL, DiaryId: "diary-1",
			}))
			return err
		}},
		{Name: "GetLedger", Call: func(ctx context.Context) error {
			_, err := server.GetLedger(ctx, connect.NewRequest(&twinklev1.GetLedgerRequest{PageSize: 7, PageToken: "cursor-1"}))
			return err
		}},
	}
}

func TestHandlersForwardScopeAndInputs(t *testing.T) {
	t.Parallel()
	stub := &stubUseCases{}
	server, err := NewServer(stub)
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}
	handlers := twinkleHandlers(server)
	for _, handler := range handlers {
		if err := handler.Call(rpctest.UserContext()); err != nil {
			t.Fatalf("%s failed: %v", handler.Name, err)
		}
	}
	if len(stub.userIDs) != len(handlers) {
		t.Fatalf("forwarded scopes = %v, want one per handler", stub.userIDs)
	}
	for _, userID := range stub.userIDs {
		if userID != rpctest.UserID {
			t.Fatalf("forwarded user = %q, want %q", userID, rpctest.UserID)
		}
	}
	if stub.kind != twinkle.SpendKindDiaryRecall || stub.targetID != "diary-1" {
		t.Fatalf("quote forwarded %q/%q, want diary recall of diary-1", stub.kind, stub.targetID)
	}
	if stub.pageSize != 7 || stub.token != "cursor-1" {
		t.Fatalf("ledger forwarded %d/%q, want 7/cursor-1", stub.pageSize, stub.token)
	}
	rpctest.RequireUnauthenticatedWithoutScope(t, handlers)
}

func TestHandlersMapUseCaseRefusals(t *testing.T) {
	t.Parallel()
	server, err := NewServer(&stubUseCases{err: twinkle.ErrQuoteTargetNotFound})
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}
	for _, handler := range twinkleHandlers(server) {
		rpctest.RequireCode(t, handler.Call(rpctest.UserContext()), connect.CodeNotFound)
	}
}
