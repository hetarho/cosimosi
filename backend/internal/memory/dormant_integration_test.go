//go:build integration

// Integration test for ListDormant against live Postgres. Opt-in (build tag
// `integration`). Run on the compose network (see docker run command below).
//
//	docker run --rm --network cosimosi_default \
//	  -e DATABASE_URL=postgres://cosimosi:cosimosi@postgres:5432/cosimosi?sslmode=disable \
//	  -v ${PWD}/backend:/app -w /app golang:1.26 \
//	  go test -tags integration -run Integration -v ./internal/memory/
//
// Verifies dormant stars are listed by cutoff (ascending) while ListByUser/GetUniverse
// still returns the WHOLE graph (dormant ones are not removed/filtered).
package memory_test

import (
	"context"
	"errors"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/cosimosi/backend/internal/db/gen"
	"github.com/cosimosi/backend/internal/link"
	"github.com/cosimosi/backend/internal/memory"
	"github.com/cosimosi/backend/internal/platform/postgres"
)

func TestListDormantIntegration(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := postgres.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	q := gen.New(pool)
	suffix := strconv.FormatInt(time.Now().UnixNano(), 36)
	user := "itest-D-" + suffix
	today := pgtype.Date{Time: time.Now().UTC(), Valid: true}
	dormantID, freshID := "dmem-old-"+suffix, "dmem-new-"+suffix

	for i, mid := range []string{dormantID, freshID} {
		rec := "drec-" + strconv.Itoa(i) + "-" + suffix
		if err := q.InsertRecord(ctx, gen.InsertRecordParams{ID: rec, UserID: user, Body: "본문 " + mid, EntryDate: today}); err != nil {
			t.Fatalf("insert record: %v", err)
		}
		if _, err := q.InsertMemory(ctx, gen.InsertMemoryParams{ID: mid, UserID: user, RecordID: rec}); err != nil {
			t.Fatalf("insert memory: %v", err)
		}
	}
	// Age the dormant star ~200 days back (last_recalled_at is mutable; the record is not).
	if _, err := pool.Exec(ctx, "UPDATE memories SET last_recalled_at = now() - interval '200 days' WHERE id=$1", dormantID); err != nil {
		t.Fatalf("age dormant star: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM memories WHERE user_id=$1", user)
		_, _ = pool.Exec(ctx, "DELETE FROM records WHERE user_id=$1", user)
	})

	repo := memory.NewRepository(pool)

	// repo cutoff at -100 days → only the 200-day-old star.
	cutoff := time.Now().UTC().Add(-100 * 24 * time.Hour)
	dormant, err := repo.ListDormant(ctx, user, cutoff)
	if err != nil {
		t.Fatalf("list dormant: %v", err)
	}
	if len(dormant) != 1 || dormant[0].ID != dormantID {
		t.Fatalf("ListDormant(repo) = %+v, want only %s", dormant, dormantID)
	}

	// via the service (real now → ~99.66-day cutoff): same result.
	svc := memory.NewService(repo, link.NewService(link.NewRepository(pool)), nil)
	sd, err := svc.ListDormant(ctx, user)
	if err != nil {
		t.Fatalf("service list dormant: %v", err)
	}
	if len(sd) != 1 || sd[0].ID != dormantID {
		t.Fatalf("ListDormant(service) = %+v, want only %s", sd, dormantID)
	}

	// the full graph is unaffected — ListByUser returns BOTH stars.
	all, err := repo.ListByUser(ctx, user)
	if err != nil {
		t.Fatalf("list by user: %v", err)
	}
	if len(all) != 2 {
		t.Fatalf("ListByUser = %d stars, want 2 (dormant not removed — §2)", len(all))
	}
}

