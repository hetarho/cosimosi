package pg

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

func TestReleaseSealOwnershipMigrationRepairsOnlyReleaseOriginAndRoundTrips(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	conn, err := pool.PgxPool().Acquire(ctx)
	if err != nil {
		t.Fatalf("Acquire failed: %v", err)
	}
	defer conn.Release()

	schema := fmt.Sprintf("test_release_seal_repair_%d", time.Now().UnixNano())
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
		"00011_deletion_safe_jobs.sql",
	} {
		if _, err := conn.Exec(ctx, readMemoryMigrationSection(t, "../../../db/migrations/"+name, "up")); err != nil {
			t.Fatalf("apply prerequisite %s failed: %v", name, err)
		}
	}

	if _, err := conn.Exec(ctx, `
		INSERT INTO diaries (id, user_id, body, diary_date) VALUES
			('d-release-live', 'u1', 'immutable release live', DATE '2026-06-01'),
			('d-live', 'u1', 'immutable live', DATE '2026-06-02'),
			('d-replaced', 'u1', 'immutable replaced', DATE '2026-06-03'),
			('d-valid', 'u1', 'immutable valid', DATE '2026-06-04'),
			('d-retained', 'u1', 'immutable retained', DATE '2026-06-05'),
			('d-retained-outside', 'u1', 'immutable retained outside', DATE '2026-06-06');

		INSERT INTO episodic_memories (
			id, user_id, diary_id, name, current_text, mood, valence, arousal,
			intensity, base_strength, created_universe_time, deleted_at
		) VALUES
			('m-release-live', 'u1', 'd-release-live', 'release live', 'source one', 'CALM', 0, 0, 0, 0.5, DATE '2026-06-01', TIMESTAMPTZ '2026-06-10 00:00:00+00'),
			('m-live', 'u1', 'd-live', 'live', 'source two', 'CALM', 0, 0, 0, 0.5, DATE '2026-06-02', NULL),
			('m-replaced', 'u1', 'd-replaced', 'replaced', 'source three', 'CALM', 0, 0, 0, 0.5, DATE '2026-06-03', TIMESTAMPTZ '2026-06-11 00:00:00+00'),
			('m-valid', 'u1', 'd-valid', 'valid', 'source four', 'CALM', 0, 0, 0, 0.5, DATE '2026-06-04', TIMESTAMPTZ '2026-06-12 00:00:00+00'),
			('m-retained', 'u1', 'd-retained', 'retained', 'source five', 'CALM', 0, 0, 0, 0.5, DATE '2026-06-05', TIMESTAMPTZ '2026-06-13 00:00:00+00'),
			('m-retained-outside', 'u1', 'd-retained-outside', 'outside', 'source six', 'CALM', 0, 0, 0, 0.5, DATE '2026-06-06', TIMESTAMPTZ '2026-06-14 00:00:00+00');

		INSERT INTO neurons (id, user_id, name, neuron_type, sealed_at) VALUES
			('n-repair-live', 'u1', 'repair live', 'semantic', TIMESTAMPTZ '2026-06-10 00:00:00+00'),
			('n-letgo-replaced', 'u1', 'letgo replaced', 'semantic', TIMESTAMPTZ '2026-06-20 00:00:00+00'),
			('n-letgo-only', 'u1', 'letgo only', 'semantic', TIMESTAMPTZ '2026-06-21 00:00:00+00'),
			('n-valid-release', 'u1', 'valid release', 'semantic', TIMESTAMPTZ '2026-06-12 00:00:00+00'),
			('n-repair-retained', 'u1', 'repair retained', 'semantic', TIMESTAMPTZ '2026-06-13 00:00:00+00');

		INSERT INTO neuron_activations (episodic_memory_id, neuron_id, user_id, weight) VALUES
			('m-release-live', 'n-repair-live', 'u1', 1),
			('m-live', 'n-repair-live', 'u1', 1),
			('m-replaced', 'n-letgo-replaced', 'u1', 1),
			('m-live', 'n-letgo-replaced', 'u1', 1),
			('m-live', 'n-letgo-only', 'u1', 1),
			('m-valid', 'n-valid-release', 'u1', 1),
			('m-retained', 'n-repair-retained', 'u1', 1),
			('m-retained-outside', 'n-repair-retained', 'u1', 1);

		INSERT INTO release_groups (id, user_id, diary_id, deleted_at) VALUES
			('r-live', 'u1', 'd-release-live', TIMESTAMPTZ '2026-06-10 00:00:00+00'),
			('r-replaced', 'u1', 'd-replaced', TIMESTAMPTZ '2026-06-11 00:00:00+00'),
			('r-valid', 'u1', 'd-valid', TIMESTAMPTZ '2026-06-12 00:00:00+00'),
			('r-retained', 'u1', 'd-retained', TIMESTAMPTZ '2026-06-13 00:00:00+00');
		INSERT INTO release_memories (release_id, user_id, episodic_memory_id) VALUES
			('r-live', 'u1', 'm-release-live'),
			('r-replaced', 'u1', 'm-replaced'),
			('r-valid', 'u1', 'm-valid'),
			('r-retained', 'u1', 'm-retained');
		INSERT INTO release_sealed_neurons (release_id, user_id, neuron_id) VALUES
			('r-live', 'u1', 'n-repair-live'),
			('r-replaced', 'u1', 'n-letgo-replaced'),
			('r-valid', 'u1', 'n-valid-release'),
			('r-retained', 'u1', 'n-repair-retained');

		INSERT INTO memory_provenance (id, user_id, episodic_memory_id, kind, source, text, universe_time)
		VALUES ('p1', 'u1', 'm-release-live', 'reconsolidated', 'user', 'immutable provenance', DATE '2026-06-01');
	`); err != nil {
		t.Fatalf("seed legacy release ownership failed: %v", err)
	}

	up := readMemoryMigrationSection(t, "../../../db/migrations/00012_release_seal_ownership_repair.sql", "up")
	down := readMemoryMigrationSection(t, "../../../db/migrations/00012_release_seal_ownership_repair.sql", "down")
	if _, err := conn.Exec(ctx, up); err != nil {
		t.Fatalf("release-seal migration up failed: %v", err)
	}

	assertSeal := func(id string, want *time.Time) {
		t.Helper()
		var got *time.Time
		if err := conn.QueryRow(ctx, `SELECT sealed_at FROM neurons WHERE user_id = 'u1' AND id = $1`, id).Scan(&got); err != nil {
			t.Fatalf("read seal %s failed: %v", id, err)
		}
		if want == nil && got != nil || want != nil && (got == nil || !got.Equal(*want)) {
			t.Fatalf("seal %s = %v, want %v", id, got, want)
		}
	}
	replacedAt := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	letGoAt := time.Date(2026, 6, 21, 0, 0, 0, 0, time.UTC)
	validAt := time.Date(2026, 6, 12, 0, 0, 0, 0, time.UTC)
	assertSeal("n-repair-live", nil)
	assertSeal("n-letgo-replaced", &replacedAt)
	assertSeal("n-letgo-only", &letGoAt)
	assertSeal("n-valid-release", &validAt)
	assertSeal("n-repair-retained", nil)

	var effectCount int
	if err := conn.QueryRow(ctx, `
		SELECT count(*) FROM release_sealed_neurons
		WHERE neuron_id IN ('n-repair-live', 'n-letgo-replaced', 'n-repair-retained')
	`).Scan(&effectCount); err != nil {
		t.Fatalf("count repaired effects failed: %v", err)
	}
	if effectCount != 0 {
		t.Fatalf("repaired/stale release effects = %d, want 0", effectCount)
	}
	var validEffectAt time.Time
	if err := conn.QueryRow(ctx, `SELECT sealed_at FROM release_sealed_neurons WHERE neuron_id = 'n-valid-release'`).Scan(&validEffectAt); err != nil {
		t.Fatalf("read retained valid effect failed: %v", err)
	}
	if !validEffectAt.Equal(validAt) {
		t.Fatalf("valid effect timestamp = %v, want %v", validEffectAt, validAt)
	}

	var repairJobs int
	if err := conn.QueryRow(ctx, `
		SELECT count(*)
		FROM jobs AS j
		JOIN job_targets AS jt ON jt.job_id = j.id AND jt.user_id = j.user_id
		WHERE j.user_id = 'u1'
		  AND j.kind = 'embed'
		  AND j.payload = '{}'::jsonb
		  AND jt.target_kind = 'neuron'
		  AND jt.target_id = 'n-repair-live'
		  AND jt.expected_revision = 1
	`).Scan(&repairJobs); err != nil {
		t.Fatalf("inspect repair embed job failed: %v", err)
	}
	if repairJobs != 1 {
		t.Fatalf("live repaired embed jobs = %d, want 1", repairJobs)
	}
	if err := conn.QueryRow(ctx, `
		SELECT count(*) FROM job_targets
		WHERE target_id = 'n-repair-retained'
	`).Scan(&repairJobs); err != nil {
		t.Fatalf("inspect retained-only repair jobs failed: %v", err)
	}
	if repairJobs != 0 {
		t.Fatalf("retained-only repaired neuron jobs = %d, want 0", repairJobs)
	}

	var diaryBody, memoryText, provenanceText string
	if err := conn.QueryRow(ctx, `
		SELECT d.body, em.current_text, mp.text
		FROM diaries AS d
		JOIN episodic_memories AS em ON em.diary_id = d.id AND em.user_id = d.user_id
		JOIN memory_provenance AS mp ON mp.episodic_memory_id = em.id AND mp.user_id = em.user_id
		WHERE d.id = 'd-release-live' AND d.user_id = 'u1'
	`).Scan(&diaryBody, &memoryText, &provenanceText); err != nil {
		t.Fatalf("inspect immutable source rows failed: %v", err)
	}
	if diaryBody != "immutable release live" || memoryText != "source one" || provenanceText != "immutable provenance" {
		t.Fatalf("migration changed source rows: %q / %q / %q", diaryBody, memoryText, provenanceText)
	}

	if _, err := conn.Exec(ctx, down); err != nil {
		t.Fatalf("release-seal migration down failed: %v", err)
	}
	var columnPresent bool
	if err := conn.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = current_schema()
			  AND table_name = 'release_sealed_neurons'
			  AND column_name = 'sealed_at'
		)
	`).Scan(&columnPresent); err != nil {
		t.Fatalf("inspect down schema failed: %v", err)
	}
	if columnPresent {
		t.Fatal("down migration left release seal ownership timestamp behind")
	}
	if _, err := conn.Exec(ctx, up); err != nil {
		t.Fatalf("release-seal migration second up failed: %v", err)
	}
}
