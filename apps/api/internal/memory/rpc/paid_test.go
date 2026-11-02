package rpc

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"connectrpc.com/connect"
	memoryv1 "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1"
	memoryv1connect "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1/memoryv1connect"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
)

type paidStub struct {
	scope, operation, target, rewrite string
	consent                           bool
	calls                             int
	err                               error
}

func (s *paidStub) Recall(_ context.Context, scope platform.UserScope, cmd memory.RecallCommand) (memory.RecallResult, error) {
	operation, target, rewrite, consent := cmd.OperationID, cmd.MemoryID, cmd.RewriteText, cmd.SyncConsent
	s.calls++
	s.scope, s.operation, s.target, s.rewrite, s.consent = scope.UserID(), operation, target, rewrite, consent
	return memory.RecallResult{CurrentText: "recalled", Seed: 9007199254740993, Sync: memory.SyncResult{Current: time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC)}}, s.err
}

func (s *paidStub) RecallDiaryStars(_ context.Context, scope platform.UserScope, cmd memory.RecallDiaryStarsCommand) (memory.RecallDiaryStarsResult, error) {
	operation, target, consent := cmd.OperationID, cmd.DiaryID, cmd.SyncConsent
	s.calls++
	s.scope, s.operation, s.target, s.consent = scope.UserID(), operation, target, consent
	return memory.RecallDiaryStarsResult{DiaryID: target, EpisodicMemoryIDs: []string{"memory"}}, s.err
}

func (s *paidStub) ViewSemantic(_ context.Context, scope platform.UserScope, operation, target string) (memory.ViewSemanticResult, error) {
	s.calls++
	s.scope, s.operation, s.target = scope.UserID(), operation, target
	return memory.ViewSemanticResult{Text: "gist", ReachedStage: 2}, s.err
}

func TestPaidHandlersForwardIdentityConsentAndCanonicalErrors(t *testing.T) {
	stub := &paidStub{}
	server, err := NewPaidServer(stub)
	if err != nil {
		t.Fatal(err)
	}
	_, handler := memoryv1connect.NewMemoryServiceHandler(server)
	host := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if user := r.Header.Get("X-Test-User"); user != "" {
			r = r.WithContext(platform.ContextWithUserID(r.Context(), user))
		}
		handler.ServeHTTP(w, r)
	}))
	t.Cleanup(host.Close)
	client := memoryv1connect.NewMemoryServiceClient(host.Client(), host.URL)
	req := connect.NewRequest(&memoryv1.RecallRequest{OperationId: "intent", MemoryId: "memory", RewriteText: "exact input", SyncConsent: true})
	_, err = client.Recall(context.Background(), req)
	if connect.CodeOf(err) != connect.CodeUnauthenticated || stub.calls != 0 {
		t.Fatalf("authentication: %v / %d", err, stub.calls)
	}
	req.Header().Set("X-Test-User", "owner")
	response, err := client.Recall(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if stub.scope != "owner" || stub.operation != "intent" || stub.target != "memory" || stub.rewrite != "exact input" || !stub.consent || response.Msg.Seed != 9007199254740993 {
		t.Fatalf("recall contract: %+v / %+v", stub, response.Msg)
	}
	diary := connect.NewRequest(&memoryv1.RecallDiaryStarsRequest{OperationId: "diary-intent", DiaryId: "entry", SyncConsent: false})
	diary.Header().Set("X-Test-User", "owner")
	_, err = client.RecallDiaryStars(context.Background(), diary)
	if err != nil || stub.operation != "diary-intent" || stub.target != "entry" || stub.consent {
		t.Fatalf("diary contract: %+v / %v", stub, err)
	}
	view := connect.NewRequest(&memoryv1.ViewSemanticRequest{OperationId: "gist-intent", EpisodicMemoryId: "memory"})
	view.Header().Set("X-Test-User", "owner")
	gist, err := client.ViewSemantic(context.Background(), view)
	if err != nil || stub.operation != "gist-intent" || gist.Msg.Text != "gist" || gist.Msg.ReachedStage != 2 {
		t.Fatalf("gist contract: %+v / %v", stub, err)
	}
	stub.err = memory.ErrSyncConsentRequired
	_, err = client.Recall(context.Background(), req)
	if connect.CodeOf(err) != connect.CodeFailedPrecondition {
		t.Fatalf("consent error: %v", err)
	}
	stub.err = memory.ErrOperationConflict
	_, err = client.Recall(context.Background(), req)
	if connect.CodeOf(err) != connect.CodeAlreadyExists {
		t.Fatalf("operation conflict: %v", err)
	}
}
