package memory

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

func testScope(t *testing.T) platform.UserScope {
	t.Helper()
	scope, err := platform.NewUserScope("user-1")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	return scope
}

func testDiaryDate() time.Time {
	return time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
}

// testDiaryBody is the body every encode test splits, and validSplit quotes it exactly: the
// source-text rule compares each passage against the body the use-case was handed, so a fixture
// that quoted nothing would fail every test for the wrong reason.
const testDiaryBody = "Morning market run for groceries. Lunch with Mina, catching up."

func validSplit() ExtractResult {
	return ExtractResult{Memories: []ExtractedMemory{
		{
			Name:       "Morning market run",
			Mood:       MoodJoy,
			SourceText: "Morning market run for groceries.",
			Neurons: []ExtractedNeuron{
				{Name: "grocery shopping", Type: NeuronTypeSemantic},
				{Name: "market", Type: NeuronTypeSpatial},
			},
		},
		{
			Name:       "Lunch with Mina",
			Mood:       MoodCalm,
			SourceText: "Lunch with Mina, catching up.",
			Neurons: []ExtractedNeuron{
				{Name: "catching up", Type: NeuronTypeSemantic},
				{Name: "Mina", Type: NeuronTypeEntity},
			},
		},
	}}
}

type fakeExtractor struct {
	splitResult  ExtractResult
	splitErr     error
	reviseQueue  []ExtractResult
	reviseErr    error
	splitCalls   int
	splitBody    string
	splitDate    time.Time
	splitNeurons []ExistingNeuron
	reviseBodies []string
	revisePriors []ExtractResult
	instructions []string
}

func (f *fakeExtractor) Split(_ context.Context, body string, diaryDate time.Time, existingNeurons []ExistingNeuron) (ExtractResult, error) {
	f.splitCalls++
	f.splitBody = body
	f.splitDate = diaryDate
	f.splitNeurons = append([]ExistingNeuron(nil), existingNeurons...)
	return f.splitResult, f.splitErr
}

func (f *fakeExtractor) ReviseSplit(_ context.Context, body string, prior ExtractResult, instruction string) (ExtractResult, error) {
	f.reviseBodies = append(f.reviseBodies, body)
	f.revisePriors = append(f.revisePriors, prior)
	f.instructions = append(f.instructions, instruction)
	if f.reviseErr != nil {
		return ExtractResult{}, f.reviseErr
	}
	if len(f.reviseQueue) == 0 {
		return prior, nil
	}
	next := f.reviseQueue[0]
	f.reviseQueue = f.reviseQueue[1:]
	return next, nil
}

type fakeCandidateRepo struct {
	inBody       []ExistingNeuron
	nearest      []ExistingNeuron
	gotBody      string
	gotBodyLimit int32
	gotVector    []float32
	gotMinSim    float64
	gotLimit     int32
}

func (f *fakeCandidateRepo) ListNeuronCandidatesInBody(_ context.Context, _ platform.UserScope, body string, limit int32) ([]ExistingNeuron, error) {
	f.gotBody = body
	f.gotBodyLimit = limit
	return f.inBody, nil
}

func (f *fakeCandidateRepo) ListNearestNeuronCandidates(_ context.Context, _ platform.UserScope, vector []float32, minSimilarity float64, limit int32) ([]ExistingNeuron, error) {
	f.gotVector = vector
	f.gotMinSim = minSimilarity
	f.gotLimit = limit
	return f.nearest, nil
}

type fakeUniverseReader struct {
	facts UniverseFacts
	err   error
}

func (f *fakeUniverseReader) GetUniverse(_ context.Context, _ platform.UserScope) (UniverseFacts, error) {
	return f.facts, f.err
}

