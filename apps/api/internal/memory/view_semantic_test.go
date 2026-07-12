package memory

import (
	"context"
	"errors"
	"testing"

	"github.com/cosimosi/api/internal/platform"
)

// fakeGistReader serves MemoryGist fixtures; an unknown id mirrors the pg concrete's
// canonical not-found (another user's row and a missing row are indistinguishable, §4).
type fakeGistReader struct {
	gists map[string]MemoryGist
	calls []string
}

func (f *fakeGistReader) EpisodicMemoryGist(_ context.Context, scope platform.UserScope, memoryID string) (MemoryGist, error) {
	if scope.UserID() == "" {
		return MemoryGist{}, errors.New("scope missing")
	}
	f.calls = append(f.calls, memoryID)
	gist, ok := f.gists[memoryID]
	if !ok {
		return MemoryGist{}, ErrViewSemanticMemoryNotFound
	}
	return gist, nil
}

func (fx *serviceFixture) seedGist(memoryID string, reached int16, stages *SemanticStages) {
	if fx.gists.gists == nil {
		fx.gists.gists = map[string]MemoryGist{}
	}
	fx.gists.gists[memoryID] = MemoryGist{SemanticStage: reached, SemanticStages: stages}
}

func fourStages() *SemanticStages {
	return &SemanticStages{"gist one", "gist two", "gist three", "gist four"}
}

func TestViewSemanticReturnsPregeneratedStageTextReadOnly(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := recallTestClock()
	fixture.launches.clock = &previous
	fixture.seedGist("m1", 3, fourStages())

	result, err := fixture.service.ViewSemantic(context.Background(), testScope(t), "m1", 2)
	if err != nil {
		t.Fatalf("ViewSemantic failed: %v", err)
	}

	// A1: exactly the pregenerated stage text + meta (1-based ladder → index stage-1).
	if result.Text != "gist two" || result.Stage != 2 || result.ReachedStage != 3 {
		t.Fatalf("result = %+v, want stage 2's pregenerated text + meta", result)
	}
	// A4: one spend, kind view_gist, carrying the gist-depth signal — never a price.
	if len(fixture.spendGate.intents) != 1 {
		t.Fatalf("spend intents = %d, want 1", len(fixture.spendGate.intents))
	}
	intent := fixture.spendGate.intents[0]
	if intent.Kind != SpendKindViewGist || intent.MemoryID != "m1" || intent.Stage != 2 {
		t.Fatalf("spend intent = %+v, want {view_gist m1 2}", intent)
	}
	// A1/A6/A7: nothing written, no transaction opened, no clock advance, no
	// reconsolidation machinery — the view is a pure read outside every write path.
	if fixture.launches.txCount != 0 || fixture.launches.recallTxCount != 0 {
		t.Fatalf("transactions = {launch %d, recall %d}, want none for a view", fixture.launches.txCount, fixture.launches.recallTxCount)
	}
	if fixture.launches.clock != &previous {
		t.Fatal("universe clock changed, want untouched on a view")
	}
	if fixture.predictionError.calls != 0 {
		t.Fatalf("prediction-error compares = %d, want 0 — a view never reconsolidates", fixture.predictionError.calls)
	}
	if len(fixture.launches.recall.anchorResets) != 0 || len(fixture.launches.recall.provenance) != 0 {
		t.Fatal("recall anchors/provenance written, want none for a view")
	}
}

func TestViewSemanticRefusesUnrisenOrUnpregeneratedStages(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.seedGist("no-stages", 0, nil)
	fixture.seedGist("risen-2", 2, fourStages())
	fixture.seedGist("risen-4", 4, fourStages())

	cases := []struct {
		name     string
		memoryID string
		stage    int
	}{
		{"semantic_stages not pregenerated", "no-stages", 1},
		{"stage above the risen semantic_stage", "risen-2", 3},
		{"stage above the derived ladder length", "risen-4", 5},
	}
	for _, tc := range cases {
		if _, err := fixture.service.ViewSemantic(context.Background(), testScope(t), tc.memoryID, tc.stage); !errors.Is(err, ErrViewSemanticStageNotRisen) {
			t.Fatalf("%s: err = %v, want ErrViewSemanticStageNotRisen", tc.name, err)
		}
	}
	// A3/A4: a refused view never fabricates a text and never reaches the gate.
	if len(fixture.spendGate.intents) != 0 {
		t.Fatalf("spend intents = %d, want 0 on refusals", len(fixture.spendGate.intents))
	}
}

