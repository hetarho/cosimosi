package rpc

import (
	"context"
	"testing"
	"time"

	"connectrpc.com/connect"

	"github.com/cosimosi/api/internal/account"
	accountv1 "github.com/cosimosi/api/internal/gen/cosimosi/account/v1"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/rpctest"
)

// stubUseCases records what each handler forwarded.
type stubUseCases struct {
	userIDs []string
	signUp  account.SignUpInput
	update  account.UpdateProfileInput
	mood    account.Mood
	color   account.Color
	err     error
}

func (s *stubUseCases) seen(scope platform.UserScope) { s.userIDs = append(s.userIDs, scope.UserID()) }

func (s *stubUseCases) SignUp(_ context.Context, scope platform.UserScope, input account.SignUpInput) (account.Profile, bool, error) {
	s.seen(scope)
	s.signUp = input
	return account.Profile{}, false, s.err
}
func (s *stubUseCases) GetProfile(_ context.Context, scope platform.UserScope) (*account.ProfileView, error) {
	s.seen(scope)
	return nil, s.err
}
func (s *stubUseCases) UpdateProfile(_ context.Context, scope platform.UserScope, input account.UpdateProfileInput) (account.ProfileView, error) {
	s.seen(scope)
	s.update = input
	return account.ProfileView{}, s.err
}
func (s *stubUseCases) ListAuthProviders(_ context.Context, scope platform.UserScope) ([]account.AuthProvider, error) {
	s.seen(scope)
	return nil, s.err
}
func (s *stubUseCases) GetInviteLink(_ context.Context, scope platform.UserScope) (account.InviteLink, error) {
	s.seen(scope)
	return account.InviteLink{}, s.err
}
func (s *stubUseCases) GetMoodColors(_ context.Context, scope platform.UserScope) ([]account.MoodColor, error) {
	s.seen(scope)
	return nil, s.err
}
func (s *stubUseCases) SetMoodColor(_ context.Context, scope platform.UserScope, mood account.Mood, color account.Color) (account.MoodColor, error) {
	s.seen(scope)
	s.mood, s.color = mood, color
	return account.MoodColor{}, s.err
}
func (s *stubUseCases) GetMoodColorStats(_ context.Context, scope platform.UserScope, mood account.Mood) ([]account.MoodColorStat, error) {
	s.seen(scope)
	s.mood = mood
	return nil, s.err
}
func (s *stubUseCases) Withdraw(_ context.Context, scope platform.UserScope) (account.WithdrawalWindow, error) {
	s.seen(scope)
	return account.WithdrawalWindow{}, s.err
}
func (s *stubUseCases) RestoreAccount(_ context.Context, scope platform.UserScope) (time.Time, error) {
	s.seen(scope)
	return time.Time{}, s.err
}

func accountHandlers(server *Server) []rpctest.Handler {
	call := func(name string, fn func(context.Context) error) rpctest.Handler {
		return rpctest.Handler{Name: name, Call: fn}
	}
	return []rpctest.Handler{
		call("SignUp", func(ctx context.Context) error {
			_, err := server.SignUp(ctx, connect.NewRequest(&accountv1.SignUpRequest{
				Nickname: "별빛", Timezone: "Asia/Seoul", Locale: "ko", InviteToken: "invite-1",
			}))
			return err
		}),
		call("GetProfile", func(ctx context.Context) error {
			_, err := server.GetProfile(ctx, connect.NewRequest(&accountv1.GetProfileRequest{}))
			return err
		}),
		call("UpdateProfile", func(ctx context.Context) error {
			_, err := server.UpdateProfile(ctx, connect.NewRequest(&accountv1.UpdateProfileRequest{Timezone: "Europe/Paris"}))
			return err
		}),
		call("ListAuthProviders", func(ctx context.Context) error {
			_, err := server.ListAuthProviders(ctx, connect.NewRequest(&accountv1.ListAuthProvidersRequest{}))
			return err
		}),
		call("GetInviteLink", func(ctx context.Context) error {
			_, err := server.GetInviteLink(ctx, connect.NewRequest(&accountv1.GetInviteLinkRequest{}))
			return err
		}),
		call("GetMoodColors", func(ctx context.Context) error {
			_, err := server.GetMoodColors(ctx, connect.NewRequest(&accountv1.GetMoodColorsRequest{}))
			return err
		}),
		call("SetMoodColor", func(ctx context.Context) error {
			_, err := server.SetMoodColor(ctx, connect.NewRequest(&accountv1.SetMoodColorRequest{Mood: "JOY", Color: "#FFAA00"}))
			return err
		}),
		call("GetMoodColorStats", func(ctx context.Context) error {
			_, err := server.GetMoodColorStats(ctx, connect.NewRequest(&accountv1.GetMoodColorStatsRequest{Mood: "JOY"}))
			return err
		}),
		call("Withdraw", func(ctx context.Context) error {
			_, err := server.Withdraw(ctx, connect.NewRequest(&accountv1.WithdrawRequest{}))
			return err
		}),
		call("RestoreAccount", func(ctx context.Context) error {
			_, err := server.RestoreAccount(ctx, connect.NewRequest(&accountv1.RestoreAccountRequest{}))
			return err
		}),
	}
}

func TestHandlersForwardScopeAndInputs(t *testing.T) {
	t.Parallel()
	stub := &stubUseCases{}
	server, err := NewServer(stub)
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}
	handlers := accountHandlers(server)
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
	if stub.signUp.Nickname != "별빛" || stub.signUp.InviteToken != "invite-1" || stub.signUp.Locale != "ko" {
		t.Fatalf("sign-up forwarded %+v", stub.signUp)
	}
	if stub.mood != account.Mood("JOY") || stub.color != account.Color("#FFAA00") {
		t.Fatalf("mood colour forwarded %q/%q", stub.mood, stub.color)
	}
	rpctest.RequireUnauthenticatedWithoutScope(t, handlers)
}

func TestHandlersMapUseCaseRefusals(t *testing.T) {
	t.Parallel()
	server, err := NewServer(&stubUseCases{err: account.ErrSignupRequired})
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}
	for _, handler := range accountHandlers(server) {
		rpctest.RequireCode(t, handler.Call(rpctest.UserContext()), connect.CodeFailedPrecondition)
	}
}
