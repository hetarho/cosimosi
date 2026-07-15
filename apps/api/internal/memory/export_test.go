package memory

import (
	"context"
	"encoding/csv"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// fakeExportReader serves the retained diaries + still-live memories fixtures. The soft-delete/sealing
// exclusion is the pg query's concern (the integration test's proof); at the unit level the reader
// simply returns what it is seeded with.
type fakeExportReader struct {
	diaries     []ExportDiary
	memories    []ExportMemory
	diaryCalls  int
	memoryCalls int
}

func (f *fakeExportReader) DiariesForExport(_ context.Context, scope platform.UserScope) ([]ExportDiary, error) {
	if scope.UserID() == "" {
		return nil, errors.New("scope missing")
	}
	f.diaryCalls++
	return f.diaries, nil
}

func (f *fakeExportReader) LiveMemoriesForExport(_ context.Context, scope platform.UserScope) ([]ExportMemory, error) {
	if scope.UserID() == "" {
		return nil, errors.New("scope missing")
	}
	f.memoryCalls++
	return f.memories, nil
}

func exportDate(day int) time.Time {
	return time.Date(2026, 6, day, 0, 0, 0, 0, time.UTC)
}

func TestExportCSVKeepsTheDiaryBodyByteVerbatim(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	// A body with the three characters CSV must escape: a comma, a "quote", and a
	// newline.
	body := "line one, with a comma\nline two with \"quotes\""
	fixture.exports.diaries = []ExportDiary{{ID: "d1", Body: body, DiaryDate: exportDate(1)}}
	fixture.exports.memories = []ExportMemory{
		{DiaryID: "d1", Name: "the market", Mood: MoodJoy, CreatedUniverseTime: exportDate(1)},
	}

	result, err := fixture.service.Export(context.Background(), testScope(t), ExportFormatCSV)
	if err != nil {
		t.Fatalf("Export CSV failed: %v", err)
	}
	if result.ContentType != "text/csv; charset=utf-8" || result.Filename != "cosimosi-export.csv" {
		t.Fatalf("delivery hints = %q/%q, want the CSV type/filename", result.ContentType, result.Filename)
	}
	// A4: parsing the CSV back recovers the body exactly — the quoting round-trips commas/quotes/newlines.
	records, err := csv.NewReader(strings.NewReader(string(result.Content))).ReadAll()
	if err != nil {
		t.Fatalf("re-parsing the export failed: %v", err)
	}
	if len(records) != 2 {
		t.Fatalf("rows = %d, want header + one data row", len(records))
	}
	if records[0][0] != "diary_date" || records[0][1] != "diary_body" {
		t.Fatalf("header = %v, want the documented columns", records[0])
	}
	if records[1][1] != body {
		t.Fatalf("body = %q, want it byte-verbatim = %q", records[1][1], body)
	}
	if records[1][2] != "the market" || records[1][3] != string(MoodJoy) {
		t.Fatalf("memory columns = %v, want name+mood", records[1][2:4])
	}
	// A4: the mutable representation never appears in the export.
	if strings.Contains(string(result.Content), "current_text") {
		t.Fatal("export contains a current_text reference, want only the objective record")
	}
}

func TestExportMarkdownIsDatedSectionsWithVerbatimBodyAndMemoryList(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.exports.diaries = []ExportDiary{{ID: "d1", Body: "a quiet morning", DiaryDate: exportDate(3)}}
	fixture.exports.memories = []ExportMemory{
		{DiaryID: "d1", Name: "the coffee", Mood: MoodCalm, CreatedUniverseTime: exportDate(3)},
	}

	result, err := fixture.service.Export(context.Background(), testScope(t), ExportFormatMD)
	if err != nil {
		t.Fatalf("Export MD failed: %v", err)
	}
	if result.ContentType != "text/markdown; charset=utf-8" || result.Filename != "cosimosi-export.md" {
		t.Fatalf("delivery hints = %q/%q, want the MD type/filename", result.ContentType, result.Filename)
	}
	out := string(result.Content)
	if !strings.Contains(out, "## 2026-06-03") {
		t.Fatalf("MD = %q, want a dated section", out)
	}
	if !strings.Contains(out, "a quiet morning") {
		t.Fatalf("MD = %q, want the verbatim diary body", out)
	}
	if !strings.Contains(out, "- the coffee (CALM, 2026-06-03)") {
		t.Fatalf("MD = %q, want the memory list line", out)
	}
}

func TestExportKeepsAStarlessRetainedDiary(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	// A8: a saved-but-past-dated diary whose memory was never launched (no live memory) is still exported.
	fixture.exports.diaries = []ExportDiary{{ID: "d1", Body: "past-dated entry", DiaryDate: exportDate(5)}}
	fixture.exports.memories = nil

	csvResult, err := fixture.service.Export(context.Background(), testScope(t), ExportFormatCSV)
	if err != nil {
		t.Fatalf("Export CSV failed: %v", err)
	}
	records, err := csv.NewReader(strings.NewReader(string(csvResult.Content))).ReadAll()
	if err != nil {
		t.Fatalf("re-parsing failed: %v", err)
	}
	if len(records) != 2 || records[1][1] != "past-dated entry" || records[1][2] != "" {
		t.Fatalf("rows = %v, want the memory-less diary as one row with empty memory columns", records)
	}
	mdResult, err := fixture.service.Export(context.Background(), testScope(t), ExportFormatMD)
	if err != nil {
		t.Fatalf("Export MD failed: %v", err)
	}
	if !strings.Contains(string(mdResult.Content), "past-dated entry") {
		t.Fatal("MD export dropped the memory-less diary")
	}
}

func TestExportValidatesFormatAndScope(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.exports.diaries = []ExportDiary{{ID: "d1", Body: "body", DiaryDate: exportDate(1)}}

	if _, err := fixture.service.Export(context.Background(), testScope(t), ExportFormat("")); !errors.Is(err, ErrExportFormatRequired) {
		t.Fatalf("unspecified format err = %v, want ErrExportFormatRequired", err)
	}
	if _, err := fixture.service.Export(context.Background(), testScope(t), ExportFormat("pdf")); !errors.Is(err, ErrExportFormatRequired) {
		t.Fatalf("unknown format err = %v, want ErrExportFormatRequired", err)
	}
	if _, err := fixture.service.Export(context.Background(), platform.UserScope{}, ExportFormatCSV); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("empty scope err = %v, want ErrScopeRequired", err)
	}
	// A6: an invalid request never reaches the reader.
	if fixture.exports.diaryCalls != 0 {
		t.Fatalf("diary reads = %d, want 0 on invalid input", fixture.exports.diaryCalls)
	}
}

func TestExportIsReadOnly(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	before := exportDate(2)
	fixture.launches.clock = &before
	fixture.exports.diaries = []ExportDiary{{ID: "d1", Body: "body", DiaryDate: exportDate(1)}}

	if _, err := fixture.service.Export(context.Background(), testScope(t), ExportFormatCSV); err != nil {
		t.Fatalf("Export failed: %v", err)
	}
	// A6: no spend, no transaction, no clock advance — the export is a pure read (archive tier, free).
	if len(fixture.spendGate.intents) != 0 {
		t.Fatalf("spend intents = %d, want 0 — export is free", len(fixture.spendGate.intents))
	}
	if fixture.launches.txCount != 0 || fixture.launches.recallTxCount != 0 {
		t.Fatalf("transactions = {launch %d, recall %d}, want none", fixture.launches.txCount, fixture.launches.recallTxCount)
	}
	if fixture.launches.clock != &before {
		t.Fatal("universe clock changed, want untouched on a read")
	}
}
