//go:build integration

// Integration test for the production reconsolidation SQL path. Opt-in (build
// tag `integration`) because it needs Postgres+pgvector.
//
//	docker run --rm --network cosimosi_default \
//	  -e DATABASE_URL=postgres://cosimosi:cosimosi@postgres:5432/cosimosi?sslmode=disable \
//	  -v ${PWD}/backend:/app -w /app golang:1.26 \
//	  go test -tags integration -run Reconsolidation -v ./internal/memory/
package memory_test

import (
	"context"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"

	"github.com/cosimosi/backend/internal/db/gen"
	"github.com/cosimosi/backend/internal/memory"
	"github.com/cosimosi/backend/internal/platform/config"
	"github.com/cosimosi/backend/internal/platform/postgres"
)

func TestReconsolidationContextIntegration(t *testing.T) {
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
	body := "원본은 바뀌지 않는다"
	for i, mid := range []string{m1, m2} {
		rec := "rrec-" + strconv.Itoa(i) + "-" + suffix
		if err := q.InsertRecord(ctx, gen.InsertRecordParams{ID: rec, UserID: user, Body: body, EntryDate: today}); err != nil {
			t.Fatalf("insert record: %v", err)
		}
		if _, err := q.InsertMemory(ctx, gen.InsertMemoryParams{ID: mid, UserID: user, RecordID: rec}); err != nil {
			t.Fatalf("insert memory: %v", err)
		}
	}
	defer func() {
		_, _ = pool.Exec(ctx, "DELETE FROM evolution_history WHERE user_id=$1", user)
		_, _ = pool.Exec(ctx, "DELETE FROM memory_links WHERE user_id=$1", user)
		_, _ = pool.Exec(ctx, "DELETE FROM embeddings WHERE user_id=$1", user)
		_, _ = pool.Exec(ctx, "DELETE FROM memories WHERE user_id=$1", user)
		_, _ = pool.Exec(ctx, "DELETE FROM records WHERE user_id=$1", user)
	}()

	v1, v2 := basisVector(0), basisVector(1)
	pv1, pv2 := pgvector.NewVector(v1), pgvector.NewVector(v2)
	if err := q.UpsertEmbedding(ctx, gen.UpsertEmbeddingParams{MemoryID: m1, UserID: user, Embedding: &pv1, Model: "itest"}); err != nil {
		t.Fatalf("upsert embedding 1: %v", err)
	}
	if err := q.UpsertEmbedding(ctx, gen.UpsertEmbeddingParams{MemoryID: m2, UserID: user, Embedding: &pv2, Model: "itest"}); err != nil {
		t.Fatalf("upsert embedding 2: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO memory_links (a_id, b_id, user_id, weight, link_type, co_activation_count, last_activated_at)
		VALUES (LEAST($1, $2), GREATEST($1, $2), $3, 0.8, 'co_recall', 1, now())
	`, m1, m2, user); err != nil {
		t.Fatalf("insert co-recall link: %v", err)
	}

	repo := memory.NewRepository(pool)
	rc, err := repo.GetReshapeContext(ctx, user, m1)
	if err != nil {
		t.Fatalf("reshape context: %v", err)
	}
	if rc.RecallEmbedding[0] == rc.ConsolidatedEmbedding[0] && rc.RecallEmbedding[1] == rc.ConsolidatedEmbedding[1] {
		t.Fatalf("recall embedding still equals consolidated embedding: recall=%v consolidated=%v", rc.RecallEmbedding[:2], rc.ConsolidatedEmbedding[:2])
	}

	svc := memory.NewService(repo, nil, nil)
	out, err := svc.RecallMemory(ctx, user, m1)
	if err != nil {
		t.Fatalf("recall memory: %v", err)
	}
	if out.Record.Body != body {
		t.Fatalf("record body changed: %q", out.Record.Body)
	}
	if got := countMemoryRows(ctx, t, pool, "SELECT count(*) FROM evolution_history WHERE user_id=$1", user); got == 0 {
		t.Fatal("expected evolution_history rows after novel recall")
	}
	if got := countMemoryRows(ctx, t, pool, "SELECT count(*) FROM memories WHERE user_id=$1 AND version > 0", user); got == 0 {
		t.Fatal("expected reshaped memory version to increment")
	}
}

func basisVector(i int) []float32 {
	v := make([]float32, config.EmbedDim)
	v[i] = 1
	return v
}

func countMemoryRows(ctx context.Context, t *testing.T, pool *pgxpool.Pool, sql, arg string) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(ctx, sql, arg).Scan(&n); err != nil {
		t.Fatalf("count rows: %v", err)
	}
	return n
}
