//go:build integration

// Integration test for the embedding worker against a live Postgres+pgvector.
// Opt-in (build tag `integration`) because it needs a database — it is excluded
// from the default `go test`. Run it on the compose network:
//
//	docker run --rm --network cosimosi_default \
//	  -e DATABASE_URL=postgres://cosimosi:cosimosi@postgres:5432/cosimosi?sslmode=disable \
//	  -v ${PWD}/backend:/app -w /app golang:1.26 \
//	  go test -tags integration -run Integration -v ./internal/job/
//
// It exercises the production worker code path (mock embedder → real SQL: KNN over
// HNSW, UNNEST upsert, FOR UPDATE SKIP LOCKED claim), covering acceptance
// 1.1–1.5, 3.1, 3.2, 3.3. It seeds rows under unique throwaway user ids and
// cleans only those up afterward (test hygiene — the constitution constrains the
// app, not test fixtures).
package job

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/cosimosi/backend/internal/ai"
	"github.com/cosimosi/backend/internal/db/gen"
	"github.com/cosimosi/backend/internal/platform/config"
	"github.com/cosimosi/backend/internal/platform/postgres"
)

func TestWorkerPipelineIntegration(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := postgres.New(ctx, dsn) // registers pgvector types on each conn
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close() // registered first → runs LAST, after the cleanup defer below

	q := gen.New(pool)
	suffix := strconv.FormatInt(time.Now().UnixNano(), 36)
	userA := "itest-A-" + suffix
	userB := "itest-B-" + suffix
	today := pgtype.Date{Time: time.Now().UTC(), Valid: true}
	body := "오늘은 결정론적 링크를 위한 동일한 일기 본문입니다 — identical body"

	memA1, memA2, memB1 := "mem-A1-"+suffix, "mem-A2-"+suffix, "mem-B1-"+suffix
	type seed struct{ rec, mem, job, user string }
	seeds := []seed{
		{"rec-A1-" + suffix, memA1, "job-A1-" + suffix, userA},
		{"rec-A2-" + suffix, memA2, "job-A2-" + suffix, userA},
		{"rec-B1-" + suffix, memB1, "job-B1-" + suffix, userB},
	}
	for _, s := range seeds {
		if err := q.InsertRecord(ctx, gen.InsertRecordParams{
			ID: s.rec, UserID: s.user, Body: body, EntryDate: today,
		}); err != nil {
			t.Fatalf("insert record: %v", err)
		}
		if _, err := q.InsertMemory(ctx, gen.InsertMemoryParams{ID: s.mem, UserID: s.user, RecordID: s.rec}); err != nil {
			t.Fatalf("insert memory: %v", err)
		}
		memID := s.mem
		if err := q.EnqueueEmbedJob(ctx, gen.EnqueueEmbedJobParams{ID: s.job, MemoryID: &memID}); err != nil {
			t.Fatalf("enqueue job: %v", err)
		}
	}
	// Registered after defer pool.Close() so LIFO runs this FIRST (while the pool
	// is still open) — t.Cleanup would instead run after Close and silently no-op.
	defer cleanup(ctx, pool, userA, userB)

	w := NewWorker(NewRepository(pool), NewGraphStore(pool), ai.NewMockEmbedder(config.EmbedDim), ai.NoopExtractor{}, ai.NoopRewriter{}, slog.Default())

	// Drain the whole queue (our 3 jobs plus any pre-existing pending ones).
	for i := 0; i < 1000; i++ {
		if !w.processOne(ctx) {
			break
		}
	}

	// 1.2/3.1: every test memory got an embedding (keyless mock).
	if got := countRows(ctx, pool, "SELECT count(*) FROM embeddings WHERE user_id=$1", userA); got != 2 {
		t.Errorf("userA embeddings = %d, want 2", got)
	}
	if got := countRows(ctx, pool, "SELECT count(*) FROM embeddings WHERE user_id=$1", userB); got != 1 {
		t.Errorf("userB embeddings = %d, want 1", got)
	}

	// 1.3/1.4/3.3: the two identical-body A stars are linked; the row is a_id<b_id,
	// weight = semanticWeightCap (cos_sim 1.0 + same-day temporal 0.3 → clamp 1.0
	// → capped below the intra-entry 0.8, spec 21), user_id=A. No cross-user leak:
	// B (single, isolated) has 0 links.
	links := listLinks(ctx, pool, userA)
	if len(links) != 1 {
		t.Fatalf("userA links = %d, want 1", len(links))
	}
	l := links[0]
	if l.aID >= l.bID {
		t.Errorf("link not normalized a<b: %s,%s", l.aID, l.bID)
	}
	if !(l.aID == minStr(memA1, memA2) && l.bID == maxStr(memA1, memA2)) {
		t.Errorf("link endpoints = (%s,%s), want sorted(%s,%s)", l.aID, l.bID, memA1, memA2)
	}
	if l.weight < semanticWeightCap-0.001 || l.weight > semanticWeightCap+0.001 {
		t.Errorf("link weight = %f, want semantic cap %f", l.weight, semanticWeightCap)
	}
	if got := len(listLinks(ctx, pool, userB)); got != 0 {
		t.Errorf("userB links = %d, want 0 (isolated star — constitution §2/3.2)", got)
	}

	// 1.5: the three jobs completed.
	for _, s := range seeds {
		if st := scanString(ctx, pool, "SELECT status FROM jobs WHERE id=$1", s.job); st != "done" {
			t.Errorf("job %s status = %q, want done", s.job, st)
		}
	}
}

