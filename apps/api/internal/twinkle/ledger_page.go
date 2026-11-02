package twinkle

import (
	"context"
	"encoding/base64"
	"errors"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// GetLedger reads one page of the user's history, newest first ([G7][U9]) — the single surface where
// 구매·수령·적립·소모 are all readable in one chronological list. Read-only: no row, no delta, no clock
// advance.
//
// Each entry carries the calendar date it belongs to in the USER's zone, resolved here rather than on
// the device ([U7]): the same boundary the SMALL refill uses, so the history's day headers and the
// user's daily allowance agree about when a day turned.
//
// pageSize is clamped to twinkle.ledger_page_size as both the default AND the hard cap, so a client
// cannot ask for an unbounded slice of its own history.
func (s *Service) GetLedger(ctx context.Context, scope platform.UserScope, pageSize int, pageToken string) (LedgerPage, error) {
	if scope.UserID() == "" {
		return LedgerPage{}, ErrScopeRequired
	}
	var cursor *LedgerCursor
	if strings.TrimSpace(pageToken) != "" {
		decoded, err := decodeLedgerCursor(pageToken)
		if err != nil {
			return LedgerPage{}, ErrLedgerCursorInvalid
		}
		cursor = &decoded
	}
	// The cap is the default and the ceiling both: an unset size gets the full page, an oversized one
	// is clamped rather than refused (a client asking for too much wants a page, not an error).
	limit := values.TwinkleLedgerPageSize
	if pageSize > 0 && pageSize < limit {
		limit = pageSize
	}
	zone, err := s.zone(ctx, scope)
	if err != nil {
		return LedgerPage{}, err
	}
	// One row beyond the page: its existence is what distinguishes "the history continues" from "the
	// page happened to end exactly here", without a second count query.
	entries, err := s.ledger.ListLedgerPage(ctx, scope, cursor, limit+1)
	if err != nil {
		return LedgerPage{}, err
	}
	next := ""
	if len(entries) > limit {
		last := entries[limit-1]
		next = encodeLedgerCursor(LedgerCursor{CreatedAt: last.CreatedAt, ID: last.ID})
		entries = entries[:limit]
	}
	views := make([]LedgerView, 0, len(entries))
	for _, entry := range entries {
		views = append(views, LedgerView{Entry: entry, OccurredOn: ResetWindowOf(entry.CreatedAt, zone)})
	}
	return LedgerPage{Entries: views, NextPageToken: next}, nil
}

// The cursor is an opaque "<created_at>|<id>" pair, base64url-encoded — an internal keyset position the
// client only echoes back, never parses. RFC3339Nano because two entries written in one transaction
// can share a microsecond-truncated timestamp, and the id is what breaks that tie.
func encodeLedgerCursor(cursor LedgerCursor) string {
	raw := cursor.CreatedAt.UTC().Format(time.RFC3339Nano) + "|" + cursor.ID
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeLedgerCursor(token string) (LedgerCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return LedgerCursor{}, err
	}
	stamp, id, found := strings.Cut(string(raw), "|")
	if !found || id == "" {
		return LedgerCursor{}, errors.New("malformed twinkle ledger cursor")
	}
	parsed, err := time.Parse(time.RFC3339Nano, stamp)
	if err != nil {
		return LedgerCursor{}, err
	}
	return LedgerCursor{CreatedAt: parsed, ID: id}, nil
}
