package memory

import (
	"context"
	"errors"
	"fmt"
	"log"
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
	nearestErr   error
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
	return f.nearest, f.nearestErr
}

type fakeUniverseReader struct {
	facts UniverseFacts
	err   error
}

func (f *fakeUniverseReader) GetUniverse(_ context.Context, _ platform.UserScope) (UniverseFacts, error) {
	return f.facts, f.err
}

func (f *fakeUniverseReader) GetUniverseRevision(_ context.Context, _ platform.UserScope) (int64, error) {
	return f.facts.Revision, f.err
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
	achievements     *fakeAchievementRecorder
	signupSettlement *fakeSignupSettlement
	predictionError  *fakePredictionError
	gists            *fakeGistReader
	provenance       *fakeProvenanceReader
	exports          *fakeExportReader
	diaries          *fakeDiaryReader
	releases         *fakeReleaseRepo
	sealSuggester    *fakeSealSuggester
	encoding         *EncodingService
	launch           *LaunchService
	paid             *PaidActionService
	release          *ReleaseService
	reads            *ReadService
	signals          *SpendSignalService
	exportService    *ExportService
	seeds            []int64
}

// zoneOutsideTransactions answers UTC and fails the test when read while a fake transaction is open:
// the zone is not a transactional fact, and reading it through the pool inside a transaction would
// wait on a second connection (ARCH-9).
type zoneOutsideTransactions struct {
	t     *testing.T
	store *fakeLaunchStore
}

func (z zoneOutsideTransactions) ZoneFor(context.Context, platform.UserScope) (*time.Location, error) {
	if z.store.staging != nil {
		z.t.Errorf("user zone read inside an open memory transaction")
	}
	return time.UTC, nil
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
		achievements:     &fakeAchievementRecorder{},
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
	economy := &fakeEconomy{spend: fixture.spendGate, earn: fixture.earn, achievements: fixture.achievements}
	launches.economy = economy
	fixture.releases.economy = economy
	ids := 0
	// NewSeed hands out fixture.seeds in order (default 42), so a reconsolidation's
	// reshape entropy is deterministic in tests.
	seedCalls := 0
	zone := zoneOutsideTransactions{t: t, store: launches}
	now := func() time.Time { return time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC) }
	newID := func() string {
		ids++
		return fmt.Sprintf("id-%d", ids)
	}
	newSeed := func() int64 {
		seedCalls++
		if seedCalls <= len(fixture.seeds) {
			return fixture.seeds[seedCalls-1]
		}
		return 42
	}
	var err error
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatalf("memory service construction failed: %v", err)
		}
	}
	fixture.encoding, err = NewEncodingService(EncodingDeps{Extractor: fixture.extractor, Embedder: fixture.embedder, Candidates: fixture.candidates})
	must(err)
	fixture.launch, err = NewLaunchService(LaunchDeps{
		Launches:         fixture.launches,
		Linker:           fixture.linker,
		Progression:      fixture.progression,
		SignupSettlement: fixture.signupSettlement,
		UserZone:         zone,
		Now:              now,
		NewID:            newID,
		NewSeed:          newSeed,
	})
	must(err)
	fixture.paid, err = NewPaidActionService(PaidActionDeps{
		Recalls:         fixture.launches,
		ViewSemantics:   fixture.launches,
		PredictionError: fixture.predictionError,
		Progression:     fixture.progression,
		UserZone:        zone,
		Now:             now,
		NewID:           newID,
		NewSeed:         newSeed,
	})
	must(err)
	fixture.release, err = NewReleaseService(ReleaseDeps{Releases: fixture.releases, SealSuggester: fixture.sealSuggester, Now: now, NewID: newID})
	must(err)
	fixture.reads, err = NewReadService(ReadDeps{
		Universe:   fixture.universe,
		Provenance: fixture.provenance,
		Diaries:    fixture.diaries,
		Clock:      fixture.launches,
		UserZone:   zone,
		Now:        now,
	})
	must(err)
	fixture.signals, err = NewSpendSignalService(fixture.launches, fixture.gists, zone, now)
	must(err)
	fixture.exportService, err = NewExportService(fixture.exports)
	must(err)
	return fixture
}

