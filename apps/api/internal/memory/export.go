package memory

import (
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// Export use-case ([W6][D4]) — the whole-account "your retained data can leave with you" artifact: the
// user's retained immutable Diary records and the still-live memories launched from them, serialized to
// a plain portable file (CSV or MD). It draws from the objective record, never the mutable
// representation ([D4][I2]) — the diary body is byte-verbatim and current_text / stage texts are never
// its authoritative content. Read-only: no clock ([T3]), no row appended, no stardust (archive tier
// [G1][G4]); it deletes nothing and honors the soft-delete exclusion in what is handed out ([I1][X3]).

var (
	// ErrExportFormatRequired rejects an unspecified/unknown export format.
	ErrExportFormatRequired = errors.New("export requires a known format")
)

// ExportFormat is the closed set of export serializations ([W6]), stored/compared as a lowercase
// string (matching NeuronType/ProvenanceKind), the proto ExportFormat enum mapped onto it at the edge.
type ExportFormat string

const (
	ExportFormatCSV ExportFormat = "csv"
	ExportFormatMD  ExportFormat = "md"
)

func (f ExportFormat) Valid() bool {
	switch f {
	case ExportFormatCSV, ExportFormatMD:
		return true
	default:
		return false
	}
}

// ExportDiary is one retained immutable Diary in the export: the objective record ([I2][D4]) — its
// verbatim body and the date it was written for.
type ExportDiary struct {
	ID        string
	Body      string
	DiaryDate time.Time
}

// ExportMemory is one still-live episodic memory launched from a diary, listed so the structure is
// legible. Only its stable identity (name, mood, creation universe-time) is exported — never its
// mutable representation ([D4]).
type ExportMemory struct {
	DiaryID             string
	Name                string
	Mood                Mood
	CreatedUniverseTime time.Time
}

// ExportResult is the serialized download payload: the bytes plus the content-type/filename hints the
// delivery response carries (the RPC response itself is the delivery mechanism).
type ExportResult struct {
	Content     []byte
	ContentType string
	Filename    string
}

// ExportReader is the Export use-case's consumer-owned read port (§2.4): the retained diaries and the
// still-live memories, per-user scoped, read-only. The concrete is memory/pg, which implements it
// implicitly.
type ExportReader interface {
	// DiariesForExport lists the user's retained diaries (the immutable objective record), diary-date
	// ordered. diaries is never soft-deleted, so a past-dated diary with no live memory is still returned ([I2], A8).
	DiariesForExport(ctx context.Context, scope platform.UserScope) ([]ExportDiary, error)
	// LiveMemoriesForExport lists the user's still-live memories (deleted_at IS NULL) — the letting-go
	// exclusion honored in what is handed out ([I1][X3]).
	LiveMemoriesForExport(ctx context.Context, scope platform.UserScope) ([]ExportMemory, error)
}

// Export reads the retained diaries + still-live memories (per-user scoped), groups the memories under
// their diary, and serializes the chosen format. The grouping and serialization are pure domain; the
// reader is the only IO. No write, no clock, no spend (A6).
func (s *Service) Export(ctx context.Context, scope platform.UserScope, format ExportFormat) (ExportResult, error) {
	if scope.UserID() == "" {
		return ExportResult{}, ErrScopeRequired
	}
	if !format.Valid() {
		return ExportResult{}, ErrExportFormatRequired
	}
	diaries, err := s.exports.DiariesForExport(ctx, scope)
	if err != nil {
		return ExportResult{}, err
	}
	memories, err := s.exports.LiveMemoriesForExport(ctx, scope)
	if err != nil {
		return ExportResult{}, err
	}
	byDiary := make(map[string][]ExportMemory, len(diaries))
	for _, mem := range memories {
		byDiary[mem.DiaryID] = append(byDiary[mem.DiaryID], mem)
	}
	switch format {
	case ExportFormatMD:
		return exportMarkdown(diaries, byDiary), nil
	default:
		return exportCSV(diaries, byDiary)
	}
}

// exportCSV writes one row per diary×memory (a diary with no live memory still emits one row so a
// memory-less retained diary is not lost, A8). encoding/csv quotes the verbatim body so commas, quotes,
// and newlines round-trip byte-for-byte (A4). The body is written verbatim by design ([D4][W6]) — no
// spreadsheet formula-injection guard (a leading =/+/-/@ is left as written): this is the user's own
// record handed back to them, and A4 forbids mutating it.
func exportCSV(diaries []ExportDiary, byDiary map[string][]ExportMemory) (ExportResult, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	if err := writer.Write([]string{"diary_date", "diary_body", "memory_name", "mood", "created_universe_time"}); err != nil {
		return ExportResult{}, err
	}
	for _, diary := range diaries {
		date := diary.DiaryDate.Format(time.DateOnly)
		memories := byDiary[diary.ID]
		if len(memories) == 0 {
			if err := writer.Write([]string{date, diary.Body, "", "", ""}); err != nil {
				return ExportResult{}, err
			}
			continue
		}
		for _, mem := range memories {
			if err := writer.Write([]string{
				date,
				diary.Body,
				mem.Name,
				string(mem.Mood),
				mem.CreatedUniverseTime.Format(time.DateOnly),
			}); err != nil {
				return ExportResult{}, err
			}
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return ExportResult{}, err
	}
	return ExportResult{
		Content:     buf.Bytes(),
		ContentType: "text/csv; charset=utf-8",
		Filename:    "cosimosi-export.csv",
	}, nil
}

// exportMarkdown writes a dated section per diary with its verbatim body, then its memories as a short
// list. The body is written un-mutated ([D4]); the memory line is only the legible identity.
func exportMarkdown(diaries []ExportDiary, byDiary map[string][]ExportMemory) ExportResult {
	var buf bytes.Buffer
	buf.WriteString("# cosimosi\n")
	for _, diary := range diaries {
		buf.WriteString("\n## ")
		buf.WriteString(diary.DiaryDate.Format(time.DateOnly))
		buf.WriteString("\n\n")
		buf.WriteString(diary.Body)
		buf.WriteString("\n")
		memories := byDiary[diary.ID]
		if len(memories) == 0 {
			continue
		}
		buf.WriteString("\n")
		for _, mem := range memories {
			buf.WriteString("- ")
			buf.WriteString(mem.Name)
			buf.WriteString(" (")
			buf.WriteString(string(mem.Mood))
			buf.WriteString(", ")
			buf.WriteString(mem.CreatedUniverseTime.Format(time.DateOnly))
			buf.WriteString(")\n")
		}
	}
	return ExportResult{
		Content:     buf.Bytes(),
		ContentType: "text/markdown; charset=utf-8",
		Filename:    "cosimosi-export.md",
	}
}
