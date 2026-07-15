package memory

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// fakeProvenanceReader serves baseline + history fixtures; an unknown id mirrors the pg concrete's
// canonical not-found (another user's row and a soft-deleted row are indistinguishable here, §4).
type fakeProvenanceReader struct {
	origin       map[string]MemoryOrigin
	history      map[string][]MemoryProvenance
	originCalls  []string
	historyCalls []string
}

func (f *fakeProvenanceReader) MemoryOrigin(_ context.Context, scope platform.UserScope, memoryID string) (MemoryOrigin, error) {
	if scope.UserID() == "" {
		return MemoryOrigin{}, errors.New("scope missing")
	}
	f.originCalls = append(f.originCalls, memoryID)
	origin, ok := f.origin[memoryID]
	if !ok {
		return MemoryOrigin{}, ErrProvenanceMemoryNotFound
	}
	return origin, nil
}

func (f *fakeProvenanceReader) MemoryProvenanceHistory(_ context.Context, scope platform.UserScope, memoryID string) ([]MemoryProvenance, error) {
	if scope.UserID() == "" {
		return nil, errors.New("scope missing")
	}
	f.historyCalls = append(f.historyCalls, memoryID)
	return f.history[memoryID], nil
}

func day(year int, month time.Month, dayOfMonth int) time.Time {
	return time.Date(year, month, dayOfMonth, 0, 0, 0, 0, time.UTC)
}

func TestGetProvenanceSynthesizesCreatedBaselineForAZeroRowStar(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.provenance.origin = map[string]MemoryOrigin{
		"m1": {DiaryBody: "the original diary body", CreatedUniverseTime: day(2026, 6, 1)},
	}

	entries, err := fixture.service.GetProvenance(context.Background(), testScope(t), "m1")
	if err != nil {
		t.Fatalf("GetProvenance failed: %v", err)
	}
	// A2: a memory that has never been reconsolidated/semanticized still returns a one-entry history,
	// synthesized at read — created/original, whose text is the immutable Diary body ([CC5][I2]).
	if len(entries) != 1 {
		t.Fatalf("entries = %d, want a single synthesized baseline", len(entries))
	}
	baseline := entries[0]
	if baseline.Kind != ProvenanceKindCreated || baseline.Source != ProvenanceSourceOriginal {
		t.Fatalf("baseline = %s/%s, want created/original", baseline.Kind, baseline.Source)
	}
	if baseline.Text != "the original diary body" {
		t.Fatalf("baseline text = %q, want the Diary body", baseline.Text)
	}
	if !baseline.UniverseTime.Equal(day(2026, 6, 1)) {
		t.Fatalf("baseline universe_time = %v, want the creation date", baseline.UniverseTime)
	}
}

func TestGetProvenanceOrdersBaselineFirstThenAppendedRowsAndBaselineIsTheDiaryNotCurrentText(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.provenance.origin = map[string]MemoryOrigin{
		"m1": {DiaryBody: "born from the diary", CreatedUniverseTime: day(2026, 6, 1)},
	}
	// The reader returns the appended rows already universe-time ordered (its contract, backed by the
	// timeline index). The rewritten narrative differs from the Diary body.
	fixture.provenance.history = map[string][]MemoryProvenance{
		"m1": {
			{Kind: ProvenanceKindSemanticized, Source: ProvenanceSourceSystem, Text: "the gist", UniverseTime: day(2026, 6, 10)},
			{Kind: ProvenanceKindReconsolidated, Source: ProvenanceSourceUser, Text: "rewritten narrative", UniverseTime: day(2026, 6, 20)},
		},
	}

	entries, err := fixture.service.GetProvenance(context.Background(), testScope(t), "m1")
	if err != nil {
		t.Fatalf("GetProvenance failed: %v", err)
	}
	// A1: baseline first, then the appended events in universe-time order.
	want := []ProvenanceEntry{
		{Kind: ProvenanceKindCreated, Source: ProvenanceSourceOriginal, Text: "born from the diary", UniverseTime: day(2026, 6, 1)},
		{Kind: ProvenanceKindSemanticized, Source: ProvenanceSourceSystem, Text: "the gist", UniverseTime: day(2026, 6, 10)},
		{Kind: ProvenanceKindReconsolidated, Source: ProvenanceSourceUser, Text: "rewritten narrative", UniverseTime: day(2026, 6, 20)},
	}
	if len(entries) != len(want) {
		t.Fatalf("entries = %d, want %d", len(entries), len(want))
	}
	for i, entry := range entries {
		if entry != want[i] {
			t.Fatalf("entry[%d] = %+v, want %+v", i, entry, want[i])
		}
	}
	// A2/[I2] honesty: even after a reconsolidation the baseline reads the Diary body, never the
	// mutated representation — the objective record is not overwritten in the history.
	if entries[0].Text != "born from the diary" {
		t.Fatalf("baseline text = %q, want the immutable Diary body", entries[0].Text)
	}
	// A3: the entry shape is exactly {kind, source, text, universe_time} — there is no distortion flag
	// on the domain result (guaranteed by the ProvenanceEntry type; distortion is read, not announced).
}

