package rpcserver_test

import (
	"context"
	"net/http/httptest"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/golang-jwt/jwt/v5"

	cosimosiv1 "github.com/cosimosi/backend/internal/gen/cosimosi/v1"
	"github.com/cosimosi/backend/internal/gen/cosimosi/v1/cosimosiv1connect"
	"github.com/cosimosi/backend/internal/platform/config"
	"github.com/cosimosi/backend/internal/platform/rpcserver"
)

const testJWTSecret = "test-secret-0123456789"

// stubVisit reaches OK so the test can tell "auth bypassed → handler ran" apart from "rejected".
type stubVisit struct{ cosimosiv1connect.UnimplementedVisitServiceHandler }

func (stubVisit) GetSharedUniverse(context.Context, *connect.Request[cosimosiv1.GetSharedUniverseRequest]) (*connect.Response[cosimosiv1.GetSharedUniverseResponse], error) {
	return connect.NewResponse(&cosimosiv1.GetSharedUniverseResponse{}), nil
}

// The protected services are never reached in these tests (auth rejects first), so the
// Unimplemented shims are enough.
// stubMemory reaches OK so the membership test can tell "blocked by the gate (PermissionDenied)"
// apart from "reached the handler" (the protected stubs return OK rather than Unimplemented).
type stubMemory struct{ cosimosiv1connect.UnimplementedMemoryServiceHandler }

func (stubMemory) GetUniverse(context.Context, *connect.Request[cosimosiv1.GetUniverseRequest]) (*connect.Response[cosimosiv1.GetUniverseResponse], error) {
	return connect.NewResponse(&cosimosiv1.GetUniverseResponse{}), nil
}

type stubSettings struct{ cosimosiv1connect.UnimplementedSettingsServiceHandler }
type stubAdmin struct{ cosimosiv1connect.UnimplementedAdminServiceHandler }
type stubShare struct{ cosimosiv1connect.UnimplementedShareServiceHandler }
type stubGift struct{ cosimosiv1connect.UnimplementedGiftServiceHandler }

// stubInvite implements BOTH invite services. GetMembershipStatus reaches OK so the membership
// test can prove InviteService is reachable by a not-yet-member (it is auth-only, not gated).
type stubInvite struct {
	cosimosiv1connect.UnimplementedInviteServiceHandler
	cosimosiv1connect.UnimplementedInviteAdminServiceHandler
}

func (stubInvite) GetMembershipStatus(context.Context, *connect.Request[cosimosiv1.GetMembershipStatusRequest]) (*connect.Response[cosimosiv1.GetMembershipStatusResponse], error) {
	return connect.NewResponse(&cosimosiv1.GetMembershipStatusResponse{IsMember: false}), nil
}

// stubMembership is the rpcserver.MembershipChecker for tests — a fixed membership verdict.
type stubMembership struct{ member bool }

func (s stubMembership) IsMember(context.Context, string) (bool, error) { return s.member, nil }

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	// Gate OFF (zero-value InviteGateEnabled) — this server tests only the auth boundary.
	return newTestServerWith(t, &config.Config{SupabaseJWTSecret: testJWTSecret, CORSOrigin: "http://localhost", Port: "0"}, stubMembership{member: false})
}

func newTestServerWith(t *testing.T, cfg *config.Config, membership rpcserver.MembershipChecker) *httptest.Server {
	t.Helper()
	// A non-empty secret arms the HS256 auth interceptor so a missing token is Unauthenticated
	// (not the "auth not configured" path). db is nil — only /health touches it, never hit here.
	srv := rpcserver.New(cfg, nil, "test", stubMemory{}, stubSettings{}, stubAdmin{}, stubShare{}, stubVisit{}, stubGift{}, stubInvite{}, stubInvite{}, membership, nil)
	ts := httptest.NewServer(srv.Handler)
	t.Cleanup(ts.Close)
	return ts
}