// TestExtractFanOutIntegration: an extract job fans one multi-scene diary out
// into N fragment stars (spec 21) — N memories sharing the record_id, one embed
// job each (drained to embeddings), all fragment pairs bound with intra_entry
// w=0.8, the original record untouched, and a re-run of the extract path a
// no-op (idempotent).
func TestExtractFanOutIntegration(t *testing.T) {
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
	user := "itest-F-" + suffix
	rec, jobID := "rec-F-"+suffix, "job-F-"+suffix
	today := pgtype.Date{Time: time.Now().UTC(), Valid: true}
	// Three blank-line paragraphs → MockExtractor splits into 3 segments.
	body := "아침 산책이 좋았다.\n\n낮 회의가 뒤집혔다.\n\n밤 통화로 풀렸다."

	if err := q.InsertRecord(ctx, gen.InsertRecordParams{ID: rec, UserID: user, Body: body, EntryDate: today}); err != nil {
		t.Fatalf("insert record: %v", err)
	}
	recID, userID := rec, user
	if err := q.EnqueueExtractJob(ctx, gen.EnqueueExtractJobParams{ID: jobID, RecordID: &recID, UserID: &userID}); err != nil {
		t.Fatalf("enqueue extract job: %v", err)
	}
	defer cleanup(ctx, pool, user)

	w := NewWorker(NewRepository(pool), NewGraphStore(pool), ai.NewMockEmbedder(config.EmbedDim), ai.NewMockExtractor(), ai.NoopRewriter{}, slog.Default())
	for i := 0; i < 1000; i++ {
		if !w.processOne(ctx) {
			break
		}
	}

	// 1.1: 3 fragment stars share the record.
	frags, err := q.ListMemoryIDsByRecord(ctx, rec)
	if err != nil || len(frags) != 3 {
		t.Fatalf("fragments = %v (err %v), want 3", frags, err)
	}
	// 1.2: each fragment embedded separately.
	if got := countRows(ctx, pool, "SELECT count(*) FROM embeddings WHERE user_id=$1", user); got != 3 {
		t.Errorf("embeddings = %d, want 3", got)
	}
	// 1.3: all 3 pairs bound intra_entry at 0.8 (semantic links may also exist, capped below).
	if got := countRows(ctx, pool,
		"SELECT count(*) FROM memory_links WHERE user_id=$1 AND link_type='intra_entry' AND weight::numeric = 0.8", user); got != 3 {
		t.Errorf("intra_entry links = %d, want 3", got)
	}
	// 1.5: exactly one record row, body unchanged (constitution §1).
	if got := scanString(ctx, pool, "SELECT body FROM records WHERE id=$1", rec); got != body {
		t.Errorf("record body changed: %q", got)
	}
	// Idempotency: a second fan-out for the same record returns the existing ids.
	again, err := NewGraphStore(pool).FanOutFragments(ctx, rec, user, []Segment{{Index: 0, Text: "dup"}})
	if err != nil || len(again) != 3 {
		t.Fatalf("re-fan-out = %v (err %v), want existing 3 ids", again, err)
	}
	if got := countRows(ctx, pool, "SELECT count(*) FROM memories WHERE record_id=$1", rec); got != 3 {
		t.Errorf("memories after re-fan-out = %d, want 3 (no duplicates)", got)
	}
}