func TestNewLaunchServiceRejectsUnboundSignupSettlement(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	_, err := NewLaunchService(LaunchDeps{
		Launches:    fixture.launches,
		Linker:      fixture.linker,
		Progression: fixture.progression,
	})
	if !errors.Is(err, ErrSignupSettlementRequired) {
		t.Fatalf("NewLaunchService without signup settlement err = %v, want ErrSignupSettlementRequired", err)
	}
}

type encodingFixture struct {
	extractor  *fakeExtractor
	embedder   *fakeEmbedder
	candidates *fakeCandidateRepo
	encoding   *EncodingService
}

func newEncodingFixture(t *testing.T) *encodingFixture {
	t.Helper()
	fixture := &encodingFixture{extractor: &fakeExtractor{splitResult: validSplit()}, embedder: &fakeEmbedder{}, candidates: &fakeCandidateRepo{}}
	var err error
	fixture.encoding, err = NewEncodingService(EncodingDeps{Extractor: fixture.extractor, Embedder: fixture.embedder, Candidates: fixture.candidates})
	if err != nil {
		t.Fatal(err)
	}
	return fixture
}

func TestEncodeReturnsValidSplitAndPersistsNothing(t *testing.T) {
	t.Parallel()
	fixture := newEncodingFixture(t)
	fixture.candidates.inBody = []ExistingNeuron{{ID: "n-1", Name: "market", Type: NeuronTypeSpatial}}
	fixture.candidates.nearest = []ExistingNeuron{
		{ID: "n-1", Name: "market", Type: NeuronTypeSpatial},
		{ID: "n-2", Name: "Mina", Type: NeuronTypeEntity},
	}
	fixture.embedder.vectors = [][]float32{{0.5, 0.5}}

	result, err := fixture.encoding.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
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
	// An ordinary diary reaches the extractor exactly once and its split is returned untouched: the
	// body budget is a ceiling on unfittable entries, never a cost on the common path.
	if fixture.extractor.splitCalls != 1 {
		t.Fatalf("split calls = %d, want exactly 1", fixture.extractor.splitCalls)
	}
	if len(fixture.extractor.instructions) != 0 {
		t.Fatalf("repair re-prompts = %d, want 0 for a valid split", len(fixture.extractor.instructions))
	}
}

func TestEncodeRepairsOutOfRangeCountWithoutClamping(t *testing.T) {
	t.Parallel()
	fixture := newEncodingFixture(t)
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

	result, err := fixture.encoding.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
	if err != nil {
		t.Fatalf("Encode failed: %v", err)
	}
	if len(result.Memories) != 2 {
		t.Fatalf("memories = %d, want the repaired 2 — a clamp would have returned %d", len(result.Memories), values.EncodeMaxMemories)
	}
	// The instruction has to name what came back and which way to move: an over-count is merged
	// down, an under-count is looked at again — one string for both told the model nothing.
	if len(fixture.extractor.instructions) != 1 ||
		!strings.Contains(fixture.extractor.instructions[0], "at most") ||
		!strings.Contains(fixture.extractor.instructions[0], fmt.Sprint(values.EncodeMaxMemories+1)) {
		t.Fatalf("expected one merge-down instruction naming the returned count, got %q", fixture.extractor.instructions)
	}
}

