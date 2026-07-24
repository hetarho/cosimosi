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
	memoryv1 "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1"
	memoryv1connect "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1/memoryv1connect"
	platformv1 "github.com/cosimosi/api/internal/gen/cosimosi/platform/v1"
	platformv1connect "github.com/cosimosi/api/internal/gen/cosimosi/platform/v1/platformv1connect"
	twinklev1 "github.com/cosimosi/api/internal/gen/cosimosi/twinkle/v1"
	twinklev1connect "github.com/cosimosi/api/internal/gen/cosimosi/twinkle/v1/twinklev1connect"
	"github.com/cosimosi/api/internal/platform/apperr"
	"github.com/cosimosi/api/internal/platform/observability"
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

func TestRequestIDRejectsUnsafeClientValues(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(NewHandler(log.New(io.Discard, "", 0)))
	t.Cleanup(server.Close)

	client := platformv1connect.NewPlatformServiceClient(server.Client(), server.URL)
	req := connect.NewRequest(&platformv1.PingRequest{})
	req.Header().Set(requestIDHeader, "authorization=secret")

	res, err := client.Ping(context.Background(), req)
	if err != nil {
		t.Fatalf("Ping failed: %v", err)
	}
	if got := res.Header().Get(requestIDHeader); got == "" || got == "authorization=secret" {
		t.Fatalf("response request id = %q, want generated safe id", got)
	}
	if got := res.Msg.GetRequestId(); got == "" || got == "authorization=secret" {
		t.Fatalf("message request id = %q, want generated safe id", got)
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
	info := requireWireErrorInfo(t, err)
	if info.GetReason() != apperr.ReasonPlatformUnauthenticated || info.GetDomain() != "platform" || info.GetRequestId() == "" {
		t.Fatalf("unauthenticated ErrorInfo = %#v", info)
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
	info := requireWireErrorInfo(t, err)
	if info.GetReason() != apperr.ReasonPlatformUnauthenticated || info.GetRequestId() == "" {
		t.Fatalf("invalid-token ErrorInfo = %#v", info)
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
	info := requireWireErrorInfo(t, err)
	if info.GetReason() != apperr.ReasonPlatformAuthVerifierUnavailable || info.GetRequestId() == "" {
		t.Fatalf("verifier-unavailable ErrorInfo = %#v", info)
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

func TestPanicRecoveryReturnsInternalAndReportsUnexpectedFailure(t *testing.T) {
	t.Setenv(apperr.EnvErrorDetail, "")

	reporter := observability.NewInMemoryReporter()
	server := httptest.NewServer(NewHandler(
		log.New(io.Discard, "", 0),
		WithPlatformService(panicPlatformService{}),
		WithObservabilityReporter(reporter),
	))
	t.Cleanup(server.Close)

	client := platformv1connect.NewPlatformServiceClient(server.Client(), server.URL)
	req := connect.NewRequest(&platformv1.PingRequest{})
	req.Header().Set(requestIDHeader, "request-panic")
	_, err := client.Ping(context.Background(), req)
	if err == nil {
		t.Fatal("Ping unexpectedly succeeded")
	}
	if got := connect.CodeOf(err); got != connect.CodeInternal {
		t.Fatalf("code = %s, want internal", got)
	}
	if strings.Contains(err.Error(), "boom") {
		t.Fatalf("panic leaked to client: %v", err)
	}
	info := requireWireErrorInfo(t, err)
	if info.GetReason() != apperr.ReasonInternal || info.GetRequestId() != "request-panic" || info.GetDebugDetail() != "" {
		t.Fatalf("panic ErrorInfo = %#v", info)
	}
	events := reporter.Events()
	if len(events) != 1 {
		t.Fatalf("reported events = %d, want 1", len(events))
	}
	if got := events[0].Attributes["request_id"]; got != "request-panic" {
		t.Fatalf("reported request id = %q, want request-panic", got)
	}
	if got := events[0].Attributes["rpc_code"]; got != connect.CodeInternal.String() {
		t.Fatalf("reported rpc code = %q, want internal", got)
	}
	if got := events[0].Attributes["panic_type"]; got != "string" {
		t.Fatalf("reported panic type = %q, want string", got)
	}
}

func TestStructuredInternalErrorsAreStableAndReported(t *testing.T) {
	t.Setenv(apperr.EnvErrorDetail, "")

	reporter := observability.NewInMemoryReporter()
	var logs bytes.Buffer
	server := httptest.NewServer(NewHandler(
		log.New(&logs, "", 0),
		WithPlatformService(internalErrorPlatformService{}),
		WithObservabilityReporter(reporter),
	))
	t.Cleanup(server.Close)

	client := platformv1connect.NewPlatformServiceClient(server.Client(), server.URL)
	req := connect.NewRequest(&platformv1.PingRequest{})
	req.Header().Set(requestIDHeader, "authorization=secret")
	_, err := client.Ping(context.Background(), req)
	if err == nil {
		t.Fatal("Ping unexpectedly succeeded")
	}
	if got := connect.CodeOf(err); got != connect.CodeInternal {
		t.Fatalf("code = %s, want internal", got)
	}
	if strings.Contains(err.Error(), "database exploded") {
		t.Fatalf("internal error leaked to client: %v", err)
	}
	info := requireWireErrorInfo(t, err)
	if info.GetReason() != apperr.ReasonInternal || info.GetDomain() != "platform" || info.GetRequestId() == "" || info.GetDebugDetail() != "" {
		t.Fatalf("internal ErrorInfo = %#v", info)
	}
	events := reporter.Events()
	if len(events) != 1 {
		t.Fatalf("reported events = %d, want 1", len(events))
	}
	if strings.Contains(events[0].Error, "database exploded") {
		t.Fatalf("reported internal error leaked detail: %q", events[0].Error)
	}
	if got := events[0].Attributes["method"]; got != platformv1connect.PlatformServicePingProcedure {
		t.Fatalf("reported method = %q, want ping procedure", got)
	}
	if got := events[0].Attributes["request_id"]; got == "" || got == "authorization=secret" {
		t.Fatalf("reported request id = %q, want generated safe id", got)
	}
	if got := events[0].Attributes["request_id"]; got != info.GetRequestId() {
		t.Fatalf("reported request id = %q, detail request id = %q", got, info.GetRequestId())
	}
	if got := events[0].Attributes["error_type"]; got == "" || got == "*connect.Error" {
		t.Fatalf("reported error type = %q, want underlying safe type", got)
	}
	if got := logs.String(); !strings.Contains(got, "database exploded") || !strings.Contains(got, info.GetRequestId()) {
		t.Fatalf("logs = %q, want raw cause and detail request id", got)
	}
}

func TestStructuredInternalErrorsExposeDebugDetailOnlyWhenEnabled(t *testing.T) {
	t.Setenv(apperr.EnvErrorDetail, apperr.DetailVerbose)

	server := httptest.NewServer(NewHandler(
		log.New(io.Discard, "", 0),
		WithPlatformService(internalErrorPlatformService{}),
	))
	t.Cleanup(server.Close)

	client := platformv1connect.NewPlatformServiceClient(server.Client(), server.URL)
	req := connect.NewRequest(&platformv1.PingRequest{})
	req.Header().Set(requestIDHeader, "request-verbose")
	_, err := client.Ping(context.Background(), req)
	if err == nil {
		t.Fatal("Ping unexpectedly succeeded")
	}
	info := requireWireErrorInfo(t, err)
	if info.GetRequestId() != "request-verbose" || !strings.Contains(info.GetDebugDetail(), "database exploded") {
		t.Fatalf("verbose ErrorInfo = %#v", info)
	}
	if strings.Contains(err.Error(), "database exploded") {
		t.Fatalf("ordinary error message leaked raw detail: %v", err)
	}
}

func TestRepresentativeReadFailuresExposeTheServerJoinKey(t *testing.T) {
	t.Setenv(apperr.EnvErrorDetail, "")

	var logs bytes.Buffer
	reporter := observability.NewInMemoryReporter()
	handler := NewHandler(
		log.New(&logs, "", 0),
		WithPublicProcedures([]string{
			twinklev1connect.TwinkleServiceGetBalanceProcedure,
			memoryv1connect.MemoryServiceSyncStatusProcedure,
		}),
		WithObservabilityReporter(reporter),
		WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
			return twinklev1connect.NewTwinkleServiceHandler(failingTwinkleReadService{}, opts...)
		}),
		WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
			return memoryv1connect.NewMemoryServiceHandler(failingMemoryReadService{}, opts...)
		}),
	)
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	twinkleClient := twinklev1connect.NewTwinkleServiceClient(server.Client(), server.URL)
	_, balanceErr := twinkleClient.GetBalance(
		context.Background(),
		connect.NewRequest(&twinklev1.GetBalanceRequest{}),
	)
	memoryClient := memoryv1connect.NewMemoryServiceClient(server.Client(), server.URL)
	_, syncErr := memoryClient.SyncStatus(
		context.Background(),
		connect.NewRequest(&memoryv1.SyncStatusRequest{}),
	)

	for index, testCase := range []struct {
		name     string
		err      error
		rawCause string
	}{
		{name: "GetBalance", err: balanceErr, rawCause: "balance store unavailable"},
		{name: "SyncStatus", err: syncErr, rawCause: "sync status query failed"},
	} {
		if testCase.err == nil {
			t.Fatalf("%s unexpectedly succeeded", testCase.name)
		}
		info := requireWireErrorInfo(t, testCase.err)
		if info.GetReason() != apperr.ReasonInternal || info.GetRequestId() == "" || info.GetDebugDetail() != "" {
			t.Fatalf("%s ErrorInfo = %#v", testCase.name, info)
		}
		if strings.Contains(testCase.err.Error(), testCase.rawCause) {
			t.Fatalf("%s leaked raw cause: %v", testCase.name, testCase.err)
		}
		events := reporter.Events()
		if len(events) != 2 {
			t.Fatalf("%s reporter events = %d, want 2", testCase.name, len(events))
		}
		if got := events[index].Attributes["request_id"]; got != info.GetRequestId() {
			t.Fatalf("%s detail id = %q, reporter id = %q", testCase.name, info.GetRequestId(), got)
		}
		if !strings.Contains(logs.String(), testCase.rawCause) ||
			!strings.Contains(logs.String(), info.GetRequestId()) {
			t.Fatalf("%s log does not contain raw cause and join key: %q", testCase.name, logs.String())
		}
	}
}

func TestCORSPreflightAllowsConnectHeaders(t *testing.T) {
	t.Parallel()

	handler := NewHandler(log.New(io.Discard, "", 0))
	req := httptest.NewRequest(http.MethodOptions, platformv1connect.PlatformServicePingProcedure, nil)
	req.Header.Set("Origin", "http://localhost:1214")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	req.Header.Set("Access-Control-Request-Headers", "Content-Type,Connect-Protocol-Version")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight status = %d, want 204", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:1214" {
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

type internalErrorPlatformService struct{}

func (internalErrorPlatformService) Ping(context.Context, *connect.Request[platformv1.PingRequest]) (*connect.Response[platformv1.PingResponse], error) {
	return nil, connect.NewError(connect.CodeInternal, errors.New("database exploded"))
}

type failingTwinkleReadService struct {
	twinklev1connect.UnimplementedTwinkleServiceHandler
}

func (failingTwinkleReadService) GetBalance(context.Context, *connect.Request[twinklev1.GetBalanceRequest]) (*connect.Response[twinklev1.GetBalanceResponse], error) {
	return nil, apperr.Internal(errors.New("balance store unavailable"))
}

type failingMemoryReadService struct {
	memoryv1connect.UnimplementedMemoryServiceHandler
}

func (failingMemoryReadService) SyncStatus(context.Context, *connect.Request[memoryv1.SyncStatusRequest]) (*connect.Response[memoryv1.SyncStatusResponse], error) {
	return nil, apperr.Internal(errors.New("sync status query failed"))
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

func requireWireErrorInfo(t *testing.T, err error) *platformv1.ErrorInfo {
	t.Helper()
	info, ok := apperr.Info(err)
	if !ok {
		t.Fatalf("ErrorInfo missing from %v", err)
	}
	return info
}
