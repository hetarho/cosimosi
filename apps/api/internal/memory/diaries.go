package memory

import (
	"context"
	"encoding/base64"
	"errors"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// GetDiaries use-case ([D2]) — the diary-reader archive read: one reverse-chronological page of the
// user's immutable Diary entries, each carrying its split membership (the still-live episodic memories
// it launched, [D3]). It is free ([G4]): no clock advance ([T3]), no write, no Twinkle spend — it
// carries no SpendGate call. GET-eligible / NO_SIDE_EFFECTS (§2.7).

var (
	// ErrDiaryPageTokenInvalid rejects a malformed pagination cursor.
	ErrDiaryPageTokenInvalid = errors.New("get diaries page token is invalid")
)

// DiarySplitRef is one entry in a diary's split membership ([D3]): a still-live episodic memory the
// diary launched, named and mood-tagged (the client maps mood to a color [I3]).
type DiarySplitRef struct {
	EpisodicMemoryID string
	Name             string
	Mood             Mood
}

// DiaryEntry is one archived diary in the reader ([D2]): its immutable body ([I2][D4]), the date the
// user wrote it for, the universe-time its stars were launched at (all a diary's memories share it —
// nil when the diary launched none), and its split membership.
type DiaryEntry struct {
	ID                  string
	Body                string
	DiaryDate           time.Time
	CreatedUniverseTime *time.Time
	Memories            []DiarySplitRef
}

// DiaryPage is one keyset page of the archive plus the opaque cursor to the next (empty = last page).
type DiaryPage struct {
	Diaries       []DiaryEntry
	NextPageToken string
}

// DiaryCursor is the keyset position between pages: the (diary_date, id) tuple of the last entry
// returned. Ordering is reverse-chronological, so the next page continues strictly before it.
type DiaryCursor struct {
	DiaryDate time.Time
	ID        string
}

// DiaryPageRow / DiarySplitRow are the reader port's domain-shaped rows (no proto/sqlc type crosses).
type DiaryPageRow struct {
	ID        string
	Body      string
	DiaryDate time.Time
}

type DiarySplitRow struct {
	DiaryID             string
	EpisodicMemoryID    string
	Name                string
	Mood                Mood
	CreatedUniverseTime time.Time
}

// DiaryReader is the GetDiaries use-case's consumer-owned read port (§2.4), per-user scoped, read-only.
// The concrete is memory/pg, which implements it implicitly.
type DiaryReader interface {
	// DiaryPage returns up to limit diaries reverse-chronologically; a nil cursor starts at the newest.
	DiaryPage(ctx context.Context, scope platform.UserScope, cursor *DiaryCursor, limit int) ([]DiaryPageRow, error)
	// DiarySplitRefs returns the still-live split membership (deleted_at IS NULL) of the given diaries.
	DiarySplitRefs(ctx context.Context, scope platform.UserScope, diaryIDs []string) ([]DiarySplitRow, error)
}

// GetDiaries returns one page of the archive: fetch limit+1 rows to detect a next page, load the split
// refs of the page's diaries in one read, group them under each diary, and mint the next cursor. The
// page size is clamped to the configured maximum so a client cannot request an unbounded page. Free
// read — no clock, no spend (A5).
func (s *Service) GetDiaries(ctx context.Context, scope platform.UserScope, pageSize int, pageToken string) (DiaryPage, error) {
	if scope.UserID() == "" {
		return DiaryPage{}, ErrScopeRequired
	}
	limit := pageSize
	if limit <= 0 || limit > values.DiaryReaderPageSize {
		limit = values.DiaryReaderPageSize
	}
	var cursor *DiaryCursor
	if pageToken != "" {
		decoded, err := decodeDiaryCursor(pageToken)
		if err != nil {
			return DiaryPage{}, ErrDiaryPageTokenInvalid
		}
		cursor = &decoded
	}

	rows, err := s.diaries.DiaryPage(ctx, scope, cursor, limit+1)
	if err != nil {
		return DiaryPage{}, err
	}
	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}

	ids := make([]string, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	var refs []DiarySplitRow
	if len(ids) > 0 {
		refs, err = s.diaries.DiarySplitRefs(ctx, scope, ids)
		if err != nil {
			return DiaryPage{}, err
		}
	}
	byDiary := make(map[string][]DiarySplitRow, len(rows))
	for _, ref := range refs {
		byDiary[ref.DiaryID] = append(byDiary[ref.DiaryID], ref)
	}

	entries := make([]DiaryEntry, 0, len(rows))
	for _, row := range rows {
		entry := DiaryEntry{ID: row.ID, Body: row.Body, DiaryDate: row.DiaryDate}
		if diaryRefs := byDiary[row.ID]; len(diaryRefs) > 0 {
			// All of a diary's memories launched together, so they share created_universe_time.
			launched := diaryRefs[0].CreatedUniverseTime
			entry.CreatedUniverseTime = &launched
			entry.Memories = make([]DiarySplitRef, 0, len(diaryRefs))
			for _, ref := range diaryRefs {
				entry.Memories = append(entry.Memories, DiarySplitRef{
					EpisodicMemoryID: ref.EpisodicMemoryID,
					Name:             ref.Name,
					Mood:             ref.Mood,
				})
			}
		}
		entries = append(entries, entry)
	}

	var next string
	if hasMore && len(rows) > 0 {
		last := rows[len(rows)-1]
		next = encodeDiaryCursor(DiaryCursor{DiaryDate: last.DiaryDate, ID: last.ID})
	}
	return DiaryPage{Diaries: entries, NextPageToken: next}, nil
}

// The cursor is an opaque "<diary_date>|<id>" pair, base64url-encoded — an internal keyset position the
// client only echoes back, never parses.
func encodeDiaryCursor(cursor DiaryCursor) string {
	raw := cursor.DiaryDate.Format(time.DateOnly) + "|" + cursor.ID
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeDiaryCursor(token string) (DiaryCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return DiaryCursor{}, err
	}
	date, id, found := strings.Cut(string(raw), "|")
	if !found || id == "" {
		return DiaryCursor{}, errors.New("malformed diary cursor")
	}
	parsed, err := time.Parse(time.DateOnly, date)
	if err != nil {
		return DiaryCursor{}, err
	}
	return DiaryCursor{DiaryDate: parsed, ID: id}, nil
}
