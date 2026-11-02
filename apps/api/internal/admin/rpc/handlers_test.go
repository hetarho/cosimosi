package rpc

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	"github.com/cosimosi/api/internal/admin"
	adminv1 "github.com/cosimosi/api/internal/gen/cosimosi/admin/v1"
	"github.com/cosimosi/api/internal/platform/rpctest"
)

// stubUseCases records the acting operator and the inputs each handler forwarded.
type stubUseCases struct {
	actors []string
	calls  []string
	target string
	amount int
	note   string
	grant  string
	err    error
}

func (s *stubUseCases) act(name, actor string) {
	s.calls, s.actors = append(s.calls, name), append(s.actors, actor)
}

func (s *stubUseCases) GetAdminSelf(_ context.Context, userID string) (bool, error) {
	s.act("GetAdminSelf", userID)
	return false, s.err
}
func (s *stubUseCases) ListAdmins(context.Context) ([]admin.AdminEntry, error) {
	s.calls = append(s.calls, "ListAdmins")
	return nil, s.err
}
func (s *stubUseCases) GrantAdmin(_ context.Context, actor string, userID string) (bool, error) {
	s.act("GrantAdmin", actor)
	s.target = userID
	return false, s.err
}
func (s *stubUseCases) RevokeAdmin(_ context.Context, actor string, userID string) (bool, error) {
	s.act("RevokeAdmin", actor)
	s.target = userID
	return false, s.err
}
func (s *stubUseCases) ListUsers(_ context.Context, _ int, _ int, query string) (admin.UserPage, error) {
	s.calls = append(s.calls, "ListUsers")
	s.note = query
	return admin.UserPage{}, s.err
}
func (s *stubUseCases) GrantStardust(_ context.Context, actor string, input admin.GrantInput) (int, error) {
	s.act("GrantStardust", actor)
	s.target, s.amount, s.note, s.grant = input.UserID, input.Amount, input.Note, input.GrantID
	return 0, s.err
}
func (s *stubUseCases) ListTwinkleGrants(context.Context, int, int) (admin.GrantPage, error) {
	s.calls = append(s.calls, "ListTwinkleGrants")
	return admin.GrantPage{}, s.err
}
func (s *stubUseCases) ListProviderKeys(context.Context) ([]admin.ProviderKeyInfo, error) {
	s.calls = append(s.calls, "ListProviderKeys")
	return nil, s.err
}
func (s *stubUseCases) SetProviderKey(_ context.Context, actor string, provider string, _ string) (admin.ProviderKeyInfo, error) {
	s.act("SetProviderKey", actor)
	s.target = provider
	return admin.ProviderKeyInfo{}, s.err
}
func (s *stubUseCases) ClearProviderKey(_ context.Context, actor string, provider string) (admin.ProviderKeyInfo, error) {
	s.act("ClearProviderKey", actor)
	s.target = provider
	return admin.ProviderKeyInfo{}, s.err
}
func (s *stubUseCases) GetAIConfig(context.Context) ([]admin.CapabilitySelection, error) {
	s.calls = append(s.calls, "GetAIConfig")
	return nil, s.err
}
func (s *stubUseCases) SetAIConfig(_ context.Context, actor string, _ admin.AICapability, provider string, _ string) (admin.CapabilitySelection, error) {
	s.act("SetAIConfig", actor)
	s.target = provider
	return admin.CapabilitySelection{}, s.err
}
func (s *stubUseCases) ListProviderModels(context.Context, admin.AICapability, string) ([]admin.ProviderModel, error) {
	s.calls = append(s.calls, "ListProviderModels")
	return nil, s.err
}
func (s *stubUseCases) GetAIUsage(context.Context) (admin.AIUsage, error) {
	s.calls = append(s.calls, "GetAIUsage")
	return admin.AIUsage{}, s.err
}
func (s *stubUseCases) GetJobHealth(context.Context) (admin.JobHealth, error) {
	s.calls = append(s.calls, "GetJobHealth")
	return admin.JobHealth{}, s.err
}