func TestEncodeMissingSemanticNeuronIsRepairedNeverPlaceholder(t *testing.T) {
	t.Parallel()
	fixture := newEncodingFixture(t)
	missing := validSplit()
	missing.Memories[1].Neurons = []ExtractedNeuron{{Name: "Mina", Type: NeuronTypeEntity}}
	fixture.extractor.splitResult = missing
	repaired := validSplit()
	fixture.extractor.reviseQueue = []ExtractResult{repaired}

	result, err := fixture.encoding.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
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

// A day that held one continuous event is one scene: [E2]'s 2–5 is the target the prompt asks for,
// and the prompt's own event-boundary rule forbids inventing a second scene to reach it. So the
// extractor is nudged once and then believed — the alternative is a legitimate diary that can never
// be encoded at all.
func TestEncodeAcceptsASingleSceneSplitAfterOneNudge(t *testing.T) {
	t.Parallel()
	fixture := newEncodingFixture(t)
	single := ExtractResult{Memories: []ExtractedMemory{{
		Name:       "only one",
		Mood:       MoodJoy,
		SourceText: testDiaryBody,
		Neurons:    []ExtractedNeuron{{Name: "concept", Type: NeuronTypeSemantic}},
	}}}
	fixture.extractor.splitResult = single
	fixture.extractor.reviseQueue = []ExtractResult{single}

	result, err := fixture.encoding.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
	if err != nil {
		t.Fatalf("Encode refused a single-scene diary: %v", err)
	}
	if len(result.Memories) != 1 {
		t.Fatalf("memories = %d, want the extractor's 1", len(result.Memories))
	}
	if len(fixture.extractor.instructions) != values.EncodeUnderCountNudges {
		t.Fatalf("nudges = %d, want %d", len(fixture.extractor.instructions), values.EncodeUnderCountNudges)
	}
	if !strings.Contains(fixture.extractor.instructions[0], "one continuous event") {
		t.Fatalf("nudge = %q, want it to allow one memory for one event", fixture.extractor.instructions[0])
	}
}

// Accepting the count is not accepting the split: the passages still have to be the writer's words,
// and an accepted count leaves the rest of the repair budget to get there.
func TestEncodeStillEnforcesTheOtherInvariantsOnAnAcceptedCount(t *testing.T) {
	t.Parallel()
	singleScene := func(mutate func(*ExtractedMemory)) ExtractResult {
		memory := ExtractedMemory{
			Name:       "only one",
			Mood:       MoodJoy,
			SourceText: testDiaryBody,
			Neurons:    []ExtractedNeuron{{Name: "concept", Type: NeuronTypeSemantic}},
		}
		mutate(&memory)
		return ExtractResult{Memories: []ExtractedMemory{memory}}
	}
	cases := map[string]struct {
		result ExtractResult
		want   ViolationKind
	}{
		"a word the writer never wrote": {
			singleScene(func(m *ExtractedMemory) { m.SourceText = testDiaryBody + " Then I flew to the moon." }),
			ViolationSourceTextNovelToken,
		},
		"half the diary left uncovered": {
			singleScene(func(m *ExtractedMemory) { m.SourceText = "Morning market run for groceries." }),
			ViolationSourceTextCoverage,
		},
		"no semantic neuron": {
			singleScene(func(m *ExtractedMemory) {
				m.Neurons = []ExtractedNeuron{{Name: "Mina", Type: NeuronTypeEntity}}
			}),
			ViolationSemanticNeuronMissing,
		},
	}
	for name, testCase := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			fixture := newEncodingFixture(t)
			fixture.extractor.splitResult = testCase.result

			_, err := fixture.encoding.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
			var exhausted *EncodeRetryExhausted
			if !errors.As(err, &exhausted) || exhausted.Kind != testCase.want {
				t.Fatalf("err = %v, want the %q give-up", err, testCase.want)
			}
			// The nudge draws on its own budget: the accepted count still leaves the whole repair
			// budget, so a single-scene diary gets no fewer attempts than a two-scene one.
			if len(fixture.extractor.instructions) != values.EncodeUnderCountNudges+values.EncodeMaxReviseRetries {
				t.Fatalf("re-prompts = %d, want %d nudge(s) plus the full repair budget of %d",
					len(fixture.extractor.instructions), values.EncodeUnderCountNudges, values.EncodeMaxReviseRetries)
			}
		})
	}
}

