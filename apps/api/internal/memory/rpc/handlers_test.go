package rpc

import (
	"bytes"
	"context"
	"errors"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"connectrpc.com/connect"

	memoryv1 "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1"
	memoryv1connect "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1/memoryv1connect"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/apperr"
	"github.com/cosimosi/api/internal/platform/observability"
	"github.com/cosimosi/api/internal/platform/rpctest"
)

// stubGroups implements every non-paid handler group and records what each handler forwarded.
type stubGroups struct {
	userIDs   []string
	body      string
	diaryDate time.Time
	confirmed int
	id        string
	words     string
	approved  []string
	query     memory.DiaryQuery
	err       error
}

func (s *stubGroups) seen(scope platform.UserScope) { s.userIDs = append(s.userIDs, scope.UserID()) }

func (s *stubGroups) Encode(_ context.Context, scope platform.UserScope, body string, diaryDate time.Time) (memory.ExtractResult, error) {
	s.seen(scope)
	s.body, s.diaryDate = body, diaryDate
	return memory.ExtractResult{}, s.err
}
func (s *stubGroups) ReviseSplit(_ context.Context, scope platform.UserScope, body string, _ memory.ExtractResult, instruction string) (memory.ExtractResult, error) {
	s.seen(scope)
	s.body, s.words = body, instruction
	return memory.ExtractResult{}, s.err
}
func (s *stubGroups) PersistEncoded(_ context.Context, scope platform.UserScope, body string, diaryDate time.Time, confirmed []memory.ExtractedMemory) (memory.LaunchResult, error) {
	s.seen(scope)
	s.body, s.diaryDate, s.confirmed = body, diaryDate, len(confirmed)
	return memory.LaunchResult{}, s.err
}
func (s *stubGroups) Release(_ context.Context, scope platform.UserScope, diaryID string) (memory.ReleaseResult, error) {
	s.seen(scope)
	s.id = diaryID
	return memory.ReleaseResult{}, s.err
}
func (s *stubGroups) Restore(_ context.Context, scope platform.UserScope, diaryID string) (memory.RestoreResult, error) {
	s.seen(scope)
	s.id = diaryID
	return memory.RestoreResult{}, s.err
}
func (s *stubGroups) SuggestLetGo(_ context.Context, scope platform.UserScope, memoryID string, words string) (memory.SuggestLetGoResult, error) {
	s.seen(scope)
	s.id, s.words = memoryID, words
	return memory.SuggestLetGoResult{}, s.err
}
func (s *stubGroups) LetGo(_ context.Context, scope platform.UserScope, memoryID string, approved []string) (memory.LetGoResult, error) {
	s.seen(scope)
	s.id, s.approved = memoryID, approved
	return memory.LetGoResult{}, s.err
}
func (s *stubGroups) Universe(_ context.Context, scope platform.UserScope) (memory.UniverseFacts, *time.Time, error) {
	s.seen(scope)
	return memory.UniverseFacts{}, nil, s.err
}
func (s *stubGroups) UniverseRevision(_ context.Context, scope platform.UserScope) (int64, error) {
	s.seen(scope)
	return 0, s.err
}
func (s *stubGroups) SyncStatus(_ context.Context, scope platform.UserScope) (memory.SyncStatus, error) {
	s.seen(scope)
	return memory.SyncStatus{}, s.err
}
func (s *stubGroups) GetProvenance(_ context.Context, scope platform.UserScope, memoryID string) ([]memory.ProvenanceEntry, error) {
	s.seen(scope)
	s.id = memoryID
	return nil, s.err
}
func (s *stubGroups) GetDiaries(_ context.Context, scope platform.UserScope, query memory.DiaryQuery) (memory.DiaryPage, error) {
	s.seen(scope)
	s.query = query
	return memory.DiaryPage{}, s.err
}
func (s *stubGroups) GetDiaryCalendar(_ context.Context, scope platform.UserScope, _ memory.DiaryCalendarQuery) (memory.DiaryCalendarPage, error) {
	s.seen(scope)
	return memory.DiaryCalendarPage{}, s.err
}

type unusedPaid struct{ PaidUseCases }
type unusedExport struct{ ExportUseCase }

