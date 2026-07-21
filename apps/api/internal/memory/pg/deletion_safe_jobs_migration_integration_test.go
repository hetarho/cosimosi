package pg

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/jackc/pgx/v5"
)

func TestDeletionSafeJobsMigrationScrubsLegacyPayloadsAndRoundTrips(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	conn, err := pool.PgxPool().Acquire(ctx)
	if err != nil {
		t.Fatalf("Acquire failed: %v", err)
	}
	defer conn.Release()

	schema := fmt.Sprintf("test_deletion_safe_jobs_%d", time.Now().UnixNano())
	identifier := pgx.Identifier{schema}.Sanitize()
	if _, err := conn.Exec(ctx, "CREATE SCHEMA "+identifier); err != nil {
		t.Fatalf("create migration schema failed: %v", err)
	}
	defer func() {
		_, _ = conn.Exec(context.Background(), "SET search_path TO public")
		_, _ = conn.Exec(context.Background(), "DROP SCHEMA "+identifier+" CASCADE")
	}()
	if _, err := conn.Exec(ctx, "SET search_path TO "+identifier+", public"); err != nil {
		t.Fatalf("set migration search_path failed: %v", err)
	}

	for _, name := range []string{
		"00002_memory_aggregate_schema.sql",
		"00003_jobs_lease_fence.sql",
		"00006_memory_provenance.sql",
		"00008_release_ledger.sql",
	} {
		if _, err := conn.Exec(ctx, readMemoryMigrationSection(t, "../../../db/migrations/"+name, "up")); err != nil {
			t.Fatalf("apply prerequisite %s failed: %v", name, err)
		}
	}

	deletedAt := time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC)
	if _, err := conn.Exec(ctx, `
		INSERT INTO diaries (id, user_id, body, diary_date)
		VALUES ('d1', 'u1', 'immutable diary body', DATE '2026-06-01');
		INSERT INTO episodic_memories (
			id, user_id, diary_id, name, current_text, mood, valence, arousal,
			intensity, base_strength, created_universe_time, deleted_at
		) VALUES (
			'm1', 'u1', 'd1', 'private memory name', 'private current text',
			'CALM', 0, 0, 0, 0.5, DATE '2026-06-01', TIMESTAMPTZ '2026-06-01 12:00:00+00'
		);
		INSERT INTO neurons (id, user_id, name, neuron_type)
		VALUES ('n1', 'u1', 'private neuron name', 'semantic');
		INSERT INTO memory_provenance (id, user_id, episodic_memory_id, kind, source, text, universe_time)
		VALUES ('p1', 'u1', 'm1', 'reconsolidated', 'user', 'private provenance text', DATE '2026-06-01');
		INSERT INTO jobs (id, user_id, kind, payload, status, next_run_at, lease_generation)
		VALUES
			('j-embed', 'u1', 'embed',
			 '{"neurons":[{"id":"n1","text":"private neuron name"}]}'::jsonb,
			 'pending', now(), 0),
			('j-semantic', 'u1', 'semanticize',
			 '{"memory_id":"m1","name":"private memory name","current_text":"private current text","mood":"CALM","neurons":[{"name":"private neuron name","type":"semantic"}],"kept_stages":["private gist","","",""]}'::jsonb,
			 'running', now(), 5),
			('j-consolidate', 'u1', 'consolidate',
			 '{"from_universe_time":"2026-05-01","to_universe_time":"2026-06-01","memory_ids":["m1"],"neuron_ids":["n1"]}'::jsonb,
			 'done', now(), 1),
			('j-failed', 'u1', 'extract',
			 '{"source":"private failed source"}'::jsonb,
			 'failed', now(), 2);
		INSERT INTO release_groups (id, user_id, diary_id, deleted_at)
		VALUES ('r1', 'u1', 'd1', TIMESTAMPTZ '2026-06-01 12:00:00+00');
		INSERT INTO release_memories (release_id, user_id, episodic_memory_id)
		VALUES ('r1', 'u1', 'm1');
	`); err != nil {
		t.Fatalf("seed legacy queue failed: %v", err)
	}

	up := readMemoryMigrationSection(t, "../../../db/migrations/00011_deletion_safe_jobs.sql", "up")
	down := readMemoryMigrationSection(t, "../../../db/migrations/00011_deletion_safe_jobs.sql", "down")
	if _, err := conn.Exec(ctx, up); err != nil {
		t.Fatalf("deletion-safe migration up failed: %v", err)
	}

	var unsafePayloads int
	if err := conn.QueryRow(ctx, `
		SELECT count(*)
		FROM jobs
		WHERE payload <> '{}'::jsonb
		   OR payload::text ILIKE '%private%'
	`).Scan(&unsafePayloads); err != nil {
		t.Fatalf("inspect scrubbed payloads failed: %v", err)
	}
	if unsafePayloads != 0 {
		t.Fatalf("unsafe payload rows = %d, want 0", unsafePayloads)
	}

	var targetCount int
	if err := conn.QueryRow(ctx, `
		SELECT count(*)
		FROM job_targets
		WHERE user_id = 'u1'
		  AND (
			(target_kind = 'neuron' AND target_id = 'n1' AND expected_revision = 1)
			OR (target_kind = 'episodic_memory' AND target_id = 'm1' AND expected_revision = 1)
			OR (target_kind = 'release_group' AND target_id = 'r1' AND expected_revision IS NULL)
		  )
	`).Scan(&targetCount); err != nil {
		t.Fatalf("inspect migrated targets failed: %v", err)
	}
	if targetCount != 4 { // embed + consolidate neuron, semantic memory, retention release
		t.Fatalf("migrated target rows = %d, want 4", targetCount)
	}

	var status string
	var lease int64
	var cancelledBy *string
	if err := conn.QueryRow(ctx, `SELECT status, lease_generation, cancelled_by_release_id FROM jobs WHERE id = 'j-semantic'`).Scan(&status, &lease, &cancelledBy); err != nil {
		t.Fatalf("inspect migrated running job failed: %v", err)
	}
	if status != "cancelled" || lease != 6 || cancelledBy == nil || *cancelledBy != "r1" {
		t.Fatalf("migrated released job = status %q lease %d cancelled_by %v, want cancelled/6/r1", status, lease, cancelledBy)
	}
	var failedTerminal bool
	if err := conn.QueryRow(ctx, `SELECT terminal_at IS NOT NULL FROM jobs WHERE id = 'j-failed'`).Scan(&failedTerminal); err != nil {
		t.Fatalf("inspect migrated failed job failed: %v", err)
	}
	if !failedTerminal {
		t.Fatal("migrated failed job has no terminal_at")
	}

	var diaryBody, memoryName, currentText, provenanceText string
	if err := conn.QueryRow(ctx, `
		SELECT d.body, em.name, em.current_text, mp.text
		FROM diaries AS d
		JOIN episodic_memories AS em ON em.diary_id = d.id AND em.user_id = d.user_id
		JOIN memory_provenance AS mp ON mp.episodic_memory_id = em.id AND mp.user_id = em.user_id
		WHERE d.user_id = 'u1' AND d.id = 'd1'
	`).Scan(&diaryBody, &memoryName, &currentText, &provenanceText); err != nil {
		t.Fatalf("inspect immutable source rows failed: %v", err)
	}
	if diaryBody != "immutable diary body" || memoryName != "private memory name" || currentText != "private current text" || provenanceText != "private provenance text" {
		t.Fatalf("migration changed source rows: diary=%q name=%q current=%q provenance=%q", diaryBody, memoryName, currentText, provenanceText)
	}

	scope, err := platform.NewUserScope("u1")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	if err := NewStore(conn.Conn()).RequeueReleaseMemoryJobs(ctx, scope, "r1", deletedAt.Add(time.Hour)); err != nil {
		t.Fatalf("requeue migrated released job failed: %v", err)
	}
	if err := conn.QueryRow(ctx, `SELECT status FROM jobs WHERE id = 'j-semantic'`).Scan(&status); err != nil {
		t.Fatalf("inspect requeued migrated job failed: %v", err)
	}
	if status != "pending" {
		t.Fatalf("requeued migrated job status = %q, want pending", status)
	}

	var retentionAt time.Time
	if err := conn.QueryRow(ctx, `
		SELECT next_run_at
		FROM jobs
		WHERE user_id = 'u1' AND kind = 'retention_sweep' AND dedup_key = 'r1'
	`).Scan(&retentionAt); err != nil {
		t.Fatalf("inspect retention backfill failed: %v", err)
	}
	if want := deletedAt.Add(30 * 24 * time.Hour); !retentionAt.Equal(want) {
		t.Fatalf("retention deadline = %v, want %v", retentionAt, want)
	}

	if _, err := conn.Exec(ctx, down); err != nil {
		t.Fatalf("deletion-safe migration down failed: %v", err)
	}
	var revisionColumnPresent bool
	if err := conn.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = current_schema()
			  AND table_name = 'episodic_memories'
			  AND column_name = 'representation_revision'
		)
	`).Scan(&revisionColumnPresent); err != nil {
		t.Fatalf("inspect down schema failed: %v", err)
	}
	if revisionColumnPresent {
		t.Fatal("down migration left representation_revision behind")
	}
	if _, err := conn.Exec(ctx, up); err != nil {
		t.Fatalf("deletion-safe migration second up failed: %v", err)
	}
}

func TestDeletionSafeJobsMigrationRejectsUnresolvableActiveTarget(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	conn, err := pool.PgxPool().Acquire(ctx)
	if err != nil {
		t.Fatalf("Acquire failed: %v", err)
	}
	defer conn.Release()

	schema := fmt.Sprintf("test_deletion_safe_jobs_reject_%d", time.Now().UnixNano())
	identifier := pgx.Identifier{schema}.Sanitize()
	if _, err := conn.Exec(ctx, "CREATE SCHEMA "+identifier); err != nil {
		t.Fatalf("create migration schema failed: %v", err)
	}
	defer func() {
		_, _ = conn.Exec(context.Background(), "SET search_path TO public")
		_, _ = conn.Exec(context.Background(), "DROP SCHEMA "+identifier+" CASCADE")
	}()
	if _, err := conn.Exec(ctx, "SET search_path TO "+identifier+", public"); err != nil {
		t.Fatalf("set migration search_path failed: %v", err)
	}
	for _, name := range []string{
		"00002_memory_aggregate_schema.sql",
		"00003_jobs_lease_fence.sql",
		"00008_release_ledger.sql",
	} {
		if _, err := conn.Exec(ctx, readMemoryMigrationSection(t, "../../../db/migrations/"+name, "up")); err != nil {
			t.Fatalf("apply prerequisite %s failed: %v", name, err)
		}
	}
	if _, err := conn.Exec(ctx, `
		INSERT INTO neurons (id, user_id, name, neuron_type)
		VALUES ('n1', 'u1', 'existing', 'semantic');
		INSERT INTO jobs (id, user_id, kind, payload, status, next_run_at, lease_generation)
		VALUES ('j1', 'u1', 'embed',
			'{"neurons":[{"id":"n1","text":"existing"},{"id":"missing","text":"private missing"}]}'::jsonb,
			'pending', now(), 0);
	`); err != nil {
		t.Fatalf("seed unresolvable job failed: %v", err)
	}

	up := readMemoryMigrationSection(t, "../../../db/migrations/00011_deletion_safe_jobs.sql", "up")
	if _, err := conn.Exec(ctx, up); err == nil || !strings.Contains(err.Error(), "cannot resolve an active embed target") {
		t.Fatalf("migration error = %v, want fail-closed unresolved embed target", err)
	}
	var payload string
	if err := conn.QueryRow(ctx, `SELECT payload::text FROM jobs WHERE id = 'j1'`).Scan(&payload); err != nil {
		t.Fatalf("read rolled-back legacy job failed: %v", err)
	}
	if !strings.Contains(payload, "private missing") {
		t.Fatalf("failed migration did not roll back atomically: payload=%q", payload)
	}
}

func readMemoryMigrationSection(t *testing.T, path, section string) string {
	t.Helper()
	contents, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read migration %s failed: %v", path, err)
	}
	text := string(contents)
	upMarker := "-- +goose Up"
	downMarker := "-- +goose Down"
	up := strings.Index(text, upMarker)
	down := strings.Index(text, downMarker)
	if up < 0 || down < 0 || down <= up {
		t.Fatalf("migration %s has invalid goose sections", path)
	}
	switch section {
	case "up":
		return text[up+len(upMarker) : down]
	case "down":
		return text[down+len(downMarker):]
	default:
		t.Fatalf("unknown migration section %q", section)
		return ""
	}
}