func TestViewSemanticValidatesInput(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.seedGist("m1", 2, fourStages())

	// Stage 0 is the concrete episodic memory, not a gist; negatives and an empty id
	// are plain bad input. None may reach the gist read or the gate.
	for _, stage := range []int{0, -1} {
		if _, err := fixture.service.ViewSemantic(context.Background(), testScope(t), "m1", stage); !errors.Is(err, ErrViewSemanticInputRequired) {
			t.Fatalf("stage %d err = %v, want ErrViewSemanticInputRequired", stage, err)
		}
	}
	if _, err := fixture.service.ViewSemantic(context.Background(), testScope(t), "", 1); !errors.Is(err, ErrViewSemanticInputRequired) {
		t.Fatalf("empty id err = %v, want ErrViewSemanticInputRequired", err)
	}
	if _, err := fixture.service.ViewSemantic(context.Background(), platform.UserScope{}, "m1", 1); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("missing scope err = %v, want ErrScopeRequired", err)
	}
	if len(fixture.gists.calls) != 0 || len(fixture.spendGate.intents) != 0 {
		t.Fatalf("reads = %d, spends = %d — want 0 on invalid input", len(fixture.gists.calls), len(fixture.spendGate.intents))
	}
}

func TestViewSemanticMemoryNotFoundIsCanonical(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)

	// A9 at the unit level: the reader returns the canonical not-found for a row that
	// is not the caller's (the per-user WHERE is the pg integration test's proof).
	if _, err := fixture.service.ViewSemantic(context.Background(), testScope(t), "someone-elses", 1); !errors.Is(err, ErrViewSemanticMemoryNotFound) {
		t.Fatalf("err = %v, want ErrViewSemanticMemoryNotFound", err)
	}
	if len(fixture.spendGate.intents) != 0 {
		t.Fatal("a not-found view must not spend")
	}
}

func TestViewSemanticSpendIsAPreconditionOfTheRead(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.seedGist("m1", 4, fourStages())
	fixture.spendGate.denyErr = ErrInsufficientTwinkle

	result, err := fixture.service.ViewSemantic(context.Background(), testScope(t), "m1", 4)
	if !errors.Is(err, ErrInsufficientTwinkle) {
		t.Fatalf("err = %v, want ErrInsufficientTwinkle surfaced verbatim", err)
	}
	// A4: a gate refusal returns no text.
	if result.Text != "" || result.Stage != 0 {
		t.Fatalf("result = %+v, want zero value on a denied spend", result)
	}
	if len(fixture.spendGate.intents) != 1 || fixture.spendGate.intents[0].Stage != 4 {
		t.Fatalf("intents = %+v, want the stage-4 depth signal handed to the gate", fixture.spendGate.intents)
	}
}

func TestViewSemanticSpendIntentCarriesTheStageAsDepthSignal(t *testing.T) {
	t.Parallel()
	// A4: the intent carries the viewed stage as its gist-depth signal (monotone in
	// stage) and its view_gist kind — never a price. The gate's cheaper-the-deeper
	// mapping is the economy's, so all this unit owes is the stage-as-signal.
	for stage := 1; stage <= len(SemanticStages{}); stage++ {
		intent := GistViewSpendIntent("m1", stage)
		if intent.Kind != SpendKindViewGist || intent.MemoryID != "m1" || int(intent.Stage) != stage {
			t.Fatalf("GistViewSpendIntent(m1, %d) = %+v, want {view_gist m1 %d}", stage, intent, stage)
		}
	}
}
