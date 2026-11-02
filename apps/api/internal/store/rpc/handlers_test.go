package rpc

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	storev1 "github.com/cosimosi/api/internal/gen/cosimosi/store/v1"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/rpctest"
	"github.com/cosimosi/api/internal/store"
)

// stubUseCases records what each handler forwarded.
type stubUseCases struct {
	userIDs   []string
	requested store.Selection
	err       error
}

func (s *stubUseCases) Catalog(_ context.Context, scope platform.UserScope) ([]store.CatalogItem, error) {
	s.userIDs = append(s.userIDs, scope.UserID())
	return nil, s.err
}

func (s *stubUseCases) Selection(_ context.Context, scope platform.UserScope) ([]store.OrnamentSelection, error) {
	s.userIDs = append(s.userIDs, scope.UserID())
	return nil, s.err
}

func (s *stubUseCases) Decorate(_ context.Context, scope platform.UserScope, requested store.Selection) ([]store.OrnamentSelection, int, error) {
	s.userIDs = append(s.userIDs, scope.UserID())
	s.requested = requested
	return nil, 0, s.err
}

func storeHandlers(server *Server) []rpctest.Handler {
	return []rpctest.Handler{
		{Name: "GetCatalog", Call: func(ctx context.Context) error {
			_, err := server.GetCatalog(ctx, connect.NewRequest(&storev1.GetCatalogRequest{}))
			return err
		}},
		{Name: "GetSelection", Call: func(ctx context.Context) error {
			_, err := server.GetSelection(ctx, connect.NewRequest(&storev1.GetSelectionRequest{}))
			return err
		}},
		{Name: "Decorate", Call: func(ctx context.Context) error {
			_, err := server.Decorate(ctx, connect.NewRequest(&storev1.DecorateRequest{BackgroundOrnamentId: "background.lightfall"}))
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
	handlers := storeHandlers(server)
	for _, handler := range handlers {
		if err := handler.Call(rpctest.UserContext()); err != nil {
			t.Fatalf("%s failed: %v", handler.Name, err)
		}
	}
	for _, userID := range stub.userIDs {
		if userID != rpctest.UserID {
			t.Fatalf("forwarded user = %q, want %q", userID, rpctest.UserID)
		}
	}
	if len(stub.userIDs) != len(handlers) {
		t.Fatalf("forwarded scopes = %v, want one per handler", stub.userIDs)
	}
	if stub.requested[store.KindBackground] != "background.lightfall" {
		t.Fatalf("decorate forwarded %+v, want the requested background", stub.requested)
	}
	rpctest.RequireUnauthenticatedWithoutScope(t, handlers)
}

func TestHandlersMapUseCaseRefusals(t *testing.T) {
	t.Parallel()
	server, err := NewServer(&stubUseCases{err: store.ErrUnknownOrnamentID})
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}
	for _, handler := range storeHandlers(server) {
		rpctest.RequireCode(t, handler.Call(rpctest.UserContext()), connect.CodeInvalidArgument)
	}
}
