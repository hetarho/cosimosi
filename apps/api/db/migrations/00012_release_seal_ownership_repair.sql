-- +goose Up
-- Release-origin ownership is already represented by release_sealed_neurons. Persist the exact seal
-- timestamp as an ownership fence so Restore can distinguish the release effect it may reverse from a
-- different, permanent LetGo seal. Legacy Release used one `deleted_at` value for both the group and
-- neuron seal, so the group timestamp is the historical source of truth; copying the current neuron
-- timestamp could misclassify a later LetGo replacement as release-owned.
ALTER TABLE release_sealed_neurons
ADD COLUMN sealed_at TIMESTAMPTZ;

UPDATE release_sealed_neurons AS rsn
SET sealed_at = rg.deleted_at
FROM release_groups AS rg
WHERE rg.id = rsn.release_id
  AND rg.user_id = rsn.user_id;

DELETE FROM release_sealed_neurons
WHERE sealed_at IS NULL;

ALTER TABLE release_sealed_neurons
ALTER COLUMN sealed_at SET NOT NULL;

CREATE INDEX release_sealed_neurons_user_neuron_idx
ON release_sealed_neurons (user_id, neuron_id);

-- A mismatched current timestamp means the historical release effect no longer owns the seal (for
-- example, a permanent LetGo replacement). Retire that stale effect without changing the neuron.
DELETE FROM release_sealed_neurons AS rsn
USING neurons AS n
WHERE n.id = rsn.neuron_id
  AND n.user_id = rsn.user_id
  AND n.sealed_at IS DISTINCT FROM rsn.sealed_at;

DELETE FROM release_sealed_neurons AS rsn
WHERE NOT EXISTS (
    SELECT 1
    FROM neurons AS n
    WHERE n.id = rsn.neuron_id
      AND n.user_id = rsn.user_id
);

-- Repair the pre-job-68 overlap failure non-destructively. A retained activation outside the effect's
-- own release set makes that release-origin seal invalid, even when the outside owner is itself
-- soft-deleted and still inside retention. Only a current timestamp-matched release seal is cleared;
-- LetGo-only and replacement seals are preserved. Diary bodies, provenance, and history are untouched.
-- A repaired neuron with a live owner also receives identity/revision-only embed work. A legacy worker
-- may have terminally skipped its original job while the neuron was sealed; publishing the job in this
-- same migration transaction restores derived completeness without copying user-authored text.
-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        WITH repair_targets AS (
            SELECT DISTINCT n.id, n.user_id
            FROM neurons AS n
            JOIN release_sealed_neurons AS rsn
              ON rsn.user_id = n.user_id
             AND rsn.neuron_id = n.id
             AND rsn.sealed_at = n.sealed_at
            WHERE n.sealed_at IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM neuron_activations AS outside
                  WHERE outside.user_id = rsn.user_id
                    AND outside.neuron_id = rsn.neuron_id
                    AND NOT EXISTS (
                        SELECT 1
                        FROM release_memories AS own
                        WHERE own.user_id = rsn.user_id
                          AND own.release_id = rsn.release_id
                          AND own.episodic_memory_id = outside.episodic_memory_id
                    )
              )
              AND EXISTS (
                  SELECT 1
                  FROM neuron_activations AS live_activation
                  JOIN episodic_memories AS live_memory
                    ON live_memory.id = live_activation.episodic_memory_id
                   AND live_memory.user_id = live_activation.user_id
                  WHERE live_activation.user_id = n.user_id
                    AND live_activation.neuron_id = n.id
                    AND live_memory.deleted_at IS NULL
              )
        )
        SELECT 1
        FROM repair_targets AS target
        JOIN jobs AS existing
          ON existing.id = 'release-seal-repair:' || target.id
    ) THEN
        RAISE EXCEPTION 'release seal ownership repair found an embed job id collision';
    END IF;
END
$$;
-- +goose StatementEnd

