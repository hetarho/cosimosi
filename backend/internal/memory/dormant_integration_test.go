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