func TestEncodeRetryBudgetExhaustedReturnsCanonicalError(t *testing.T) {
	t.Parallel()
	fixture := newEncodingFixture(t)
	// A passage the writer never wrote is the unrepairable case that survives every re-prompt.
	invented := validSplit()
	invented.Memories[1].SourceText = "Lunch with Mina, catching up. Then I flew to the moon."
	fixture.extractor.splitResult = invented

	_, err := fixture.encoding.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
	if !errors.Is(err, ErrEncodeRetryExhausted) {
		t.Fatalf("err = %v, want ErrEncodeRetryExhausted", err)
	}
	// The give-up names WHICH invariant defeated it and nothing else: the instruction beside it
	// quotes the writer's passage, so it may never leave the process.
	var exhausted *EncodeRetryExhausted
	if !errors.As(err, &exhausted) || exhausted.Kind != ViolationSourceTextNovelToken {
		t.Fatalf("give-up = %v, want kind %q", err, ViolationSourceTextNovelToken)
	}
	if strings.Contains(err.Error(), "moon") || strings.Contains(err.Error(), "Mina") {
		t.Fatalf("give-up message carries the writer's words: %q", err.Error())
	}
	if len(fixture.extractor.instructions) != values.EncodeMaxReviseRetries {
		t.Fatalf("repair attempts = %d, want %d", len(fixture.extractor.instructions), values.EncodeMaxReviseRetries)
	}
}

// The count give-up carries the count, so an operator reading one report can tell a lazy split from
// a model that kept over-splitting — the shipped single string could not.
func TestEncodeCountGiveUpCarriesTheObservedCount(t *testing.T) {
	t.Parallel()
	fixture := newEncodingFixture(t)
	tooMany := ExtractResult{}
	for i := 0; i < values.EncodeMaxMemories+2; i++ {
		tooMany.Memories = append(tooMany.Memories, ExtractedMemory{
			Name:       fmt.Sprintf("memory %d", i),
			Mood:       MoodJoy,
			SourceText: "Morning market run",
			Neurons:    []ExtractedNeuron{{Name: "concept", Type: NeuronTypeSemantic}},
		})
	}
	fixture.extractor.splitResult = tooMany

	_, err := fixture.encoding.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
	var exhausted *EncodeRetryExhausted
	if !errors.As(err, &exhausted) {
		t.Fatalf("err = %v, want EncodeRetryExhausted", err)
	}
	if exhausted.Kind != ViolationCountOver || exhausted.MemoryCount != values.EncodeMaxMemories+2 {
		t.Fatalf("give-up = %+v, want count_over with the returned count", exhausted)
	}
	if exhausted.Detail()["violation_kind"] != string(ViolationCountOver) ||
		exhausted.Detail()["memories"] != fmt.Sprint(values.EncodeMaxMemories+2) {
		t.Fatalf("detail = %v, want the kind and the count as the metadata channel carries them", exhausted.Detail())
	}
	// An over-count is repairable by merging, so it spends the whole repair budget and is never
	// accepted out of range — only the below-target direction is soft.
	if len(fixture.extractor.instructions) != values.EncodeMaxReviseRetries {
		t.Fatalf("merge re-prompts = %d, want the full budget of %d",
			len(fixture.extractor.instructions), values.EncodeMaxReviseRetries)
	}
	for _, instruction := range fixture.extractor.instructions {
		if strings.Contains(instruction, "fewer than") {
			t.Fatalf("over-count was told the under-count instruction: %q", instruction)
		}
	}
}