func newGroupServer(t *testing.T, stub *stubGroups) *Server {
	t.Helper()
	server, err := NewServer(Services{
		Encoding: stub, Launches: stub, Releases: stub, Reads: stub,
		Paid: unusedPaid{}, Exports: unusedExport{},
	})
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}
	return server
}

func memoryHandlers(server *Server) []rpctest.Handler {
	h := func(name string, fn func(context.Context) error) rpctest.Handler {
		return rpctest.Handler{Name: name, Call: fn}
	}
	return []rpctest.Handler{
		h("SplitDiary", func(ctx context.Context) error {
			_, err := server.SplitDiary(ctx, connect.NewRequest(&memoryv1.SplitDiaryRequest{Body: "a day", DiaryDate: "2026-07-02"}))
			return err
		}),
		h("ReviseSplit", func(ctx context.Context) error {
			_, err := server.ReviseSplit(ctx, connect.NewRequest(&memoryv1.ReviseSplitRequest{Body: "a day", Instruction: "merge"}))
			return err
		}),
		h("LaunchStars", func(ctx context.Context) error {
			_, err := server.LaunchStars(ctx, connect.NewRequest(&memoryv1.LaunchStarsRequest{
				Body: "a day", DiaryDate: "2026-07-02", Memories: []*memoryv1.ConfirmedMemory{{SourceText: "a day"}},
			}))
			return err
		}),
		h("GetUniverse", func(ctx context.Context) error {
			_, err := server.GetUniverse(ctx, connect.NewRequest(&memoryv1.GetUniverseRequest{}))
			return err
		}),
		h("GetUniverseRevision", func(ctx context.Context) error {
			_, err := server.GetUniverseRevision(ctx, connect.NewRequest(&memoryv1.GetUniverseRevisionRequest{}))
			return err
		}),
		h("SyncStatus", func(ctx context.Context) error {
			_, err := server.SyncStatus(ctx, connect.NewRequest(&memoryv1.SyncStatusRequest{}))
			return err
		}),
		h("GetProvenance", func(ctx context.Context) error {
			_, err := server.GetProvenance(ctx, connect.NewRequest(&memoryv1.GetProvenanceRequest{EpisodicMemoryId: "m-1"}))
			return err
		}),
		h("GetDiaries", func(ctx context.Context) error {
			_, err := server.GetDiaries(ctx, connect.NewRequest(&memoryv1.GetDiariesRequest{Query: "sea", PageSize: 5}))
			return err
		}),
		h("GetDiaryCalendar", func(ctx context.Context) error {
			_, err := server.GetDiaryCalendar(ctx, connect.NewRequest(&memoryv1.GetDiaryCalendarRequest{From: "2026-07-01", To: "2026-07-31"}))
			return err
		}),
		h("Release", func(ctx context.Context) error {
			_, err := server.Release(ctx, connect.NewRequest(&memoryv1.ReleaseRequest{DiaryId: "d-1"}))
			return err
		}),
		h("Restore", func(ctx context.Context) error {
			_, err := server.Restore(ctx, connect.NewRequest(&memoryv1.RestoreRequest{DiaryId: "d-1"}))
			return err
		}),
		h("SuggestLetGo", func(ctx context.Context) error {
			_, err := server.SuggestLetGo(ctx, connect.NewRequest(&memoryv1.SuggestLetGoRequest{EpisodicMemoryId: "m-1", Words: "let it rest"}))
			return err
		}),
		h("LetGo", func(ctx context.Context) error {
			_, err := server.LetGo(ctx, connect.NewRequest(&memoryv1.LetGoRequest{EpisodicMemoryId: "m-1", ApprovedNeuronIds: []string{"n-1"}}))
			return err
		}),
	}
}

