//go:build integration

// Integration test for spec 11 reinforce + recall against live Postgres. Opt-in
// (build tag `integration`). Run on the compose network:
//
//	docker run --rm --network cosimosi_default \
//	  -e DATABASE_URL=postgres://cosimosi:cosimosi@postgres:5432/cosimosi?sslmode=disable \
//	  -v ${PWD}/backend:/app -w /app golang:1.26 \
//	  go test -tags integration -run Integration -v ./internal/link/
//
// Covers acceptance 1.4 (accumulate + cap 1.0), 1.10 (batch_id idempotency), 1.8
// (RecallMemory NotFound), and the recall touch/record read.
package link_test

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

func TestReinforceAndRecallIntegration(t *testing.T) {
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
	user := "itest-R-" + suffix
	today := pgtype.Date{Time: time.Now().UTC(), Valid: true}
	m1, m2 := "rmem-1-"+suffix, "rmem-2-"+suffix

	for i, mid := range []string{m1, m2} {
		rec := "rrec-" + strconv.Itoa(i) + "-" + suffix
		if err := q.InsertRecord(ctx, gen.InsertRecordParams{ID: rec, UserID: user, Body: "본문 " + mid, EntryDate: today}); err != nil {
			t.Fatalf("insert record: %v", err)
		}
		if _, err := q.InsertMemory(ctx, gen.InsertMemoryParams{ID: mid, UserID: user, RecordID: rec}); err != nil {
			t.Fatalf("insert memory: %v", err)
		}
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM memory_links WHERE user_id=$1", user)
		_, _ = pool.Exec(ctx, "DELETE FROM processed_batches WHERE user_id=$1", user)
		_, _ = pool.Exec(ctx, "DELETE FROM memories WHERE user_id=$1", user)
		_, _ = pool.Exec(ctx, "DELETE FROM records WHERE user_id=$1", user)
	})

	repo := link.NewRepository(pool)
	mrepo := memory.NewRepository(pool)
	pair := []memory.LinkDelta{{AID: m1, BID: m2, DeltaWeight: 0.05}}
	// Use the service so normalization/sum is exercised too.
	svc := link.NewService(repo)

	readWeight := func() float64 {
		var w float32
		// normalized a<b under DB collation
		_ = pool.QueryRow(ctx, "SELECT weight FROM memory_links WHERE user_id=$1 ORDER BY a_id LIMIT 1", user).Scan(&w)
		return float64(w)
	}

	// First batch → weight 0.05.
	if err := svc.ReinforceLinks(ctx, user, "b1-"+suffix, pair); err != nil {
		t.Fatalf("reinforce b1: %v", err)
	}
	if w := readWeight(); w < 0.049 || w > 0.051 {
		t.Fatalf("after b1 weight=%f, want ~0.05", w)
	}

	// 1.10: same batch_id again → idempotent, weight unchanged.
	if err := svc.ReinforceLinks(ctx, user, "b1-"+suffix, pair); err != nil {
		t.Fatalf("reinforce b1 again: %v", err)
	}
	if w := readWeight(); w > 0.051 {
		t.Fatalf("idempotency broken: after resend weight=%f, want ~0.05", w)
	}

	// 1.4: new batch_id accumulates.
	if err := svc.ReinforceLinks(ctx, user, "b2-"+suffix, pair); err != nil {
		t.Fatalf("reinforce b2: %v", err)
	}
	if w := readWeight(); w < 0.099 || w > 0.101 {
		t.Fatalf("after b2 weight=%f, want ~0.10", w)
	}

	// 1.4 cap: many batches → weight caps at 1.0.
	for i := 0; i < 40; i++ {
		if err := svc.ReinforceLinks(ctx, user, "cap-"+strconv.Itoa(i)+"-"+suffix, pair); err != nil {
			t.Fatalf("reinforce cap %d: %v", i, err)
		}
	}
	if w := readWeight(); w > 1.0001 || w < 0.999 {
		t.Fatalf("weight cap broken: %f, want 1.0", w)
	}

	// recall: touch + record read; missing → ErrNotFound (1.8).
	if err := mrepo.TouchRecall(ctx, user, m1); err != nil {
		t.Fatalf("touch recall: %v", err)
	}
	rec, err := mrepo.GetRecord(ctx, user, m1)
	if err != nil {
		t.Fatalf("get record: %v", err)
	}
	if rec.Body != "본문 "+m1 {
		t.Fatalf("record body = %q", rec.Body)
	}
	if _, err := mrepo.GetRecord(ctx, user, "does-not-exist-"+suffix); !errors.Is(err, memory.ErrNotFound) {
		t.Fatalf("missing memory: want ErrNotFound, got %v", err)
	}
}