func TestGetProvenanceRefusesUnknownInputAndScope(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.provenance.origin = map[string]MemoryOrigin{
		"m1": {DiaryBody: "body", CreatedUniverseTime: day(2026, 6, 1)},
	}

	// A10: a memory that is not the caller's (or is soft-deleted) is the canonical not-found.
	if _, err := fixture.service.GetProvenance(context.Background(), testScope(t), "someone-elses"); !errors.Is(err, ErrProvenanceMemoryNotFound) {
		t.Fatalf("cross-user err = %v, want ErrProvenanceMemoryNotFound", err)
	}
	if _, err := fixture.service.GetProvenance(context.Background(), testScope(t), ""); !errors.Is(err, ErrProvenanceInputRequired) {
		t.Fatalf("empty id err = %v, want ErrProvenanceInputRequired", err)
	}
	if _, err := fixture.service.GetProvenance(context.Background(), platform.UserScope{}, "m1"); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("empty scope err = %v, want ErrScopeRequired", err)
	}
	// A6: an invalid/empty-scope read never reaches the reader.
	if len(fixture.provenance.originCalls) != 1 {
		t.Fatalf("origin reads = %d, want only the one valid cross-user lookup", len(fixture.provenance.originCalls))
	}
}

func TestGetProvenanceIsReadOnly(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	before := day(2026, 7, 2)
	fixture.launches.clock = &before
	fixture.provenance.origin = map[string]MemoryOrigin{
		"m1": {DiaryBody: "body", CreatedUniverseTime: day(2026, 6, 1)},
	}
	fixture.provenance.history = map[string][]MemoryProvenance{
		"m1": {{Kind: ProvenanceKindReconsolidated, Source: ProvenanceSourceUser, Text: "rewrite", UniverseTime: day(2026, 6, 5)}},
	}

	if _, err := fixture.service.GetProvenance(context.Background(), testScope(t), "m1"); err != nil {
		t.Fatalf("GetProvenance failed: %v", err)
	}
	// A6/A7: no spend, no transaction, no clock advance, no reconsolidation, no provenance append —
	// the read is outside every write path (the reader has no append method at all).
	if len(fixture.spendGate.intents) != 0 {
		t.Fatalf("spend intents = %d, want 0 — provenance is free", len(fixture.spendGate.intents))
	}
	if fixture.launches.txCount != 0 || fixture.launches.recallTxCount != 0 {
		t.Fatalf("transactions = {launch %d, recall %d}, want none", fixture.launches.txCount, fixture.launches.recallTxCount)
	}
	if fixture.launches.clock != &before {
		t.Fatal("universe clock changed, want untouched on a read")
	}
	if fixture.predictionError.calls != 0 {
		t.Fatalf("prediction-error compares = %d, want 0", fixture.predictionError.calls)
	}
	if len(fixture.launches.recall.provenance) != 0 {
		t.Fatal("a provenance row was appended, want none for a read")
	}
}