// mintToken signs a minimal HS256 access token (sub + exp) the auth interceptor accepts.
func mintToken(t *testing.T, sub string) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": sub,
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	s, err := tok.SignedString([]byte(testJWTSecret))
	if err != nil {
		t.Fatalf("sign test token: %v", err)
	}
	return s
}

func bearer[T any](req *connect.Request[T], token string) *connect.Request[T] {
	req.Header().Set("Authorization", "Bearer "+token)
	return req
}

// 3.1: VisitService is the ONLY rpc reachable without a token; every other service still
// rejects an unauthenticated call. A regression guard against the public surface widening.
func TestUnauthBoundary(t *testing.T) {
	ts := newTestServer(t)
	hc := ts.Client()
	ctx := context.Background()

	// Each protected service: no Authorization header → Unauthenticated.
	t.Run("memory rejected", func(t *testing.T) {
		c := cosimosiv1connect.NewMemoryServiceClient(hc, ts.URL)
		_, err := c.GetUniverse(ctx, connect.NewRequest(&cosimosiv1.GetUniverseRequest{}))
		assertUnauthenticated(t, err)
	})
	t.Run("settings rejected", func(t *testing.T) {
		c := cosimosiv1connect.NewSettingsServiceClient(hc, ts.URL)
		_, err := c.GetSettings(ctx, connect.NewRequest(&cosimosiv1.GetSettingsRequest{}))
		assertUnauthenticated(t, err)
	})
	t.Run("admin rejected", func(t *testing.T) {
		c := cosimosiv1connect.NewAdminServiceClient(hc, ts.URL)
		_, err := c.GetAdminOverview(ctx, connect.NewRequest(&cosimosiv1.GetAdminOverviewRequest{}))
		assertUnauthenticated(t, err)
	})
	t.Run("share settings rejected", func(t *testing.T) {
		c := cosimosiv1connect.NewShareServiceClient(hc, ts.URL)
		_, err := c.GetShareSettings(ctx, connect.NewRequest(&cosimosiv1.GetShareSettingsRequest{}))
		assertUnauthenticated(t, err)
	})
	t.Run("gift rejected", func(t *testing.T) {
		// spec 36: GiftService has NO public surface — even its NO_SIDE_EFFECTS read needs auth.
		c := cosimosiv1connect.NewGiftServiceClient(hc, ts.URL)
		_, err := c.GetStarGift(ctx, connect.NewRequest(&cosimosiv1.GetStarGiftRequest{Token: "x"}))
		assertUnauthenticated(t, err)
	})

	// The ONE public rpc: no token → reaches the handler (here, OK).
	t.Run("visit allowed without auth", func(t *testing.T) {
		c := cosimosiv1connect.NewVisitServiceClient(hc, ts.URL)
		_, err := c.GetSharedUniverse(ctx, connect.NewRequest(&cosimosiv1.GetSharedUniverseRequest{Slug: "x"}))
		if err != nil {
			t.Fatalf("VisitService must be reachable without auth, got %v (code %s)", err, connect.CodeOf(err))
		}
	})
}

func assertUnauthenticated(t *testing.T, err error) {
	t.Helper()
	if err == nil {
		t.Fatal("want Unauthenticated, got nil (auth bypassed!)")
	}
	if got := connect.CodeOf(err); got != connect.CodeUnauthenticated {
		t.Fatalf("want CodeUnauthenticated, got %s (%v)", got, err)
	}
}

