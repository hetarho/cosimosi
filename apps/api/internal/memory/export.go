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
	// WalkExport yields ordered, retained diaries and their live memories from one read snapshot.
	// The adapter holds only one bounded batch; a callback error stops further reads.
	WalkExport(ctx context.Context, scope platform.UserScope, visit func(ExportDiary, []ExportMemory) error) error
}

type ExportService struct{ exports ExportReader }

func NewExportService(reader ExportReader) (*ExportService, error) {
	if reader == nil {
		return nil, ErrExportsRequired
	}
	return &ExportService{exports: reader}, nil
}

// Export reads the retained diaries + still-live memories (per-user scoped), groups the memories under
// their diary, and serializes the chosen format. The grouping and serialization are pure domain; the
// reader is the only IO. No write, no clock, no spend (A6).
func (s *ExportService) Export(ctx context.Context, scope platform.UserScope, format ExportFormat) (ExportResult, error) {
	if scope.UserID() == "" {
		return ExportResult{}, ErrScopeRequired
	}
	if !format.Valid() {
		return ExportResult{}, ErrExportFormatRequired
	}
	var buf bytes.Buffer
	var csvWriter *csv.Writer
	result := ExportResult{ContentType: "text/markdown; charset=utf-8", Filename: "cosimosi-export.md"}
	if format == ExportFormatCSV {
		result.ContentType, result.Filename = "text/csv; charset=utf-8", "cosimosi-export.csv"
		csvWriter = csv.NewWriter(&buf)
		if err := csvWriter.Write([]string{"diary_date", "diary_body", "memory_name", "mood", "created_universe_time"}); err != nil {
			return ExportResult{}, err
		}
	} else {
		buf.WriteString("# cosimosi\n")
	}
	err := s.exports.WalkExport(ctx, scope, func(diary ExportDiary, memories []ExportMemory) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		if csvWriter != nil {
			return writeExportCSV(csvWriter, diary, memories)
		}
		writeExportMarkdown(&buf, diary, memories)
		return nil
	})
	if err != nil {
		return ExportResult{}, err
	}
	if csvWriter != nil {
		csvWriter.Flush()
		if err := csvWriter.Error(); err != nil {
			return ExportResult{}, err
		}
	}
	result.Content = buf.Bytes()
	return result, nil
}

// Bodies remain byte-verbatim, including commas, line breaks and spreadsheet prefixes.
func writeExportCSV(writer *csv.Writer, diary ExportDiary, memories []ExportMemory) error {
	date := diary.DiaryDate.Format(time.DateOnly)
	if len(memories) == 0 {
		return writer.Write([]string{date, diary.Body, "", "", ""})
	}
	for _, mem := range memories {
		if err := writer.Write([]string{date, diary.Body, mem.Name, string(mem.Mood), mem.CreatedUniverseTime.Format(time.DateOnly)}); err != nil {
			return err
		}
	}
	return nil
}

func writeExportMarkdown(buf *bytes.Buffer, diary ExportDiary, memories []ExportMemory) {
	buf.WriteString("\n## ")
	buf.WriteString(diary.DiaryDate.Format(time.DateOnly))
	buf.WriteString("\n\n")
	buf.WriteString(diary.Body)
	buf.WriteString("\n")
	if len(memories) > 0 {
		buf.WriteString("\n")
	}
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