// change 09: GetRecordByID reads the original by record_id (standalone diary page) WITHOUT
// side effects (no last_recalled_at / recall_count bump — A11), is owner-guarded (another
// user → NotFound), and ListRecords' mood facet de-dups a diary's fragment moods.
func TestGetRecordIntegration(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := postgres.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	q := gen.New(pool)
	suffix := strconv.FormatInt(time.Now().UnixNano(), 36)
	user, other := "itest-G-"+suffix, "itest-G2-"+suffix
	recID := "grec-" + suffix
	today := pgtype.Date{Time: time.Now().UTC(), Valid: true}

	if err := q.InsertRecord(ctx, gen.InsertRecordParams{ID: recID, UserID: user, Body: "원본 일기 전문 본문", EntryDate: today}); err != nil {
		t.Fatalf("insert record: %v", err)
	}
	// Three fragment stars, moods joy/joy/calm → facet must de-dup to {joy, calm}.
	joy, calm := "joy", "calm"
	for i, mood := range []*string{&joy, &joy, &calm} {
		mid := "gmem-" + strconv.Itoa(i) + "-" + suffix
		if _, err := q.InsertMemory(ctx, gen.InsertMemoryParams{ID: mid, UserID: user, RecordID: recID, Mood: mood, FragmentIndex: int32(i)}); err != nil {
			t.Fatalf("insert memory %d: %v", i, err)
		}
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM memories WHERE user_id=$1", user)
		_, _ = pool.Exec(ctx, "DELETE FROM records WHERE user_id=$1", user)
	})

	repo := memory.NewRepository(pool)

	// Snapshot the star layer before the read.
	type starState struct {
		lastRecalled pgtype.Timestamptz
		recallCount  int32
	}
	snapshot := func() []starState {
		rows, qerr := pool.Query(ctx, "SELECT last_recalled_at, recall_count FROM memories WHERE user_id=$1 ORDER BY id", user)
		if qerr != nil {
			t.Fatalf("snapshot query: %v", qerr)
		}
		defer rows.Close()
		var out []starState
		for rows.Next() {
			var s starState
			if serr := rows.Scan(&s.lastRecalled, &s.recallCount); serr != nil {
				t.Fatalf("snapshot scan: %v", serr)
			}
			out = append(out, s)
		}
		return out
	}
	before := snapshot()

	// Owner read returns the WHOLE original body.
	rec, err := repo.GetRecordByID(ctx, user, recID)
	if err != nil {
		t.Fatalf("GetRecordByID(owner) = %v, want nil", err)
	}
	if rec.Body != "원본 일기 전문 본문" {
		t.Fatalf("body = %q, want the immutable original", rec.Body)
	}

	// A11: the read must NOT mutate the star layer (no recall bump).
	after := snapshot()
	if len(before) != len(after) {
		t.Fatalf("star count changed: %d → %d", len(before), len(after))
	}
	for i := range before {
		if before[i].recallCount != after[i].recallCount {
			t.Fatalf("recall_count[%d] changed %d → %d — GetRecord must be side-effect free (A11)", i, before[i].recallCount, after[i].recallCount)
		}
		if before[i].lastRecalled.Valid != after[i].lastRecalled.Valid || !before[i].lastRecalled.Time.Equal(after[i].lastRecalled.Time) {
			t.Fatalf("last_recalled_at[%d] changed — GetRecord must be side-effect free (A11)", i)
		}
	}

	// Owner guard: another user's read of the same record → NotFound (not Forbidden).
	if _, err := repo.GetRecordByID(ctx, other, recID); !errors.Is(err, memory.ErrNotFound) {
		t.Fatalf("GetRecordByID(other user) = %v, want ErrNotFound", err)
	}

	// ListRecords mood facet de-dups joy/joy/calm → exactly {joy, calm}.
	records, err := repo.ListRecords(ctx, user)
	if err != nil {
		t.Fatalf("list records: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("ListRecords = %d, want 1", len(records))
	}
	got := map[memory.Mood]int{}
	for _, m := range records[0].Moods {
		got[m]++
	}
	if len(records[0].Moods) != 2 || got[memory.MoodJoy] != 1 || got[memory.MoodCalm] != 1 {
		t.Fatalf("mood facet = %v, want de-duped {joy, calm}", records[0].Moods)
	}
	if records[0].StarCount != 3 {
		t.Fatalf("star_count = %d, want 3", records[0].StarCount)
	}
}
