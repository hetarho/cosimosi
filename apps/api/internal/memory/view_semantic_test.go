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

	result, err := fixture.service.ViewSemantic(context.Background(), testScope(t), "op-1", "m1")
	if err != nil {
		t.Fatalf("ViewSemantic failed: %v", err)
	}

	// A4: the memory has risen to 3 and nobody asked for a stage, so 3 is what is served —
	// the pregenerated text at the 1-based ladder's index stage-1.
	if result.Text != "gist three" || result.ReachedStage != 3 {
		t.Fatalf("result = %+v, want the current rung's pregenerated text + meta", result)
	}
	// A4: one spend, kind view_gist, carrying the gist-depth signal — never a price.
	if len(fixture.spendGate.intents) != 1 {
		t.Fatalf("spend intents = %d, want 1", len(fixture.spendGate.intents))
	}
	intent := fixture.spendGate.intents[0]
	if intent.Kind != SpendKindViewGist || intent.MemoryID != "m1" || intent.Stage != 3 {
		t.Fatalf("spend intent = %+v, want {view_gist m1 3} — the DERIVED depth, not a request's", intent)
	}
	// The paid view now runs in its own transaction (A3): the gate receives that transaction
	// handle so the debit + the receipt commit together.
	if len(fixture.spendGate.txs) != 1 || fixture.spendGate.txs[0] == nil {
		t.Fatalf("spend txs = %+v, want one view-transaction handle", fixture.spendGate.txs)
	}
	if fixture.launches.viewTxCount != 1 {
		t.Fatalf("view transactions = %d, want 1", fixture.launches.viewTxCount)
	}
	// A1/A6/A7: no launch/recall transaction, no clock advance, no reconsolidation machinery —
	// the view's only write is the debit + its receipt, never an anchor/provenance/clock write.
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
	fixture.seedGist("no-stages", 3, nil)
	fixture.seedGist("unrisen", 0, fourStages())

	cases := []struct {
		name     string
		memoryID string
	}{
		{"semantic_stages not pregenerated", "no-stages"},
		{"nothing has risen (stage 0 is the concrete memory)", "unrisen"},
	}
	for _, tc := range cases {
		if _, err := fixture.service.ViewSemantic(context.Background(), testScope(t), "op-1", tc.memoryID); !errors.Is(err, ErrViewSemanticStageNotRisen) {
			t.Fatalf("%s: err = %v, want ErrViewSemanticStageNotRisen", tc.name, err)
		}
	}
	// A3/A4: a refused view never fabricates a text and never reaches the gate.
	if len(fixture.spendGate.intents) != 0 {
		t.Fatalf("spend intents = %d, want 0 on refusals", len(fixture.spendGate.intents))
	}
}

func TestViewSemanticServesTheMemorysCurrentRung(t *testing.T) {
	t.Parallel()

	// A2/A4: every risen depth reads its OWN rung without being asked, and the spend is priced
	// at that same derived number — the one place a client could previously name a cheaper one.
	for stage := int16(1); stage <= 4; stage++ {
		fixture := newFixture(t)
		fixture.seedGist("m1", stage, fourStages())

		result, err := fixture.service.ViewSemantic(context.Background(), testScope(t), "op-1", "m1")
		if err != nil {
			t.Fatalf("stage %d: ViewSemantic failed: %v", stage, err)
		}
		if result.ReachedStage != stage || result.Text != (*fourStages())[stage-1] {
			t.Fatalf("stage %d: result = %+v, want that stage's text", stage, result)
		}
		if len(fixture.spendGate.intents) != 1 || fixture.spendGate.intents[0].Stage != stage {
			t.Fatalf("stage %d: intents = %+v, want one priced at the derived stage", stage, fixture.spendGate.intents)
		}
	}
}

func TestViewSemanticClampsAStageAboveTheLadder(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	// The ladder is a fixed four rungs, so a semantic_stage above it can only be corruption. It
	// serves the deepest real rung rather than indexing past the end.
	fixture.seedGist("m1", 9, fourStages())

	result, err := fixture.service.ViewSemantic(context.Background(), testScope(t), "op-1", "m1")
	if err != nil {
		t.Fatalf("ViewSemantic failed: %v", err)
	}
	if result.ReachedStage != 4 || result.Text != "gist four" {
		t.Fatalf("result = %+v, want the deepest rung", result)
	}
	if len(fixture.spendGate.intents) != 1 || fixture.spendGate.intents[0].Stage != 4 {
		t.Fatalf("intents = %+v, want the clamped depth priced", fixture.spendGate.intents)
	}
}

func TestViewSemanticValidatesInput(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.seedGist("m1", 2, fourStages())

	// The only bad input left is an empty id — there is no client stage to be out of range.
	// None of these may reach the gist read or the gate.
	if _, err := fixture.service.ViewSemantic(context.Background(), testScope(t), "op-1", ""); !errors.Is(err, ErrViewSemanticInputRequired) {
		t.Fatalf("empty id err = %v, want ErrViewSemanticInputRequired", err)
	}
	if _, err := fixture.service.ViewSemantic(context.Background(), testScope(t), "", "m1"); !errors.Is(err, ErrOperationIDRequired) {
		t.Fatalf("empty operation id err = %v, want ErrOperationIDRequired", err)
	}
	if _, err := fixture.service.ViewSemantic(context.Background(), platform.UserScope{}, "op-1", "m1"); !errors.Is(err, ErrScopeRequired) {
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
	if _, err := fixture.service.ViewSemantic(context.Background(), testScope(t), "op-1", "someone-elses"); !errors.Is(err, ErrViewSemanticMemoryNotFound) {
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

	result, err := fixture.service.ViewSemantic(context.Background(), testScope(t), "op-1", "m1")
	if !errors.Is(err, ErrInsufficientTwinkle) {
		t.Fatalf("err = %v, want ErrInsufficientTwinkle surfaced verbatim", err)
	}
	// A4: a gate refusal returns no text.
	if result.Text != "" || result.ReachedStage != 0 {
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
		intent := GistViewSpendIntent("op-1", "m1", stage)
		if intent.Kind != SpendKindViewGist || intent.MemoryID != "m1" || intent.OperationID != "op-1" || int(intent.Stage) != stage {
			t.Fatalf("GistViewSpendIntent(op-1, m1, %d) = %+v, want {view_gist m1 op-1 %d}", stage, intent, stage)
		}
	}
}