func TestGroupHandlersForwardScopeAndInputs(t *testing.T) {
	t.Parallel()
	for _, handler := range memoryHandlers(newGroupServer(t, &stubGroups{})) {
		stub := &stubGroups{}
		server := newGroupServer(t, stub)
		var call func(context.Context) error
		for _, candidate := range memoryHandlers(server) {
			if candidate.Name == handler.Name {
				call = candidate.Call
			}
		}
		if err := call(rpctest.UserContext()); err != nil {
			t.Fatalf("%s failed: %v", handler.Name, err)
		}
		if len(stub.userIDs) != 1 || stub.userIDs[0] != rpctest.UserID {
			t.Fatalf("%s forwarded scopes %v, want the caller once", handler.Name, stub.userIDs)
		}
		switch handler.Name {
		case "SplitDiary", "LaunchStars":
			if stub.body != "a day" || stub.diaryDate.Format(time.DateOnly) != "2026-07-02" {
				t.Fatalf("%s forwarded %q/%v", handler.Name, stub.body, stub.diaryDate)
			}
		case "GetProvenance", "SuggestLetGo", "LetGo":
			if stub.id != "m-1" {
				t.Fatalf("%s forwarded memory %q", handler.Name, stub.id)
			}
		case "Release", "Restore":
			if stub.id != "d-1" {
				t.Fatalf("%s forwarded diary %q", handler.Name, stub.id)
			}
		case "GetDiaries":
			if stub.query.PageSize != 5 {
				t.Fatalf("GetDiaries forwarded %+v", stub.query)
			}
		}
		if handler.Name == "LaunchStars" && stub.confirmed != 1 {
			t.Fatalf("LaunchStars forwarded %d memories, want 1", stub.confirmed)
		}
		if handler.Name == "LetGo" && (len(stub.approved) != 1 || stub.approved[0] != "n-1") {
			t.Fatalf("LetGo forwarded approvals %v", stub.approved)
		}
	}
	rpctest.RequireUnauthenticatedWithoutScope(t, memoryHandlers(newGroupServer(t, &stubGroups{})))
}

func TestGroupHandlersMapUseCaseRefusals(t *testing.T) {
	t.Parallel()
	server := newGroupServer(t, &stubGroups{err: memory.ErrRecallMemoryNotFound})
	for _, handler := range memoryHandlers(server) {
		rpctest.RequireCode(t, handler.Call(rpctest.UserContext()), connect.CodeNotFound)
	}
}

// revisionBoundaryDeps refuses any assist that ReviseSplit should never use.
type revisionBoundaryDeps struct {
	revisions  atomic.Int64
	unexpected atomic.Int64
}

func (d *revisionBoundaryDeps) Split(context.Context, string, time.Time, []memory.ExistingNeuron) (memory.ExtractResult, error) {
	d.unexpected.Add(1)
	return memory.ExtractResult{}, errors.New("unexpected split")
}
func (d *revisionBoundaryDeps) ReviseSplit(_ context.Context, _ string, previous memory.ExtractResult, _ string) (memory.ExtractResult, error) {
	d.revisions.Add(1)
	return previous, nil
}
func (d *revisionBoundaryDeps) Embed(context.Context, []string) ([][]float32, error) {
	d.unexpected.Add(1)
	return nil, errors.New("unexpected embedding")
}
func (d *revisionBoundaryDeps) ListNeuronCandidatesInBody(context.Context, platform.UserScope, string, int32) ([]memory.ExistingNeuron, error) {
	d.unexpected.Add(1)
	return nil, errors.New("unexpected candidate read")
}
func (d *revisionBoundaryDeps) ListNearestNeuronCandidates(context.Context, platform.UserScope, []float32, float64, int32) ([]memory.ExistingNeuron, error) {
	d.unexpected.Add(1)
	return nil, errors.New("unexpected nearest read")
}

type revisionLiveAccount struct{ reads *atomic.Int64 }

func (s revisionLiveAccount) AccountStatus(context.Context, string) (platform.AccountStatus, error) {
	s.reads.Add(1)
	return platform.AccountStatus{}, nil
}