// 41: with the invite gate ON, an AUTHENTICATED but not-yet-member caller is blocked from the
// core universe services (PermissionDenied), while InviteService — the only way IN — stays
// reachable, and an unauthenticated call is still rejected by auth FIRST (Unauthenticated, never
// PermissionDenied). Regression guard against the gate either leaking core access or sealing the
// redeem surface shut.
func TestMembershipBoundary(t *testing.T) {
	cfg := &config.Config{SupabaseJWTSecret: testJWTSecret, CORSOrigin: "http://localhost", Port: "0", InviteGateEnabled: true}
	ts := newTestServerWith(t, cfg, stubMembership{member: false})
	hc := ts.Client()
	ctx := context.Background()
	token := mintToken(t, "user-not-a-member")

	t.Run("memory blocked for non-member", func(t *testing.T) {
		c := cosimosiv1connect.NewMemoryServiceClient(hc, ts.URL)
		_, err := c.GetUniverse(ctx, bearer(connect.NewRequest(&cosimosiv1.GetUniverseRequest{}), token))
		assertCode(t, err, connect.CodePermissionDenied)
	})
	t.Run("share blocked for non-member", func(t *testing.T) {
		c := cosimosiv1connect.NewShareServiceClient(hc, ts.URL)
		_, err := c.GetShareSettings(ctx, bearer(connect.NewRequest(&cosimosiv1.GetShareSettingsRequest{}), token))
		assertCode(t, err, connect.CodePermissionDenied)
	})
	t.Run("settings blocked for non-member", func(t *testing.T) {
		c := cosimosiv1connect.NewSettingsServiceClient(hc, ts.URL)
		_, err := c.GetSettings(ctx, bearer(connect.NewRequest(&cosimosiv1.GetSettingsRequest{}), token))
		assertCode(t, err, connect.CodePermissionDenied)
	})
	t.Run("gift blocked for non-member", func(t *testing.T) {
		c := cosimosiv1connect.NewGiftServiceClient(hc, ts.URL)
		_, err := c.GetStarGift(ctx, bearer(connect.NewRequest(&cosimosiv1.GetStarGiftRequest{Token: "x"}), token))
		assertCode(t, err, connect.CodePermissionDenied)
	})
	t.Run("invite service reachable for non-member", func(t *testing.T) {
		c := cosimosiv1connect.NewInviteServiceClient(hc, ts.URL)
		_, err := c.GetMembershipStatus(ctx, bearer(connect.NewRequest(&cosimosiv1.GetMembershipStatusRequest{}), token))
		if err != nil {
			t.Fatalf("InviteService must be reachable by a non-member, got %v (code %s)", err, connect.CodeOf(err))
		}
	})
	t.Run("unauthenticated rejected before membership", func(t *testing.T) {
		c := cosimosiv1connect.NewMemoryServiceClient(hc, ts.URL)
		_, err := c.GetUniverse(ctx, connect.NewRequest(&cosimosiv1.GetUniverseRequest{}))
		assertCode(t, err, connect.CodeUnauthenticated)
	})
}

// 41: an ADMIN (ADMIN_USER_IDS) enters the core universe WITHOUT redeeming a code — the
// membership gate exempts admins (they bootstrap the gate). stubMembership says not-a-member, yet
// the admin token reaches the handler.
func TestMembershipBoundary_AdminExempt(t *testing.T) {
	cfg := &config.Config{SupabaseJWTSecret: testJWTSecret, CORSOrigin: "http://localhost", Port: "0", InviteGateEnabled: true, AdminUserIDs: []string{"admin-sub"}}
	ts := newTestServerWith(t, cfg, stubMembership{member: false})
	hc := ts.Client()
	ctx := context.Background()
	token := mintToken(t, "admin-sub")

	c := cosimosiv1connect.NewMemoryServiceClient(hc, ts.URL)
	_, err := c.GetUniverse(ctx, bearer(connect.NewRequest(&cosimosiv1.GetUniverseRequest{}), token))
	if err != nil {
		t.Fatalf("admin must reach core service without membership, got %v (code %s)", err, connect.CodeOf(err))
	}
}

func assertCode(t *testing.T, err error, want connect.Code) {
	t.Helper()
	if err == nil {
		t.Fatalf("want %s, got nil", want)
	}
	if got := connect.CodeOf(err); got != want {
		t.Fatalf("want %s, got %s (%v)", want, got, err)
	}
}