// adminHandlers lists every handler; the acting ones read the caller themselves, the rest rely on
// the authorization interceptor in front of them.
func adminHandlers(server *Server) (all []rpctest.Handler, acting []rpctest.Handler) {
	h := func(name string, fn func(context.Context) error) rpctest.Handler {
		return rpctest.Handler{Name: name, Call: fn}
	}
	llm := adminv1.AICapability_AI_CAPABILITY_LLM
	acting = []rpctest.Handler{
		h("GetAdminSelf", func(ctx context.Context) error {
			_, err := server.GetAdminSelf(ctx, connect.NewRequest(&adminv1.GetAdminSelfRequest{}))
			return err
		}),
		h("GrantAdmin", func(ctx context.Context) error {
			_, err := server.GrantAdmin(ctx, connect.NewRequest(&adminv1.GrantAdminRequest{UserId: "user-2"}))
			return err
		}),
		h("RevokeAdmin", func(ctx context.Context) error {
			_, err := server.RevokeAdmin(ctx, connect.NewRequest(&adminv1.RevokeAdminRequest{UserId: "user-2"}))
			return err
		}),
		h("GrantStardust", func(ctx context.Context) error {
			_, err := server.GrantStardust(ctx, connect.NewRequest(&adminv1.GrantStardustRequest{
				UserId: "user-2", Amount: 30, Note: "thanks", GrantId: "grant-1",
			}))
			return err
		}),
		h("SetProviderKey", func(ctx context.Context) error {
			_, err := server.SetProviderKey(ctx, connect.NewRequest(&adminv1.SetProviderKeyRequest{Provider: "openrouter", ApiKey: "k"}))
			return err
		}),
		h("ClearProviderKey", func(ctx context.Context) error {
			_, err := server.ClearProviderKey(ctx, connect.NewRequest(&adminv1.ClearProviderKeyRequest{Provider: "openrouter"}))
			return err
		}),
		h("SetAIConfig", func(ctx context.Context) error {
			_, err := server.SetAIConfig(ctx, connect.NewRequest(&adminv1.SetAIConfigRequest{Capability: llm, Provider: "openrouter", Model: "m"}))
			return err
		}),
	}
	reading := []rpctest.Handler{
		h("ListAdmins", func(ctx context.Context) error {
			_, err := server.ListAdmins(ctx, connect.NewRequest(&adminv1.ListAdminsRequest{}))
			return err
		}),
		h("ListUsers", func(ctx context.Context) error {
			_, err := server.ListUsers(ctx, connect.NewRequest(&adminv1.ListUsersRequest{Query: "min"}))
			return err
		}),
		h("ListTwinkleGrants", func(ctx context.Context) error {
			_, err := server.ListTwinkleGrants(ctx, connect.NewRequest(&adminv1.ListTwinkleGrantsRequest{}))
			return err
		}),
		h("ListProviderKeys", func(ctx context.Context) error {
			_, err := server.ListProviderKeys(ctx, connect.NewRequest(&adminv1.ListProviderKeysRequest{}))
			return err
		}),
		h("GetAIConfig", func(ctx context.Context) error {
			_, err := server.GetAIConfig(ctx, connect.NewRequest(&adminv1.GetAIConfigRequest{}))
			return err
		}),
		h("ListProviderModels", func(ctx context.Context) error {
			_, err := server.ListProviderModels(ctx, connect.NewRequest(&adminv1.ListProviderModelsRequest{Capability: llm, Provider: "openrouter"}))
			return err
		}),
		h("GetAIUsage", func(ctx context.Context) error {
			_, err := server.GetAIUsage(ctx, connect.NewRequest(&adminv1.GetAIUsageRequest{}))
			return err
		}),
		h("GetJobHealth", func(ctx context.Context) error {
			_, err := server.GetJobHealth(ctx, connect.NewRequest(&adminv1.GetJobHealthRequest{}))
			return err
		}),
	}
	return append(append([]rpctest.Handler{}, acting...), reading...), acting
}

func TestHandlersForwardTheActingOperatorAndInputs(t *testing.T) {
	t.Parallel()
	stub := &stubUseCases{}
	server, err := NewServer(stub)
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}
	all, acting := adminHandlers(server)
	for _, handler := range all {
		if err := handler.Call(rpctest.UserContext()); err != nil {
			t.Fatalf("%s failed: %v", handler.Name, err)
		}
	}
	if len(stub.calls) != len(all) {
		t.Fatalf("use-case calls = %v, want one per handler", stub.calls)
	}
	if len(stub.actors) != len(acting) {
		t.Fatalf("acting calls = %v, want %d", stub.actors, len(acting))
	}
	for _, actor := range stub.actors {
		if actor != rpctest.UserID {
			t.Fatalf("forwarded operator = %q, want %q", actor, rpctest.UserID)
		}
	}
	rpctest.RequireUnauthenticatedWithoutScope(t, acting)
}

func TestGrantStardustForwardsTheWholeGrant(t *testing.T) {
	t.Parallel()
	stub := &stubUseCases{}
	server, err := NewServer(stub)
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}
	if _, err := server.GrantStardust(rpctest.UserContext(), connect.NewRequest(&adminv1.GrantStardustRequest{
		UserId: "user-2", Amount: 30, Note: "thanks", GrantId: "grant-1",
	})); err != nil {
		t.Fatalf("GrantStardust failed: %v", err)
	}
	if stub.target != "user-2" || stub.amount != 30 || stub.note != "thanks" || stub.grant != "grant-1" {
		t.Fatalf("grant forwarded %q/%d/%q/%q", stub.target, stub.amount, stub.note, stub.grant)
	}
}

func TestHandlersMapUseCaseRefusals(t *testing.T) {
	t.Parallel()
	server, err := NewServer(&stubUseCases{err: admin.ErrUserIDRequired})
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}
	all, _ := adminHandlers(server)
	for _, handler := range all {
		rpctest.RequireCode(t, handler.Call(rpctest.UserContext()), connect.CodeInvalidArgument)
	}
}