func TestReviseSplitRefusalsKeepPrivateNameOutOfWireAndLog(t *testing.T) {
	const privateName = "PRIVATE_MEMORY_NAME_261108"
	const body = "Morning market run for groceries. Lunch with Mina, catching up."
	for _, kind := range []string{"invalid_previous", "empty_body", "valid_previous"} {
		t.Run(kind, func(t *testing.T) {
			var logs bytes.Buffer
			reporter := observability.NewInMemoryReporter()
			deps := &revisionBoundaryDeps{}
			encoding, err := memory.NewEncodingService(memory.EncodingDeps{Extractor: deps, Embedder: deps, Candidates: deps, Logger: log.New(&logs, "", 0)})
			if err != nil {
				t.Fatal(err)
			}
			unrelated := &stubGroups{}
			service, err := NewServer(Services{Encoding: encoding, Launches: unrelated, Releases: unrelated, Reads: unrelated, Paid: unusedPaid{}, Exports: unusedExport{}})
			if err != nil {
				t.Fatal(err)
			}
			var auth, admission atomic.Int64
			handler := platform.NewHandler(log.New(&logs, "", 0),
				platform.WithAuthVerifier(platform.AuthTokenVerifierFunc(func(context.Context, string) (platform.UserIdentity, error) {
					auth.Add(1)
					return platform.UserIdentity{UserID: "synthetic-revision-user"}, nil
				})),
				platform.WithAccountStatusReader(revisionLiveAccount{reads: &admission}),
				platform.WithObservabilityReporter(reporter),
				platform.WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
					return memoryv1connect.NewMemoryServiceHandler(service, opts...)
				}),
			)
			server := httptest.NewServer(handler)
			httpClient := server.Client()
			httpClient.Timeout = 2 * time.Second
			t.Cleanup(func() { server.CloseClientConnections(); server.Close(); httpClient.CloseIdleConnections() })
			previous := &memoryv1.SplitDiaryResponse{Memories: []*memoryv1.ProposedMemory{
				{Name: privateName, Mood: "JOY", SourceText: "Morning market run for groceries.", Neurons: []*memoryv1.ProposedNeuron{{Name: "grocery shopping", Type: "semantic"}}},
				{Name: "Second synthetic memory", Mood: "CALM", SourceText: "Lunch with Mina, catching up.", Neurons: []*memoryv1.ProposedNeuron{{Name: "catching up", Type: "semantic"}}},
			}}
			requestBody := body
			if kind == "invalid_previous" {
				previous.Memories[0].SourceText = ""
			}
			if kind == "empty_body" {
				requestBody = ""
			}
			requestID := "revision-boundary-" + kind
			request := connect.NewRequest(&memoryv1.ReviseSplitRequest{Body: requestBody, Previous: previous, Instruction: "merge these synthetic scenes"})
			request.Header().Set("Authorization", "Bearer synthetic-token")
			request.Header().Set("X-Request-Id", requestID)
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			response, callErr := memoryv1connect.NewMemoryServiceClient(httpClient, server.URL).ReviseSplit(ctx, request)
			if auth.Load() != 1 || admission.Load() != 1 || deps.unexpected.Load() != 0 || len(unrelated.userIDs) != 0 {
				t.Fatalf("boundary calls: auth=%d admission=%d unexpected=%d unrelated=%d", auth.Load(), admission.Load(), deps.unexpected.Load(), len(unrelated.userIDs))
			}
			if len(reporter.Events()) != 0 {
				t.Fatal("ordinary revision reported an unexpected event")
			}
			if kind == "valid_previous" {
				if callErr != nil {
					t.Fatal(callErr)
				}
				if deps.revisions.Load() != 1 || len(response.Msg.GetMemories()) != 2 || response.Msg.GetMemories()[0].GetName() != privateName || response.Header().Get("X-Request-Id") != requestID {
					t.Fatal("valid revision changed its result, request id or extractor calls")
				}
			} else {
				if callErr == nil || connect.CodeOf(callErr) != connect.CodeInvalidArgument || deps.revisions.Load() != 0 {
					t.Fatalf("refusal = %v, extractor calls=%d", callErr, deps.revisions.Load())
				}
				info, ok := apperr.Info(callErr)
				if !ok || info.GetReason() != reasonEncodeInputRequired || info.GetDomain() != "memory" || info.GetRequestId() != requestID || len(info.GetMetadata()) != 0 || info.GetDebugDetail() != "" {
					t.Fatalf("refusal detail = %v", info)
				}
				if strings.Contains(callErr.Error(), privateName) {
					t.Error("refusal echoed the private previous memory Name")
				}
			}
			if !strings.Contains(logs.String(), memoryv1connect.MemoryServiceReviseSplitProcedure) || !strings.Contains(logs.String(), requestID) {
				t.Fatal("actual platform log lacks method or request id")
			}
			if strings.Contains(logs.String(), privateName) {
				t.Error("platform log contains the private previous memory Name")
			}
		})
	}
}