type serviceFixture struct {
	extractor        *fakeExtractor
	embedder         *fakeEmbedder
	candidates       *fakeCandidateRepo
	launches         *fakeLaunchStore
	universe         *fakeUniverseReader
	linker           *fakeLinker
	progression      *fakeProgression
	spendGate        *fakeSpendGate
	earn             *fakeEarnPort
	signupSettlement *fakeSignupSettlement
	predictionError  *fakePredictionError
	gists            *fakeGistReader
	provenance       *fakeProvenanceReader
	exports          *fakeExportReader
	diaries          *fakeDiaryReader
	releases         *fakeReleaseRepo
	sealSuggester    *fakeSealSuggester
	service          *Service
	seeds            []int64
}

func newFixture(t *testing.T) *serviceFixture {
	t.Helper()
	launches := &fakeLaunchStore{}
	fixture := &serviceFixture{
		extractor:        &fakeExtractor{splitResult: validSplit()},
		embedder:         &fakeEmbedder{},
		candidates:       &fakeCandidateRepo{},
		launches:         launches,
		universe:         &fakeUniverseReader{},
		linker:           &fakeLinker{},
		progression:      &fakeProgression{store: launches},
		spendGate:        &fakeSpendGate{},
		earn:             &fakeEarnPort{},
		signupSettlement: &fakeSignupSettlement{launches: launches},
		predictionError:  &fakePredictionError{},
		gists:            &fakeGistReader{},
		provenance:       &fakeProvenanceReader{},
		exports:          &fakeExportReader{},
		diaries:          &fakeDiaryReader{},
		releases:         &fakeReleaseRepo{},
		sealSuggester:    &fakeSealSuggester{},
	}
	// The paid gist-view transaction reads gists through the launch store, delegating to the same
	// fakeGistReader the quote reads (one gist data source, as the single pg store is).
	launches.gistReader = fixture.gists
	ids := 0
	// NewSeed hands out fixture.seeds in order (default 42), so a reconsolidation's
	// reshape entropy is deterministic in tests.
	seedCalls := 0
	service, err := NewService(ServiceDeps{
		Extractor:        fixture.extractor,
		Embedder:         fixture.embedder,
		Candidates:       fixture.candidates,
		Launches:         fixture.launches,
		Universe:         fixture.universe,
		Linker:           fixture.linker,
		Progression:      fixture.progression,
		Recalls:          fixture.launches,
		SpendGate:        fixture.spendGate,
		Earn:             fixture.earn,
		SignupSettlement: fixture.signupSettlement,
		PredictionError:  fixture.predictionError,
		Gists:            fixture.gists,
		ViewSemantics:    fixture.launches,
		Signals:          fixture.launches,
		Provenance:       fixture.provenance,
		Exports:          fixture.exports,
		Diaries:          fixture.diaries,
		Releases:         fixture.releases,
		SealSuggester:    fixture.sealSuggester,
		Now:              func() time.Time { return time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC) },
		NewID: func() string {
			ids++
			return fmt.Sprintf("id-%d", ids)
		},
		NewSeed: func() int64 {
			seedCalls++
			if seedCalls <= len(fixture.seeds) {
				return fixture.seeds[seedCalls-1]
			}
			return 42
		},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	fixture.service = service
	return fixture
}

func TestNewServiceRejectsUnboundSignupSettlement(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	_, err := NewService(ServiceDeps{
		Extractor:       fixture.extractor,
		Embedder:        fixture.embedder,
		Candidates:      fixture.candidates,
		Launches:        fixture.launches,
		Universe:        fixture.universe,
		Linker:          fixture.linker,
		Progression:     fixture.progression,
		Recalls:         fixture.launches,
		SpendGate:       fixture.spendGate,
		Earn:            fixture.earn,
		PredictionError: fixture.predictionError,
		Gists:           fixture.gists,
		ViewSemantics:   fixture.launches,
		Signals:         fixture.launches,
		Provenance:      fixture.provenance,
		Exports:         fixture.exports,
		Diaries:         fixture.diaries,
		Releases:        fixture.releases,
		SealSuggester:   fixture.sealSuggester,
	})
	if !errors.Is(err, ErrSignupSettlementRequired) {
		t.Fatalf("NewService without signup settlement err = %v, want ErrSignupSettlementRequired", err)
	}
}

func TestEncodeReturnsValidSplitAndPersistsNothing(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.candidates.inBody = []ExistingNeuron{{ID: "n-1", Name: "market", Type: NeuronTypeSpatial}}
	fixture.candidates.nearest = []ExistingNeuron{
		{ID: "n-1", Name: "market", Type: NeuronTypeSpatial},
		{ID: "n-2", Name: "Mina", Type: NeuronTypeEntity},
	}
	fixture.embedder.vectors = [][]float32{{0.5, 0.5}}

	result, err := fixture.service.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
	if err != nil {
		t.Fatalf("Encode failed: %v", err)
	}
	if len(result.Memories) != 2 {
		t.Fatalf("memories = %d, want 2", len(result.Memories))
	}
	// The candidate set merges name-match + embedding assist, deduped by id.
	if len(fixture.extractor.splitNeurons) != 2 {
		t.Fatalf("existing neurons passed = %d, want 2 (deduped)", len(fixture.extractor.splitNeurons))
	}
	if fixture.candidates.gotMinSim != values.EncodeDedupSimilarityThreshold {
		t.Fatalf("min similarity = %v, want %v", fixture.candidates.gotMinSim, values.EncodeDedupSimilarityThreshold)
	}
	if fixture.candidates.gotLimit != values.EncodeDedupTopK {
		t.Fatalf("top-k = %d, want %d", fixture.candidates.gotLimit, values.EncodeDedupTopK)
	}
	// A9: previews persist nothing — no transaction ran, no rows, no jobs.
	if fixture.launches.txCount != 0 {
		t.Fatalf("launch tx ran %d times during preview, want 0", fixture.launches.txCount)
	}
}

func TestEncodeRepairsOutOfRangeCountWithoutClamping(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	tooMany := ExtractResult{}
	for i := 0; i < values.EncodeMaxMemories+1; i++ {
		tooMany.Memories = append(tooMany.Memories, ExtractedMemory{
			Name:       fmt.Sprintf("memory %d", i),
			Mood:       MoodJoy,
			SourceText: "Morning market run",
			Neurons:    []ExtractedNeuron{{Name: "concept", Type: NeuronTypeSemantic}},
		})
	}
	fixture.extractor.splitResult = tooMany
	fixture.extractor.reviseQueue = []ExtractResult{validSplit()}

	result, err := fixture.service.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
	if err != nil {
		t.Fatalf("Encode failed: %v", err)
	}
	if len(result.Memories) != 2 {
		t.Fatalf("memories = %d, want the repaired 2 — a clamp would have returned %d", len(result.Memories), values.EncodeMaxMemories)
	}
	if len(fixture.extractor.instructions) != 1 || !strings.Contains(fixture.extractor.instructions[0], "between") {
		t.Fatalf("expected one count repair instruction, got %q", fixture.extractor.instructions)
	}
}

func TestEncodeMissingSemanticNeuronIsRepairedNeverPlaceholder(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	missing := validSplit()
	missing.Memories[1].Neurons = []ExtractedNeuron{{Name: "Mina", Type: NeuronTypeEntity}}
	fixture.extractor.splitResult = missing
	repaired := validSplit()
	fixture.extractor.reviseQueue = []ExtractResult{repaired}

	result, err := fixture.service.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
	if err != nil {
		t.Fatalf("Encode failed: %v", err)
	}
	if !strings.Contains(fixture.extractor.instructions[0], "semantic") {
		t.Fatalf("repair instruction = %q, want a semantic-neuron re-prompt", fixture.extractor.instructions[0])
	}
	for _, extracted := range result.Memories {
		for _, neuron := range extracted.Neurons {
			if strings.TrimSpace(neuron.Name) == "" {
				t.Fatal("a hollow placeholder neuron was injected")
			}
		}
	}
}

func TestEncodeRetryBudgetExhaustedReturnsCanonicalError(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	single := ExtractResult{Memories: []ExtractedMemory{{
		Name:       "only one",
		Mood:       MoodJoy,
		SourceText: testDiaryBody,
		Neurons:    []ExtractedNeuron{{Name: "concept", Type: NeuronTypeSemantic}},
	}}}
	fixture.extractor.splitResult = single

	_, err := fixture.service.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
	if !errors.Is(err, ErrEncodeRetryExhausted) {
		t.Fatalf("err = %v, want ErrEncodeRetryExhausted", err)
	}
	if len(fixture.extractor.instructions) != values.EncodeMaxReviseRetries {
		t.Fatalf("repair attempts = %d, want %d", len(fixture.extractor.instructions), values.EncodeMaxReviseRetries)
	}
	if fixture.launches.txCount != 0 {
		t.Fatal("a failed preview must persist nothing")
	}
}

// A diary too long to be quoted back is refused on the way IN. Since each memory carries its own
// passage, the response holds the diary redistributed across the memories — so an over-long body
// is unfixable by re-prompting (a shorter split breaks coverage), and spending the repair budget
// discovering that would bill the writer three LLM calls to be told their entry is too long.
func TestEncodeRefusesADiaryTooLongToQuoteBeforeCallingTheExtractor(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	// Korean runes count one token each in the estimate, so the budget is reached in runes.
	tooLong := strings.Repeat("오늘은 아주 긴 하루였다. ", values.EncodeMaxOutputTokens)

	_, err := fixture.service.Encode(context.Background(), testScope(t), tooLong, testDiaryDate())
	if !errors.Is(err, ErrEncodeBodyTooLong) {
		t.Fatalf("err = %v, want ErrEncodeBodyTooLong", err)
	}
	if fixture.extractor.splitCalls != 0 {
		t.Fatalf("split calls = %d, want 0 — the writer is told before the LLM is billed", fixture.extractor.splitCalls)
	}

	// The same guard covers the revise entry point, which re-quotes from the same body.
	_, err = fixture.service.ReviseSplit(context.Background(), testScope(t), tooLong, validSplit(), "merge them")
	if !errors.Is(err, ErrEncodeBodyTooLong) {
		t.Fatalf("revise err = %v, want ErrEncodeBodyTooLong", err)
	}
	if len(fixture.extractor.instructions) != 0 {
		t.Fatalf("revise calls = %d, want 0", len(fixture.extractor.instructions))
	}

	// An ordinary diary is unaffected — the guard is a ceiling, not a new input rule.
	if err := bodyWithinOutputBudget(testDiaryBody); err != nil {
		t.Fatalf("an ordinary diary tripped the budget: %v", err)
	}
}

func TestEncodeRejectsInvalidNeuronTypeWithoutRetry(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	invalid := validSplit()
	invalid.Memories[0].Neurons[0].Type = NeuronType("temporal")
	fixture.extractor.splitResult = invalid

	_, err := fixture.service.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
	if !errors.Is(err, ErrEncodeInvalidSplit) {
		t.Fatalf("err = %v, want ErrEncodeInvalidSplit", err)
	}
	if len(fixture.extractor.instructions) != 0 {
		t.Fatal("an adapter contract breach must not be re-prompted")
	}
}

func TestEncodeRejectsUnknownMood(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	invalid := validSplit()
	invalid.Memories[0].Mood = Mood("EUPHORIA")
	fixture.extractor.splitResult = invalid

	_, err := fixture.service.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
	if !errors.Is(err, ErrEncodeInvalidSplit) {
		t.Fatalf("err = %v, want ErrEncodeInvalidSplit", err)
	}
}

func TestEncodeOversizedResultIsRepairable(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	oversized := validSplit()
	oversized.Memories[0].Name = strings.Repeat("경험", values.EncodeMaxOutputTokens)
	fixture.extractor.splitResult = oversized

	_, err := fixture.service.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
	if !errors.Is(err, ErrEncodeRetryExhausted) {
		t.Fatalf("err = %v, want ErrEncodeRetryExhausted after size repairs", err)
	}
	if !strings.Contains(fixture.extractor.instructions[0], "too large") {
		t.Fatalf("repair instruction = %q, want a size re-prompt", fixture.extractor.instructions[0])
	}
}

func TestEncodeRequiresInputAndScope(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	if _, err := fixture.service.Encode(context.Background(), testScope(t), "  ", testDiaryDate()); !errors.Is(err, ErrEncodeInputRequired) {
		t.Fatalf("empty body err = %v, want ErrEncodeInputRequired", err)
	}
	if _, err := fixture.service.Encode(context.Background(), testScope(t), "body", time.Time{}); !errors.Is(err, ErrEncodeInputRequired) {
		t.Fatalf("zero date err = %v, want ErrEncodeInputRequired", err)
	}
	if _, err := fixture.service.Encode(context.Background(), platform.UserScope{}, "body", testDiaryDate()); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("missing scope err = %v, want ErrScopeRequired", err)
	}
}