WITH repair_targets AS (
    SELECT DISTINCT n.id, n.user_id, n.representation_revision
    FROM neurons AS n
    JOIN release_sealed_neurons AS rsn
      ON rsn.user_id = n.user_id
     AND rsn.neuron_id = n.id
     AND rsn.sealed_at = n.sealed_at
    WHERE n.sealed_at IS NOT NULL
      AND EXISTS (
          SELECT 1
          FROM neuron_activations AS outside
          WHERE outside.user_id = rsn.user_id
            AND outside.neuron_id = rsn.neuron_id
            AND NOT EXISTS (
                SELECT 1
                FROM release_memories AS own
                WHERE own.user_id = rsn.user_id
                  AND own.release_id = rsn.release_id
                  AND own.episodic_memory_id = outside.episodic_memory_id
            )
      )
      AND EXISTS (
          SELECT 1
          FROM neuron_activations AS live_activation
          JOIN episodic_memories AS live_memory
            ON live_memory.id = live_activation.episodic_memory_id
           AND live_memory.user_id = live_activation.user_id
          WHERE live_activation.user_id = n.user_id
            AND live_activation.neuron_id = n.id
            AND live_memory.deleted_at IS NULL
      )
)
INSERT INTO jobs (
    id, user_id, kind, payload, status, attempts, next_run_at, created_at,
    lease_generation, dedup_key
)
SELECT
    'release-seal-repair:' || target.id,
    target.user_id,
    'embed',
    '{}'::jsonb,
    'pending',
    0,
    statement_timestamp(),
    statement_timestamp(),
    0,
    'release-seal-repair:' || target.id || ':' || target.representation_revision::text
FROM repair_targets AS target
ON CONFLICT (user_id, kind, dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;

WITH repair_targets AS (
    SELECT DISTINCT n.id, n.user_id, n.representation_revision
    FROM neurons AS n
    JOIN release_sealed_neurons AS rsn
      ON rsn.user_id = n.user_id
     AND rsn.neuron_id = n.id
     AND rsn.sealed_at = n.sealed_at
    WHERE n.sealed_at IS NOT NULL
      AND EXISTS (
          SELECT 1
          FROM neuron_activations AS outside
          WHERE outside.user_id = rsn.user_id
            AND outside.neuron_id = rsn.neuron_id
            AND NOT EXISTS (
                SELECT 1
                FROM release_memories AS own
                WHERE own.user_id = rsn.user_id
                  AND own.release_id = rsn.release_id
                  AND own.episodic_memory_id = outside.episodic_memory_id
            )
      )
      AND EXISTS (
          SELECT 1
          FROM neuron_activations AS live_activation
          JOIN episodic_memories AS live_memory
            ON live_memory.id = live_activation.episodic_memory_id
           AND live_memory.user_id = live_activation.user_id
          WHERE live_activation.user_id = n.user_id
            AND live_activation.neuron_id = n.id
            AND live_memory.deleted_at IS NULL
      )
)
INSERT INTO job_targets (job_id, user_id, target_kind, target_id, expected_revision)
SELECT
    job.id,
    target.user_id,
    'neuron',
    target.id,
    target.representation_revision
FROM repair_targets AS target
JOIN jobs AS job
  ON job.user_id = target.user_id
 AND job.kind = 'embed'
 AND job.dedup_key = 'release-seal-repair:' || target.id || ':' || target.representation_revision::text
ON CONFLICT DO NOTHING;

UPDATE neurons AS n
SET sealed_at = NULL
WHERE n.sealed_at IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM release_sealed_neurons AS rsn
      WHERE rsn.user_id = n.user_id
        AND rsn.neuron_id = n.id
        AND rsn.sealed_at = n.sealed_at
        AND EXISTS (
            SELECT 1
            FROM neuron_activations AS outside
            WHERE outside.user_id = rsn.user_id
              AND outside.neuron_id = rsn.neuron_id
              AND NOT EXISTS (
                  SELECT 1
                  FROM release_memories AS own
                  WHERE own.user_id = rsn.user_id
                    AND own.release_id = rsn.release_id
                    AND own.episodic_memory_id = outside.episodic_memory_id
              )
        )
  );

DELETE FROM release_sealed_neurons AS rsn
USING neurons AS n
WHERE n.id = rsn.neuron_id
  AND n.user_id = rsn.user_id
  AND n.sealed_at IS NULL;

-- +goose Down
-- The schema change is reversible. The ownership repair intentionally is not: re-sealing a neuron that
-- a live memory activates would recreate the corruption this migration removed.
DROP INDEX IF EXISTS release_sealed_neurons_user_neuron_idx;

ALTER TABLE release_sealed_neurons
DROP COLUMN IF EXISTS sealed_at;
