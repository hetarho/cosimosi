package platform

import (
	"context"
	"errors"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"connectrpc.com/connect"
	memoryv1 "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1"
	memoryv1connect "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1/memoryv1connect"
	"github.com/cosimosi/api/internal/platform/apperr"
	"github.com/cosimosi/api/internal/platform/values"
)

type fakeAccountStatusReader struct {
	withdrawnAt time.Time
	withdrawn   bool
	err         error
	reads       int
}

func (f *fakeAccountStatusReader) WithdrawnAt(
	context.Context,
	string,
) (time.Time, bool, error) {
	f.reads++
	return f.withdrawnAt, f.withdrawn, f.err
}

type countingMemoryReadService struct {
	memoryv1connect.UnimplementedMemoryServiceHandler
	reads int
}

func (s *countingMemoryReadService) SyncStatus(
	context.Context,
	*connect.Request[memoryv1.SyncStatusRequest],
) (*connect.Response[memoryv1.SyncStatusResponse], error) {
	s.reads++
	return connect.NewResponse(&memoryv1.SyncStatusResponse{}), nil
}

func TestWithdrawnScopeRefusesBeforeContextReadWithStableMetadata(t *testing.T) {
	withdrawnAt := time.Date(2026, 7, 1, 2, 3, 4, 0, time.UTC)
	status := &fakeAccountStatusReader{withdrawnAt: withdrawnAt, withdrawn: true}
	service := &countingMemoryReadService{}
	server := newWithdrawnScopeTestServer(t, status, nil, service)

	_, err := callSyncStatus(t, server)
	if connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("SyncStatus error = %v, want permission_denied", err)
	}
	info, ok := apperr.Info(err)
	if !ok {
		t.Fatalf("ErrorInfo missing from %v", err)
	}
	deadline := withdrawnAt.Add(
		time.Duration(values.ReleaseSoftDeleteRetentionDays) * 24 * time.Hour,
	)
	if info.GetReason() != apperr.ReasonPlatformAccountWithdrawn ||
		info.GetMetadata()["withdrawn_at"] != withdrawnAt.Format(time.RFC3339) ||
		info.GetMetadata()["restore_deadline_at"] != deadline.Format(time.RFC3339) {
		t.Fatalf("withdrawn ErrorInfo = %#v", info)
	}
	if service.reads != 0 {
		t.Fatalf("context reads = %d, want zero before refusal", service.reads)
	}
}

func TestWithdrawnScopeFailsClosedButTreatsAbsentAccountAsLive(t *testing.T) {
	for _, testCase := range []struct {
		name   string
		reader AccountStatusReader
	}{
		{name: "unbound", reader: nil},
		{name: "lookup error", reader: &fakeAccountStatusReader{err: errors.New("db unavailable")}},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			service := &countingMemoryReadService{}
			server := newWithdrawnScopeTestServer(t, testCase.reader, nil, service)
			_, err := callSyncStatus(t, server)
			if connect.CodeOf(err) != connect.CodeInternal {
				t.Fatalf("SyncStatus error = %v, want internal", err)
			}
			if service.reads != 0 {
				t.Fatalf("context reads = %d, want zero on fail-closed path", service.reads)
			}
		})
	}

	status := &fakeAccountStatusReader{}
	service := &countingMemoryReadService{}
	server := newWithdrawnScopeTestServer(t, status, nil, service)
	if _, err := callSyncStatus(t, server); err != nil {
		t.Fatalf("absent-account SyncStatus failed: %v", err)
	}
	if status.reads != 1 || service.reads != 1 {
		t.Fatalf("absent-account reads = status %d context %d, want 1/1", status.reads, service.reads)
	}
}

func TestWithdrawnScopeExemptionBypassesStatusLookup(t *testing.T) {
	status := &fakeAccountStatusReader{
		withdrawnAt: time.Now().UTC(),
		withdrawn:   true,
	}
	service := &countingMemoryReadService{}
	server := newWithdrawnScopeTestServer(
		t,
		status,
		[]string{memoryv1connect.MemoryServiceSyncStatusProcedure},
		service,
	)
	if _, err := callSyncStatus(t, server); err != nil {
		t.Fatalf("exempt SyncStatus failed: %v", err)
	}
	if status.reads != 0 || service.reads != 1 {
		t.Fatalf("exempt reads = status %d context %d, want 0/1", status.reads, service.reads)
	}
}

func newWithdrawnScopeTestServer(
	t *testing.T,
	reader AccountStatusReader,
	exempt []string,
	service memoryv1connect.MemoryServiceHandler,
) *httptest.Server {
	t.Helper()
	options := []HandlerOption{
		WithAuthVerifier(fakeAuthVerifier{userID: "withdrawn-user"}),
		WithAccountStatusReader(reader),
		WithWithdrawnScopeExemptProcedures(exempt),
		WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
			return memoryv1connect.NewMemoryServiceHandler(service, opts...)
		}),
	}
	server := httptest.NewServer(NewHandler(log.New(io.Discard, "", 0), options...))
	t.Cleanup(server.Close)
	return server
}

func callSyncStatus(
	t *testing.T,
	server *httptest.Server,
) (*connect.Response[memoryv1.SyncStatusResponse], error) {
	t.Helper()
	client := memoryv1connect.NewMemoryServiceClient(server.Client(), server.URL)
	request := connect.NewRequest(&memoryv1.SyncStatusRequest{})
	request.Header().Set(authorizationHeader, "Bearer valid-token")
	return client.SyncStatus(context.Background(), request)
}