type failingEmbedder struct{}

func (failingEmbedder) Embed(_ context.Context, _ []string) ([][]float32, error) {
	return nil, errors.New("embedding provider throttled")
}

func TestEncodeDegradesToNameMatchWhenEmbedderFails(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.candidates.inBody = []ExistingNeuron{{ID: "n-1", Name: "market", Type: NeuronTypeSpatial}}
	service, err := NewService(ServiceDeps{
		Extractor:        fixture.extractor,
		Embedder:         failingEmbedder{},
		Candidates:       fixture.candidates,
		Launches:         fixture.launches,
		Universe:         fixture.universe,
		Linker:           fixture.linker,
		Progression:      fixture.progression,
		Recalls:          fixture.launches,
		SpendGate:        fixture.spendGate,
		Earn:             fixture.earn,
		SignupSettlement: NoSignupSettlement{},
		PredictionError:  fixture.predictionError,
		Gists:            fixture.gists,
		ViewSemantics:    fixture.launches,
		Signals:          fixture.launches,
		Provenance:       fixture.provenance,
		Exports:          fixture.exports,
		Diaries:          fixture.diaries,
		Releases:         fixture.releases,
		SealSuggester:    fixture.sealSuggester,
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}

	result, err := service.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
	if err != nil {
		t.Fatalf("Encode must degrade to name-match candidates, got: %v", err)
	}
	if len(result.Memories) != 2 {
		t.Fatalf("memories = %d, want 2", len(result.Memories))
	}
	if len(fixture.extractor.splitNeurons) != 1 {
		t.Fatalf("candidates = %d, want the 1 name-match candidate", len(fixture.extractor.splitNeurons))
	}
}

func TestReviseSplitValidatesPreviousAndRepairs(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	invalidPrevious := validSplit()
	invalidPrevious.Memories[0].Neurons[0].Type = NeuronType("time")
	if _, err := fixture.service.ReviseSplit(context.Background(), testScope(t), testDiaryBody, invalidPrevious, "merge them"); !errors.Is(err, ErrEncodeInputRequired) {
		t.Fatalf("invalid previous err = %v, want ErrEncodeInputRequired", err)
	}

	fixture = newFixture(t)
	fixture.extractor.reviseQueue = []ExtractResult{validSplit()}
	result, err := fixture.service.ReviseSplit(context.Background(), testScope(t), testDiaryBody, validSplit(), "merge the meeting and lunch")
	if err != nil {
		t.Fatalf("ReviseSplit failed: %v", err)
	}
	if len(result.Memories) != 2 {
		t.Fatalf("memories = %d, want 2", len(result.Memories))
	}
	if fixture.extractor.instructions[0] != "merge the meeting and lunch" {
		t.Fatalf("instruction = %q, want the user instruction first", fixture.extractor.instructions[0])
	}
	if fixture.extractor.splitCalls != 0 {
		t.Fatal("revise must reuse the revise variant, not re-split")
	}
	if _, err := fixture.service.ReviseSplit(context.Background(), testScope(t), testDiaryBody, validSplit(), "  "); !errors.Is(err, ErrEncodeInputRequired) {
		t.Fatalf("empty instruction err = %v, want ErrEncodeInputRequired", err)
	}
}
