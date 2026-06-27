package platform

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"
	platformv1 "github.com/cosimosi/api/internal/gen/cosimosi/platform/v1"
	platformv1connect "github.com/cosimosi/api/internal/gen/cosimosi/platform/v1/platformv1connect"
)

func TestPingReturnsPlatformMetadata(t *testing.T) {
	t.Parallel()

	logger := log.New(io.Discard, "", 0)
	handler := NewHandler(
		logger,
		WithPlatformService(NewPlatformService(func() time.Time {
			return time.Date(2026, 6, 27, 1, 2, 3, 0, time.UTC)
		})),
	)
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	client := platformv1connect.NewPlatformServiceClient(server.Client(), server.URL)
	req := connect.NewRequest(&platformv1.PingRequest{})
	req.Header().Set(requestIDHeader, "request-test-1")

	res, err := client.Ping(context.Background(), req)
	if err != nil {
		t.Fatalf("Ping failed: %v", err)
	}
	if got := res.Msg.GetMessage(); got != "pong" {
		t.Fatalf("message = %q, want pong", got)
	}
	if got := res.Msg.GetRequestId(); got != "request-test-1" {
		t.Fatalf("request id = %q, want request-test-1", got)
	}
	if got := res.Header().Get(requestIDHeader); got != "request-test-1" {
		t.Fatalf("response request id header = %q, want request-test-1", got)
	}
	if got := res.Msg.GetServerTime().AsTime(); !got.Equal(time.Date(2026, 6, 27, 1, 2, 3, 0, time.UTC)) {
		t.Fatalf("server time = %s", got)
	}
}

func TestPingSupportsIdempotentHTTPGet(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(NewHandler(log.New(io.Discard, "", 0)))
	t.Cleanup(server.Close)

	client := platformv1connect.NewPlatformServiceClient(
		server.Client(),
		server.URL,
		connect.WithHTTPGet(),
	)
	res, err := client.Ping(context.Background(), connect.NewRequest(&platformv1.PingRequest{}))
	if err != nil {
		t.Fatalf("Ping over HTTP GET failed: %v", err)
	}
	if got := res.Msg.GetMessage(); got != "pong" {
		t.Fatalf("message = %q, want pong", got)
	}
}

