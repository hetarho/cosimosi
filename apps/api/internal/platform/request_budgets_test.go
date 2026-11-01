package platform

import (
	"bytes"
	"compress/gzip"
	"context"
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

type budgetPing struct {
	called bool
	block  bool
}

func (p *budgetPing) Ping(ctx context.Context, _ *connect.Request[platformv1.PingRequest]) (*connect.Response[platformv1.PingResponse], error) {
	p.called = true
	if p.block {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	return connect.NewResponse(&platformv1.PingResponse{Message: "pong"}), nil
}

func TestRequestBudgetsLimitRawAndDecompressedMessagesBeforeDispatch(t *testing.T) {
	for _, compressed := range []bool{false, true} {
		t.Run(map[bool]string{false: "raw", true: "gzip"}[compressed], func(t *testing.T) {
			service := &budgetPing{}
			budgets := DefaultRequestBudgets()
			budgets.MaxMessageBytes = 256
			handler := NewHandler(log.New(io.Discard, "", 0), WithPlatformService(service), WithRequestBudgets(budgets))
			payload := []byte(`{"ignored":"` + strings.Repeat("a", 4096) + `"}`)
			if compressed {
				var buffer bytes.Buffer
				writer := gzip.NewWriter(&buffer)
				_, _ = writer.Write(payload)
				if err := writer.Close(); err != nil {
					t.Fatal(err)
				}
				payload = buffer.Bytes()
				if len(payload) >= budgets.MaxMessageBytes {
					t.Fatal("fixture must fit wire limit")
				}
			}
			req := httptest.NewRequest(http.MethodPost, platformv1connect.PlatformServicePingProcedure, bytes.NewReader(payload))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Connect-Protocol-Version", "1")
			if compressed {
				req.Header.Set("Content-Encoding", "gzip")
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, req)
			if response.Code != http.StatusTooManyRequests || !strings.Contains(response.Body.String(), `"code":"resource_exhausted"`) {
				t.Fatalf("status %d: %s", response.Code, response.Body.String())
			}
			if service.called {
				t.Fatal("oversized input reached use case")
			}
		})
	}
}

func TestRequestBudgetsCancelBlockingDependencyAndAllowNormalCall(t *testing.T) {
	budgets := DefaultRequestBudgets()
	budgets.DefaultTimeout = 10 * time.Millisecond
	service := &budgetPing{block: true}
	server := httptest.NewServer(NewHandler(nil, WithPlatformService(service), WithRequestBudgets(budgets)))
	t.Cleanup(server.Close)
	client := platformv1connect.NewPlatformServiceClient(server.Client(), server.URL)
	_, err := client.Ping(context.Background(), connect.NewRequest(&platformv1.PingRequest{}))
	if connect.CodeOf(err) != connect.CodeDeadlineExceeded {
		t.Fatalf("error = %v", err)
	}
	server2 := httptest.NewServer(NewHandler(nil))
	t.Cleanup(server2.Close)
	_, err = platformv1connect.NewPlatformServiceClient(server2.Client(), server2.URL).Ping(context.Background(), connect.NewRequest(&platformv1.PingRequest{}))
	if err != nil {
		t.Fatal(err)
	}
}

func TestRequestBudgetPolicyAndHTTPTimeouts(t *testing.T) {
	b := DefaultRequestBudgets()
	if b.timeout("/x/Recall") != b.AITimeout || b.timeout("/x/Export") != b.ExportTimeout || b.timeout("/x/GetUniverse") != b.DefaultTimeout {
		t.Fatal("wrong procedure budget")
	}
	s := NewHTTPServer(":0", nil)
	if s.ReadHeaderTimeout <= 0 || s.ReadTimeout <= 0 || s.WriteTimeout <= b.AITimeout || s.IdleTimeout <= 0 {
		t.Fatal("unbounded HTTP lifetime")
	}
}
