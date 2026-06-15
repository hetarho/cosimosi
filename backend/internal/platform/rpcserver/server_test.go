package rpcserver_test

import (
	"context"
	"net/http/httptest"
	"testing"

	"connectrpc.com/connect"

	cosimosiv1 "github.com/cosimosi/backend/internal/gen/cosimosi/v1"
	"github.com/cosimosi/backend/internal/gen/cosimosi/v1/cosimosiv1connect"
	"github.com/cosimosi/backend/internal/platform/config"
	"github.com/cosimosi/backend/internal/platform/rpcserver"
)

// stubVisit reaches OK so the test can tell "auth bypassed → handler ran" apart from "rejected".
type stubVisit struct{ cosimosiv1connect.UnimplementedVisitServiceHandler }

func (stubVisit) GetSharedUniverse(context.Context, *connect.Request[cosimosiv1.GetSharedUniverseRequest]) (*connect.Response[cosimosiv1.GetSharedUniverseResponse], error) {
	return connect.NewResponse(&cosimosiv1.GetSharedUniverseResponse{}), nil
}

// The protected services are never reached in these tests (auth rejects first), so the
// Unimplemented shims are enough.
type stubMemory struct{ cosimosiv1connect.UnimplementedMemoryServiceHandler }
type stubSettings struct{ cosimosiv1connect.UnimplementedSettingsServiceHandler }
type stubAdmin struct{ cosimosiv1connect.UnimplementedAdminServiceHandler }
type stubShare struct{ cosimosiv1connect.UnimplementedShareServiceHandler }
type stubGift struct{ cosimosiv1connect.UnimplementedGiftServiceHandler }

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	// A non-empty secret arms the HS256 auth interceptor so a missing token is Unauthenticated
	// (not the "auth not configured" path). db is nil — only /health touches it, never hit here.
	cfg := &config.Config{SupabaseJWTSecret: "test-secret-0123456789", CORSOrigin: "http://localhost", Port: "0"}
	srv := rpcserver.New(cfg, nil, "test", stubMemory{}, stubSettings{}, stubAdmin{}, stubShare{}, stubVisit{}, stubGift{}, nil)
	ts := httptest.NewServer(srv.Handler)
	t.Cleanup(ts.Close)
	return ts
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