func TestHealthAndRequestIDShareCompositionRoot(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(NewHandler(log.New(io.Discard, "", 0)))
	t.Cleanup(server.Close)

	res, err := server.Client().Get(server.URL + "/health")
	if err != nil {
		t.Fatalf("GET /health failed: %v", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("/health status = %d, want 200", res.StatusCode)
	}
	if got := res.Header.Get(requestIDHeader); got == "" {
		t.Fatal("/health response did not include a request id")
	}
}

func TestAuthAllowlistKeepsPublicPingAnonymous(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(NewHandler(log.New(io.Discard, "", 0)))
	t.Cleanup(server.Close)

	client := platformv1connect.NewPlatformServiceClient(server.Client(), server.URL)
	if _, err := client.Ping(context.Background(), connect.NewRequest(&platformv1.PingRequest{})); err != nil {
		t.Fatalf("public Ping without Authorization failed: %v", err)
	}
}

func TestAuthInterceptorRejectsProtectedPingWithoutToken(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(NewHandler(
		log.New(io.Discard, "", 0),
		WithPublicProcedures(nil),
		WithAuthVerifier(fakeAuthVerifier{userID: "user-1"}),
	))
	t.Cleanup(server.Close)

	client := platformv1connect.NewPlatformServiceClient(server.Client(), server.URL)
	_, err := client.Ping(context.Background(), connect.NewRequest(&platformv1.PingRequest{}))
	if err == nil {
		t.Fatal("protected Ping unexpectedly succeeded")
	}
	if got := connect.CodeOf(err); got != connect.CodeUnauthenticated {
		t.Fatalf("code = %s, want unauthenticated", got)
	}
	if strings.Contains(err.Error(), "user-1") {
		t.Fatalf("unauthenticated error leaked verifier detail: %v", err)
	}
}

func TestAuthInterceptorRejectsInvalidOrExpiredTokens(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(NewHandler(
		log.New(io.Discard, "", 0),
		WithPublicProcedures(nil),
		WithAuthVerifier(fakeAuthVerifier{err: errors.New("token expired")}),
	))
	t.Cleanup(server.Close)

	client := platformv1connect.NewPlatformServiceClient(server.Client(), server.URL)
	req := connect.NewRequest(&platformv1.PingRequest{})
	req.Header().Set(authorizationHeader, "Bearer expired-token")
	_, err := client.Ping(context.Background(), req)
	if err == nil {
		t.Fatal("protected Ping unexpectedly succeeded")
	}
	if got := connect.CodeOf(err); got != connect.CodeUnauthenticated {
		t.Fatalf("code = %s, want unauthenticated", got)
	}
	if strings.Contains(err.Error(), "token expired") {
		t.Fatalf("unauthenticated error leaked token detail: %v", err)
	}
}

func TestAuthInterceptorReturnsUnavailableWhenVerifierUnavailable(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(NewHandler(
		log.New(io.Discard, "", 0),
		WithPublicProcedures(nil),
		WithAuthVerifier(fakeAuthVerifier{err: ErrAuthVerifierUnavailable}),
	))
	t.Cleanup(server.Close)

	client := platformv1connect.NewPlatformServiceClient(server.Client(), server.URL)
	req := connect.NewRequest(&platformv1.PingRequest{})
	req.Header().Set(authorizationHeader, "Bearer valid-token")
	_, err := client.Ping(context.Background(), req)
	if err == nil {
		t.Fatal("protected Ping unexpectedly succeeded")
	}
	if got := connect.CodeOf(err); got != connect.CodeUnavailable {
		t.Fatalf("code = %s, want unavailable", got)
	}
	if strings.Contains(err.Error(), "Supabase") {
		t.Fatalf("unavailable error leaked verifier detail: %v", err)
	}
}

func TestAuthInterceptorExtractsUserIDForProtectedCalls(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(NewHandler(
		log.New(io.Discard, "", 0),
		WithPublicProcedures(nil),
		WithAuthVerifier(fakeAuthVerifier{userID: "supabase-user-1"}),
		WithPlatformService(authContextPlatformService{}),
	))
	t.Cleanup(server.Close)

	client := platformv1connect.NewPlatformServiceClient(server.Client(), server.URL)
	req := connect.NewRequest(&platformv1.PingRequest{})
	req.Header().Set(authorizationHeader, "Bearer valid-token")
	res, err := client.Ping(context.Background(), req)
	if err != nil {
		t.Fatalf("protected Ping failed: %v", err)
	}
	if got := res.Msg.GetMessage(); got != "user:supabase-user-1" {
		t.Fatalf("message = %q, want user id from context", got)
	}
}

func TestUserScopeRequiresAuthenticatedContext(t *testing.T) {
	t.Parallel()

	if _, err := UserScopeFromContext(context.Background()); err == nil {
		t.Fatal("UserScopeFromContext unexpectedly succeeded without auth context")
	}
	scope, err := UserScopeFromContext(ContextWithUserID(context.Background(), "user-scope-1"))
	if err != nil {
		t.Fatalf("UserScopeFromContext failed: %v", err)
	}
	if got := scope.UserID(); got != "user-scope-1" {
		t.Fatalf("scope user id = %q", got)
	}
}

func TestPanicRecoveryReturnsInternal(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(NewHandler(
		log.New(io.Discard, "", 0),
		WithPlatformService(panicPlatformService{}),
	))
	t.Cleanup(server.Close)

	client := platformv1connect.NewPlatformServiceClient(server.Client(), server.URL)
	_, err := client.Ping(context.Background(), connect.NewRequest(&platformv1.PingRequest{}))
	if err == nil {
		t.Fatal("Ping unexpectedly succeeded")
	}
	if got := connect.CodeOf(err); got != connect.CodeInternal {
		t.Fatalf("code = %s, want internal", got)
	}
}

func TestCORSPreflightAllowsConnectHeaders(t *testing.T) {
	t.Parallel()

	handler := NewHandler(log.New(io.Discard, "", 0))
	req := httptest.NewRequest(http.MethodOptions, platformv1connect.PlatformServicePingProcedure, nil)
	req.Header.Set("Origin", "http://localhost:5173")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	req.Header.Set("Access-Control-Request-Headers", "Content-Type,Connect-Protocol-Version")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight status = %d, want 204", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("allow origin = %q", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Methods"); !strings.Contains(got, http.MethodGet) || !strings.Contains(got, http.MethodPost) {
		t.Fatalf("allow methods = %q, want GET and POST", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(got, "Authorization") || !strings.Contains(got, requestIDHeader) {
		t.Fatalf("allow headers = %q, want auth and request id", got)
	}
}

func TestLoggingInterceptorRecordsMethodAndRequestID(t *testing.T) {
	t.Parallel()

	var logs bytes.Buffer
	server := httptest.NewServer(NewHandler(log.New(&logs, "", 0)))
	t.Cleanup(server.Close)

	client := platformv1connect.NewPlatformServiceClient(server.Client(), server.URL)
	req := connect.NewRequest(&platformv1.PingRequest{})
	req.Header().Set(requestIDHeader, "request-test-logging")
	if _, err := client.Ping(context.Background(), req); err != nil {
		t.Fatalf("Ping failed: %v", err)
	}

	got := logs.String()
	if !strings.Contains(got, platformv1connect.PlatformServicePingProcedure) {
		t.Fatalf("logs = %q, want method", got)
	}
	if !strings.Contains(got, "request-test-logging") {
		t.Fatalf("logs = %q, want request id", got)
	}
}

func TestAuthRejectedRequestsAreLogged(t *testing.T) {
	t.Parallel()

	var logs bytes.Buffer
	server := httptest.NewServer(NewHandler(
		log.New(&logs, "", 0),
		WithPublicProcedures(nil),
		WithAuthVerifier(fakeAuthVerifier{userID: "user-1"}),
	))
	t.Cleanup(server.Close)

	client := platformv1connect.NewPlatformServiceClient(server.Client(), server.URL)
	_, err := client.Ping(context.Background(), connect.NewRequest(&platformv1.PingRequest{}))
	if err == nil {
		t.Fatal("protected Ping unexpectedly succeeded")
	}

	got := logs.String()
	if !strings.Contains(got, platformv1connect.PlatformServicePingProcedure) {
		t.Fatalf("logs = %q, want method", got)
	}
	if !strings.Contains(got, connect.CodeUnauthenticated.String()) {
		t.Fatalf("logs = %q, want unauthenticated status", got)
	}
}

type panicPlatformService struct{}

func (panicPlatformService) Ping(context.Context, *connect.Request[platformv1.PingRequest]) (*connect.Response[platformv1.PingResponse], error) {
	panic("boom")
}

type fakeAuthVerifier struct {
	userID string
	err    error
}

func (v fakeAuthVerifier) VerifyAccessToken(context.Context, string) (UserIdentity, error) {
	if v.err != nil {
		return UserIdentity{}, v.err
	}
	return UserIdentity{UserID: v.userID}, nil
}

type authContextPlatformService struct{}

func (authContextPlatformService) Ping(ctx context.Context, _ *connect.Request[platformv1.PingRequest]) (*connect.Response[platformv1.PingResponse], error) {
	scope, err := UserScopeFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&platformv1.PingResponse{
		Message:   "user:" + scope.UserID(),
		RequestId: RequestIDFromContext(ctx),
	}), nil
}
