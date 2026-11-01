package rpc

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"connectrpc.com/connect"
	memoryv1 "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1"
	memoryv1connect "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1/memoryv1connect"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
)

type exportStub struct {
	calls  int
	scope  string
	format memory.ExportFormat
	err    error
}

func (s *exportStub) Export(_ context.Context, scope platform.UserScope, format memory.ExportFormat) (memory.ExportResult, error) {
	s.calls++
	s.scope, s.format = scope.UserID(), format
	return memory.ExportResult{Content: []byte("retained"), ContentType: "text/markdown", Filename: "diaries.md"}, s.err
}

func TestExportHandlerValidatesAndForwardsItsSmallContract(t *testing.T) {
	stub := &exportStub{}
	server, err := NewExportServer(stub)
	if err != nil {
		t.Fatal(err)
	}
	_, handler := memoryv1connect.NewMemoryServiceHandler(server)
	httpServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Test-User") != "" {
			r = r.WithContext(platform.ContextWithUserID(r.Context(), r.Header.Get("X-Test-User")))
		}
		handler.ServeHTTP(w, r)
	}))
	t.Cleanup(httpServer.Close)
	client := memoryv1connect.NewMemoryServiceClient(httpServer.Client(), httpServer.URL)
	request := func(format memoryv1.ExportFormat, user string) *connect.Request[memoryv1.ExportRequest] {
		req := connect.NewRequest(&memoryv1.ExportRequest{Format: format})
		req.Header().Set("X-Test-User", user)
		return req
	}
	_, err = client.Export(context.Background(), request(memoryv1.ExportFormat_EXPORT_FORMAT_MD, ""))
	if connect.CodeOf(err) != connect.CodeUnauthenticated || stub.calls != 0 {
		t.Fatalf("unauthenticated call: %v, calls %d", err, stub.calls)
	}
	_, err = client.Export(context.Background(), request(memoryv1.ExportFormat_EXPORT_FORMAT_UNSPECIFIED, "owner"))
	if connect.CodeOf(err) != connect.CodeInvalidArgument || stub.calls != 0 {
		t.Fatalf("invalid input: %v, calls %d", err, stub.calls)
	}
	response, err := client.Export(context.Background(), request(memoryv1.ExportFormat_EXPORT_FORMAT_MD, "owner"))
	if err != nil {
		t.Fatal(err)
	}
	if stub.calls != 1 || stub.scope != "owner" || stub.format != memory.ExportFormatMD || string(response.Msg.Content) != "retained" {
		t.Fatalf("wrong forwarded contract: %+v / %+v", stub, response.Msg)
	}
	stub.err = memory.ErrExportFormatRequired
	_, err = client.Export(context.Background(), request(memoryv1.ExportFormat_EXPORT_FORMAT_MD, "owner"))
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("domain refusal: %v", err)
	}
}