// A diary too long to be quoted back is refused on the way IN. Since each memory carries its own
// passage, the response holds the diary redistributed across the memories — so an over-long body
// is unfixable by re-prompting (a shorter split breaks coverage), and spending the repair budget
// discovering that would bill the writer three LLM calls to be told their entry is too long.
func TestEncodeRefusesADiaryTooLongToQuoteBeforeCallingTheExtractor(t *testing.T) {
	t.Parallel()
	fixture := newEncodingFixture(t)
	// Korean runes count one token each in the estimate, so the budget is reached in runes.
	tooLong := strings.Repeat("오늘은 아주 긴 하루였다. ", values.EncodeMaxOutputTokens)

	_, err := fixture.encoding.Encode(context.Background(), testScope(t), tooLong, testDiaryDate())
	if !errors.Is(err, ErrEncodeBodyTooLong) {
		t.Fatalf("err = %v, want ErrEncodeBodyTooLong", err)
	}
	if fixture.extractor.splitCalls != 0 {
		t.Fatalf("split calls = %d, want 0 — the writer is told before the LLM is billed", fixture.extractor.splitCalls)
	}

	// The same guard covers the revise entry point, which re-quotes from the same body.
	_, err = fixture.encoding.ReviseSplit(context.Background(), testScope(t), tooLong, validSplit(), "merge them")
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

// The guard's whole point: there must be no body it admits that a LEGAL split then overflows.
// Measuring the body alone satisfies neither half — it admitted diaries for which even the cheapest
// admissible split was over budget, so the repair loop spent every re-prompt on a violation the
// model could not fix and returned the give-up error instead of this one.
//
// Driven off the generated values rather than a pinned rune count, so retuning max_memories,
// min_semantic_neurons or max_output_tokens re-derives the bound instead of pinning a stale one.
func TestBodyBudgetLeavesRoomForEveryAdmissibleSplit(t *testing.T) {
	t.Parallel()
	// The largest Korean body the guard admits: one rune per token in the estimate, so a binary
	// search over rune counts lands exactly on the boundary.
	low, high := 1, values.EncodeMaxOutputTokens*2
	for low < high {
		mid := (low + high + 1) / 2
		if bodyWithinOutputBudget(strings.Repeat("가", mid)) == nil {
			low = mid
		} else {
			high = mid - 1
		}
	}
	largest := strings.Repeat("가", low)
	if err := bodyWithinOutputBudget(largest); err != nil {
		t.Fatalf("binary search landed outside the admitted range: %v", err)
	}
	if bodyWithinOutputBudget(strings.Repeat("가", low+1)) == nil {
		t.Fatal("binary search did not land on the boundary")
	}

	// That body, split the cheapest legal way, must still fit the budget the output guard enforces.
	estimate := estimateOutputTokens(minimumAdmissibleSplit(largest))
	if estimate > values.EncodeMaxOutputTokens {
		t.Fatalf("the largest admitted body (%d runes) needs %d tokens as its cheapest legal split, over the %d budget",
			low, estimate, values.EncodeMaxOutputTokens)
	}

	// And the reservation is priced from the enums, not a literal: the costliest mood and neuron type
	// the model may pick are the ones the guard assumed.
	split := minimumAdmissibleSplit(largest)
	if len(split.Memories) != values.EncodeMaxMemories {
		t.Fatalf("reserved for %d memories, want the admissible maximum of %d",
			len(split.Memories), values.EncodeMaxMemories)
	}
	for _, mood := range AllMoods() {
		if len(mood) > len(split.Memories[0].Mood) {
			t.Fatalf("mood %q costs more than the reserved %q", mood, split.Memories[0].Mood)
		}
	}
	for _, neuronType := range AllNeuronTypes() {
		if len(neuronType) > len(split.Memories[0].Neurons[0].Type) {
			t.Fatalf("neuron type %q costs more than the reserved %q", neuronType, split.Memories[0].Neurons[0].Type)
		}
	}
	// A legal split must always carry the required neurons, or the reservation is a fiction.
	if !hasRequiredSemanticNeurons(split.Memories[0]) {
		t.Fatal("the reserved split does not itself satisfy the semantic-neuron rule")
	}
	if err := validateSplitStructure(split); err != nil {
		t.Fatalf("the reserved split is not structurally admissible: %v", err)
	}
}

// The band the old guard let through: long enough that no legal split fits, short enough that
// measuring the passages alone said yes. Those bodies now get the actionable error, before the
// extractor is billed — not EncodeRetryExhausted after three re-prompts that cannot help.
func TestEncodeRefusesABodyNoLegalSplitCouldFit(t *testing.T) {
	t.Parallel()
	fixture := newEncodingFixture(t)
	// Inside the band by construction: the passages alone fit, the cheapest legal split does not.
	body := ""
	for runes := values.EncodeMaxOutputTokens; runes > 0; runes-- {
		candidate := strings.Repeat("가", runes)
		passagesOnly := estimateOutputTokens(ExtractResult{Memories: []ExtractedMemory{{SourceText: candidate}}})
		if passagesOnly <= values.EncodeMaxOutputTokens {
			body = candidate
			break
		}
	}
	if body == "" {
		t.Fatal("could not construct a body whose passages alone fit")
	}
	if estimateOutputTokens(minimumAdmissibleSplit(body)) <= values.EncodeMaxOutputTokens {
		t.Skip("no trap band at the current tuning — the structural reservation is smaller than one rune")
	}

	_, err := fixture.encoding.Encode(context.Background(), testScope(t), body, testDiaryDate())
	if !errors.Is(err, ErrEncodeBodyTooLong) {
		t.Fatalf("err = %v, want ErrEncodeBodyTooLong", err)
	}
	if errors.Is(err, ErrEncodeRetryExhausted) {
		t.Fatal("the writer was told the split failed, not that the entry is too long")
	}
	if fixture.extractor.splitCalls != 0 {
		t.Fatalf("split calls = %d, want 0 — no LLM call is billed to learn the entry is too long",
			fixture.extractor.splitCalls)
	}
	if len(fixture.extractor.instructions) != 0 {
		t.Fatalf("repair re-prompts = %d, want 0", len(fixture.extractor.instructions))
	}
}

func TestEncodeRejectsInvalidNeuronTypeWithoutRetry(t *testing.T) {
	t.Parallel()
	fixture := newEncodingFixture(t)
	invalid := validSplit()
	invalid.Memories[0].Neurons[0].Type = NeuronType("temporal")
	fixture.extractor.splitResult = invalid

	_, err := fixture.encoding.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
	if !errors.Is(err, ErrEncodeInvalidSplit) {
		t.Fatalf("err = %v, want ErrEncodeInvalidSplit", err)
	}
	if len(fixture.extractor.instructions) != 0 {
		t.Fatal("an adapter contract breach must not be re-prompted")
	}
}

func TestEncodeRejectsUnknownMood(t *testing.T) {
	t.Parallel()
	fixture := newEncodingFixture(t)
	invalid := validSplit()
	invalid.Memories[0].Mood = Mood("EUPHORIA")
	fixture.extractor.splitResult = invalid

	_, err := fixture.encoding.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
	if !errors.Is(err, ErrEncodeInvalidSplit) {
		t.Fatalf("err = %v, want ErrEncodeInvalidSplit", err)
	}
}

func TestEncodeOversizedResultIsRepairable(t *testing.T) {
	t.Parallel()
	fixture := newEncodingFixture(t)
	oversized := validSplit()
	oversized.Memories[0].Name = strings.Repeat("경험", values.EncodeMaxOutputTokens)
	fixture.extractor.splitResult = oversized

	_, err := fixture.encoding.Encode(context.Background(), testScope(t), testDiaryBody, testDiaryDate())
	if !errors.Is(err, ErrEncodeRetryExhausted) {
		t.Fatalf("err = %v, want ErrEncodeRetryExhausted after size repairs", err)
	}
	if !strings.Contains(fixture.extractor.instructions[0], "too large") {
		t.Fatalf("repair instruction = %q, want a size re-prompt", fixture.extractor.instructions[0])
	}
}

func TestEncodeRequiresInputAndScope(t *testing.T) {
	t.Parallel()
	fixture := newEncodingFixture(t)
	if _, err := fixture.encoding.Encode(context.Background(), testScope(t), "  ", testDiaryDate()); !errors.Is(err, ErrEncodeInputRequired) {
		t.Fatalf("empty body err = %v, want ErrEncodeInputRequired", err)
	}
	if _, err := fixture.encoding.Encode(context.Background(), testScope(t), "body", time.Time{}); !errors.Is(err, ErrEncodeInputRequired) {
		t.Fatalf("zero date err = %v, want ErrEncodeInputRequired", err)
	}
	if _, err := fixture.encoding.Encode(context.Background(), platform.UserScope{}, "body", testDiaryDate()); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("missing scope err = %v, want ErrScopeRequired", err)
	}
}