// TestClaimReclaimsStaleRunningIntegration: a job stranded in 'running' by a
// crashed/killed worker is reclaimed once it's older than the lease, without
// bumping attempts; a fresh 'running' job is left alone. It uses a unique kind so
// the live 'embed' worker never races it.
func TestClaimReclaimsStaleRunningIntegration(t *testing.T) {
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
	kind := "embed-reclaim-" + suffix // unique → invisible to the live 'embed' worker
	today := pgtype.Date{Time: time.Now().UTC(), Valid: true}
	defer cleanup(ctx, pool, user)

	seedRunningJob := func(tag, updatedAtSQL string) string {
		rec, mem, jobID := "rec-"+tag+suffix, "mem-"+tag+suffix, "job-"+tag+suffix
		if err := q.InsertRecord(ctx, gen.InsertRecordParams{ID: rec, UserID: user, Body: "x", EntryDate: today}); err != nil {
			t.Fatalf("insert record: %v", err)
		}
		if _, err := q.InsertMemory(ctx, gen.InsertMemoryParams{ID: mem, UserID: user, RecordID: rec}); err != nil {
			t.Fatalf("insert memory: %v", err)
		}
		if _, err := pool.Exec(ctx,
			"INSERT INTO jobs (id, memory_id, kind, status, updated_at) VALUES ($1,$2,$3,'running',"+updatedAtSQL+")",
			jobID, mem, kind); err != nil {
			t.Fatalf("insert running job: %v", err)
		}
		return jobID
	}

	staleJob := seedRunningJob("stale-", "now() - interval '10 minutes'")
	freshJob := seedRunningJob("fresh-", "now()")
	_ = freshJob

	// The stale 'running' job is reclaimed (lease 120s); attempts stay 0.
	row, err := q.ClaimJob(ctx, gen.ClaimJobParams{Kind: kind, LeaseSeconds: claimLeaseSeconds})
	if err != nil {
		t.Fatalf("expected to reclaim stale running job, got err: %v", err)
	}
	if row.ID != staleJob {
		t.Fatalf("reclaimed %s, want stale job %s", row.ID, staleJob)
	}
	if row.Attempts != 0 {
		t.Errorf("reclaim bumped attempts to %d, want 0 (interruption is not the job's fault)", row.Attempts)
	}

	// Nothing else is claimable: the fresh 'running' job is within lease, and the
	// just-reclaimed one now has a fresh updated_at.
	if _, err := q.ClaimJob(ctx, gen.ClaimJobParams{Kind: kind, LeaseSeconds: claimLeaseSeconds}); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("expected no more claimable jobs, got: %v", err)
	}
}

type linkRow struct {
	aID, bID string
	weight   float64
}

func listLinks(ctx context.Context, pool *pgxpool.Pool, userID string) []linkRow {
	rows, err := pool.Query(ctx, "SELECT a_id, b_id, weight FROM memory_links WHERE user_id=$1", userID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []linkRow
	for rows.Next() {
		var r linkRow
		var w float32
		if err := rows.Scan(&r.aID, &r.bID, &w); err != nil {
			return out
		}
		r.weight = float64(w)
		out = append(out, r)
	}
	return out
}

func countRows(ctx context.Context, pool *pgxpool.Pool, sql, arg string) int {
	var n int
	_ = pool.QueryRow(ctx, sql, arg).Scan(&n)
	return n
}

func scanString(ctx context.Context, pool *pgxpool.Pool, sql, arg string) string {
	var s string
	_ = pool.QueryRow(ctx, sql, arg).Scan(&s)
	return s
}

func cleanup(ctx context.Context, pool *pgxpool.Pool, users ...string) {
	for _, u := range users {
		// Order respects FKs: links/embeddings/jobs → memories → records. Extract
		// jobs have memory_id NULL (spec 21) — they are keyed by record_id instead.
		_, _ = pool.Exec(ctx, "DELETE FROM memory_links WHERE user_id=$1", u)
		_, _ = pool.Exec(ctx, "DELETE FROM embeddings WHERE user_id=$1", u)
		_, _ = pool.Exec(ctx, "DELETE FROM jobs WHERE memory_id IN (SELECT id FROM memories WHERE user_id=$1)", u)
		_, _ = pool.Exec(ctx, "DELETE FROM jobs WHERE record_id IN (SELECT id FROM records WHERE user_id=$1)", u)
		_, _ = pool.Exec(ctx, "DELETE FROM memories WHERE user_id=$1", u)
		_, _ = pool.Exec(ctx, "DELETE FROM records WHERE user_id=$1", u)
	}
}

func minStr(a, b string) string {
	if a < b {
		return a
	}
	return b
}

func maxStr(a, b string) string {
	if a > b {
		return a
	}
	return b
}
