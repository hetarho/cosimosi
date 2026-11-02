package rpc

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	"github.com/cosimosi/api/internal/achievement"
	achievementv1 "github.com/cosimosi/api/internal/gen/cosimosi/achievement/v1"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/rpctest"
)

// stubUseCases records what each handler forwarded.
type stubUseCases struct {
	userIDs       []string
	achievementID string
	err           error
}

func (s *stubUseCases) ListAchievements(_ context.Context, scope platform.UserScope) ([]achievement.Entry, error) {
	s.userIDs = append(s.userIDs, scope.UserID())
	return nil, s.err
}

func (s *stubUseCases) ClaimAchievement(_ context.Context, scope platform.UserScope, achievementID string) (achievement.ClaimResult, error) {
	s.userIDs = append(s.userIDs, scope.UserID())
	s.achievementID = achievementID
	return achievement.ClaimResult{}, s.err
}

func achievementHandlers(server *Server, achievementID string) []rpctest.Handler {
	return []rpctest.Handler{
		{Name: "ListAchievements", Call: func(ctx context.Context) error {
			_, err := server.ListAchievements(ctx, connect.NewRequest(&achievementv1.ListAchievementsRequest{}))
			return err
		}},
		{Name: "ClaimAchievement", Call: func(ctx context.Context) error {
			_, err := server.ClaimAchievement(ctx, connect.NewRequest(&achievementv1.ClaimAchievementRequest{AchievementId: achievementID}))
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
	handlers := achievementHandlers(server, "first-diary")
	for _, handler := range handlers {
		if err := handler.Call(rpctest.UserContext()); err != nil {
			t.Fatalf("%s failed: %v", handler.Name, err)
		}
	}
	if len(stub.userIDs) != 2 || stub.userIDs[0] != rpctest.UserID || stub.userIDs[1] != rpctest.UserID {
		t.Fatalf("forwarded scopes = %v, want the caller for both handlers", stub.userIDs)
	}
	if stub.achievementID != "first-diary" {
		t.Fatalf("claim forwarded %q, want first-diary", stub.achievementID)
	}
	rpctest.RequireUnauthenticatedWithoutScope(t, handlers)
}

// The use case refuses a blank id; the handler keeps the wire answer an argument fault.
func TestClaimMapsABlankIDToInvalidArgument(t *testing.T) {
	t.Parallel()
	server, err := NewServer(&stubUseCases{err: achievement.ErrClaimInputRequired})
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}
	_, err = server.ClaimAchievement(rpctest.UserContext(), connect.NewRequest(&achievementv1.ClaimAchievementRequest{}))
	rpctest.RequireCode(t, err, connect.CodeInvalidArgument)
}