type failingEmbedder struct{}

func (failingEmbedder) Embed(_ context.Context, _ []string) ([][]float32, error) {
	return nil, errors.New("embedding provider throttled")
}

func TestEncodeDegradesToNameMatchWhenEmbedderFails(t *testing.T) {
	t.Parallel()
	fixture := newEncodingFixture(t)
	fixture.candidates.inBody = []ExistingNeuron{{ID: "n-1", Name: "market", Type: NeuronTypeSpatial}}
	service, err := NewEncodingService(EncodingDeps{
		Extractor: fixture.extractor, Embedder: failingEmbedder{}, Candidates: fixture.candidates,
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
	fixture := newEncodingFixture(t)
	invalidPrevious := validSplit()
	invalidPrevious.Memories[0].Neurons[0].Type = NeuronType("time")
	if _, err := fixture.encoding.ReviseSplit(context.Background(), testScope(t), testDiaryBody, invalidPrevious, "merge them"); !errors.Is(err, ErrEncodeInputRequired) {
		t.Fatalf("invalid previous err = %v, want ErrEncodeInputRequired", err)
	}

	fixture = newEncodingFixture(t)
	fixture.extractor.reviseQueue = []ExtractResult{validSplit()}
	result, err := fixture.encoding.ReviseSplit(context.Background(), testScope(t), testDiaryBody, validSplit(), "merge the meeting and lunch")
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
	if _, err := fixture.encoding.ReviseSplit(context.Background(), testScope(t), testDiaryBody, validSplit(), "  "); !errors.Is(err, ErrEncodeInputRequired) {
		t.Fatalf("empty instruction err = %v, want ErrEncodeInputRequired", err)
	}
}

// A failed nearest-neuron read degrades the candidates to name matches without failing the preview,
// and is logged with the request id so the weaker dedup is visible.
func TestDedupAssistFailureIsLoggedWithTheRequestID(t *testing.T) {
	t.Parallel()
	var logged strings.Builder
	candidates := &fakeCandidateRepo{
		inBody:     []ExistingNeuron{{ID: "n-body", Name: "harbor", Type: NeuronTypeSpatial}},
		nearest:    []ExistingNeuron{{ID: "n-near", Name: "boats", Type: NeuronTypeSemantic}},
		nearestErr: errors.New("nearest read failed"),
	}
	service, err := NewEncodingService(EncodingDeps{
		Extractor: &fakeExtractor{}, Embedder: &fakeEmbedder{vectors: [][]float32{{1}}}, Candidates: candidates,
		Logger: log.New(&logged, "", 0),
	})
	if err != nil {
		t.Fatalf("NewEncodingService failed: %v", err)
	}
	ctx := platform.ContextWithRequestID(context.Background(), "req-dedup")
	merged, err := service.dedupCandidates(ctx, testScope(t), "the harbor at dusk")
	if err != nil {
		t.Fatalf("dedupCandidates failed: %v", err)
	}
	if len(merged) != 1 || merged[0].ID != "n-body" {
		t.Fatalf("candidates = %+v, want the name matches only", merged)
	}
	if !strings.Contains(logged.String(), "request_id=req-dedup") || !strings.Contains(logged.String(), "nearest read failed") {
		t.Fatalf("log = %q, want the request id and the cause", logged.String())
	}
}
