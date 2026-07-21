-- +goose Up
-- Queue privacy and retention safety (job 67). This migration is deliberately
-- fail-closed for active legacy rows: source-bearing payloads are converted to
-- indexed identities/revisions in one transaction, never copied forward.
LOCK TABLE jobs IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE episodic_memories IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE neurons IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE neuron_activations IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE release_groups IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE episodic_memories
    ADD COLUMN representation_revision BIGINT NOT NULL DEFAULT 1,
    ADD CONSTRAINT episodic_memories_representation_revision_positive
        CHECK (representation_revision > 0);

ALTER TABLE neurons
    ADD COLUMN representation_revision BIGINT NOT NULL DEFAULT 1,
    ADD CONSTRAINT neurons_representation_revision_positive
        CHECK (representation_revision > 0);

ALTER TABLE jobs
    ADD COLUMN dedup_key TEXT,
    ADD COLUMN terminal_at TIMESTAMPTZ,
    ADD COLUMN cancelled_by_release_id TEXT,
    ADD CONSTRAINT jobs_id_user_id_unique UNIQUE (id, user_id);

CREATE TABLE job_targets (
    job_id            TEXT NOT NULL,
    user_id           TEXT NOT NULL,
    target_kind       TEXT NOT NULL,
    target_id         TEXT NOT NULL,
    expected_revision BIGINT,
    PRIMARY KEY (job_id, target_kind, target_id),
    CONSTRAINT job_targets_job_user_fk
        FOREIGN KEY (job_id, user_id)
        REFERENCES jobs (id, user_id)
        ON DELETE CASCADE,
    CONSTRAINT job_targets_id_nonempty CHECK (btrim(target_id) <> ''),
    CONSTRAINT job_targets_kind_revision_check CHECK (
        (target_kind = 'release_group' AND expected_revision IS NULL)
        OR (
            target_kind IN ('episodic_memory', 'neuron')
            AND expected_revision > 0
        )
    )
);

CREATE INDEX job_targets_user_target_idx
    ON job_targets (user_id, target_kind, target_id, job_id);

CREATE UNIQUE INDEX jobs_user_kind_dedup_key_unique
    ON jobs (user_id, kind, dedup_key)
    WHERE dedup_key IS NOT NULL;

CREATE INDEX jobs_due_idx
    ON jobs (next_run_at, created_at, id)
    WHERE status IN ('pending', 'running');

CREATE INDEX jobs_terminal_idx
    ON jobs (terminal_at, id)
    WHERE status IN ('done', 'failed', 'cancelled');

-- Validate active legacy shapes without ever putting payload text in an error.
-- Unknown/malformed terminal rows are safe to scrub because they cannot execute;
-- an active row aborts the migration instead of silently losing live work.
-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM jobs
        WHERE status NOT IN ('pending', 'running', 'done', 'failed')
    ) THEN
        RAISE EXCEPTION 'deletion-safe queue migration found an unknown job status';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jobs
        WHERE status IN ('pending', 'running')
          AND kind NOT IN ('embed', 'semanticize', 'consolidate')
    ) THEN
        RAISE EXCEPTION 'deletion-safe queue migration found an unsupported active job kind';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jobs
        WHERE status IN ('pending', 'running')
          AND jsonb_typeof(payload) IS DISTINCT FROM 'object'
    ) THEN
        RAISE EXCEPTION 'deletion-safe queue migration found a malformed active payload';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jobs AS j
        WHERE j.status IN ('pending', 'running')
          AND j.kind = 'embed'
          AND (
              jsonb_typeof(j.payload -> 'neurons') IS DISTINCT FROM 'array'
              OR jsonb_array_length(j.payload -> 'neurons') = 0
              OR EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(j.payload -> 'neurons') AS item
                  WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
                     OR jsonb_typeof(item -> 'id') IS DISTINCT FROM 'string'
                     OR btrim(item ->> 'id') = ''
              )
              OR (
                  SELECT count(*)
                  FROM jsonb_array_elements(j.payload -> 'neurons') AS item
              ) <> (
                  SELECT count(DISTINCT item ->> 'id')
                  FROM jsonb_array_elements(j.payload -> 'neurons') AS item
              )
          )
    ) THEN
        RAISE EXCEPTION 'deletion-safe queue migration cannot map an active embed job';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jobs AS j
        CROSS JOIN LATERAL jsonb_array_elements(j.payload -> 'neurons') AS item
        WHERE j.status IN ('pending', 'running')
          AND j.kind = 'embed'
          AND NOT EXISTS (
              SELECT 1 FROM neurons AS n
              WHERE n.id = item ->> 'id' AND n.user_id = j.user_id
          )
    ) THEN
        RAISE EXCEPTION 'deletion-safe queue migration cannot resolve an active embed target';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jobs AS j
        WHERE j.status IN ('pending', 'running')
          AND j.kind = 'semanticize'
          AND (
              jsonb_typeof(j.payload -> 'memory_id') IS DISTINCT FROM 'string'
              OR btrim(j.payload ->> 'memory_id') = ''
          )
    ) THEN
        RAISE EXCEPTION 'deletion-safe queue migration cannot map an active semanticize job';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jobs AS j
        WHERE j.status IN ('pending', 'running')
          AND j.kind = 'semanticize'
          AND NOT EXISTS (
              SELECT 1 FROM episodic_memories AS em
              WHERE em.id = j.payload ->> 'memory_id' AND em.user_id = j.user_id
          )
    ) THEN
        RAISE EXCEPTION 'deletion-safe queue migration cannot resolve an active semanticize target';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jobs AS j
        WHERE j.status IN ('pending', 'running')
          AND j.kind = 'consolidate'
          AND (
              jsonb_typeof(j.payload -> 'neuron_ids') IS DISTINCT FROM 'array'
              OR EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(j.payload -> 'neuron_ids') AS item
                  WHERE jsonb_typeof(item) IS DISTINCT FROM 'string'
                     OR btrim(item #>> '{}') = ''
              )
              OR (
                  SELECT count(*)
                  FROM jsonb_array_elements(j.payload -> 'neuron_ids') AS item
              ) <> (
                  SELECT count(DISTINCT item #>> '{}')
                  FROM jsonb_array_elements(j.payload -> 'neuron_ids') AS item
              )
          )
    ) THEN
        RAISE EXCEPTION 'deletion-safe queue migration cannot map an active consolidate job';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jobs AS j
        CROSS JOIN LATERAL jsonb_array_elements_text(j.payload -> 'neuron_ids') AS neuron_id
        WHERE j.status IN ('pending', 'running')
          AND j.kind = 'consolidate'
          AND NOT EXISTS (
              SELECT 1 FROM neurons AS n
              WHERE n.id = neuron_id AND n.user_id = j.user_id
          )
    ) THEN
        RAISE EXCEPTION 'deletion-safe queue migration cannot resolve an active consolidate target';
    END IF;
END
$$;
-- +goose StatementEnd

-- Recover only target identity from allowlisted legacy fields. Revisions are
-- rebased to the authoritative migration snapshot; all source strings are
-- discarded below.
INSERT INTO job_targets (job_id, user_id, target_kind, target_id, expected_revision)
SELECT DISTINCT j.id, j.user_id, 'neuron', item ->> 'id', n.representation_revision
FROM jobs AS j
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(j.payload -> 'neurons') = 'array' THEN j.payload -> 'neurons'
        ELSE '[]'::jsonb
    END
) AS item
JOIN neurons AS n
  ON n.id = item ->> 'id'
 AND n.user_id = j.user_id
WHERE j.kind = 'embed'
  AND jsonb_typeof(item) = 'object'
  AND jsonb_typeof(item -> 'id') = 'string'
  AND btrim(item ->> 'id') <> ''
ON CONFLICT DO NOTHING;

INSERT INTO job_targets (job_id, user_id, target_kind, target_id, expected_revision)
SELECT j.id, j.user_id, 'episodic_memory', em.id, em.representation_revision
FROM jobs AS j
JOIN episodic_memories AS em
  ON em.id = j.payload ->> 'memory_id'
 AND em.user_id = j.user_id
WHERE j.kind = 'semanticize'
  AND jsonb_typeof(j.payload -> 'memory_id') = 'string'
ON CONFLICT DO NOTHING;

INSERT INTO job_targets (job_id, user_id, target_kind, target_id, expected_revision)
SELECT DISTINCT j.id, j.user_id, 'neuron', neuron_id, n.representation_revision
FROM jobs AS j
CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
        WHEN jsonb_typeof(j.payload -> 'neuron_ids') = 'array' THEN j.payload -> 'neuron_ids'
        ELSE '[]'::jsonb
    END
) AS neuron_id
JOIN neurons AS n
  ON n.id = neuron_id
 AND n.user_id = j.user_id
WHERE j.kind = 'consolidate'
  AND btrim(neuron_id) <> ''
ON CONFLICT DO NOTHING;

-- An active job with no currently usable effect target is a terminal no-op.
-- Bumping the lease generation fences any worker that was already holding it.
UPDATE jobs AS j
SET status = 'cancelled',
    terminal_at = statement_timestamp(),
    lease_generation = j.lease_generation + 1
WHERE j.status IN ('pending', 'running')
  AND j.kind IN ('embed', 'consolidate')
  AND NOT EXISTS (
      SELECT 1
      FROM job_targets AS jt
      JOIN neurons AS n
        ON n.id = jt.target_id
       AND n.user_id = jt.user_id
       AND n.representation_revision = jt.expected_revision
       AND n.sealed_at IS NULL
      WHERE jt.job_id = j.id
        AND jt.user_id = j.user_id
        AND jt.target_kind = 'neuron'
  );

-- A legacy semanticize for a released memory must be restorable. Fail closed if
-- a soft-deleted active target has no release ledger that can own its cancellation.
-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM jobs AS j
        JOIN job_targets AS jt
          ON jt.job_id = j.id
         AND jt.user_id = j.user_id
         AND jt.target_kind = 'episodic_memory'
        JOIN episodic_memories AS em
          ON em.id = jt.target_id
         AND em.user_id = jt.user_id
        WHERE j.status IN ('pending', 'running')
          AND j.kind = 'semanticize'
          AND em.deleted_at IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM release_memories AS rm
              JOIN release_groups AS rg
                ON rg.id = rm.release_id
               AND rg.user_id = rm.user_id
              WHERE rm.user_id = em.user_id
                AND rm.episodic_memory_id = em.id
          )
    ) THEN
        RAISE EXCEPTION 'deletion-safe queue migration cannot link a released semanticize target';
    END IF;
END
$$;
-- +goose StatementEnd

UPDATE jobs AS j
SET status = 'cancelled',
    terminal_at = statement_timestamp(),
    cancelled_by_release_id = released.release_id,
    lease_generation = j.lease_generation + 1
FROM (
    SELECT jt.job_id, rm.release_id
    FROM job_targets AS jt
    JOIN episodic_memories AS em
      ON em.id = jt.target_id
     AND em.user_id = jt.user_id
     AND em.deleted_at IS NOT NULL
    JOIN release_memories AS rm
      ON rm.user_id = em.user_id
     AND rm.episodic_memory_id = em.id
    JOIN release_groups AS rg
      ON rg.id = rm.release_id
     AND rg.user_id = rm.user_id
    WHERE jt.target_kind = 'episodic_memory'
) AS released
WHERE j.id = released.job_id
  AND j.status IN ('pending', 'running')
  AND j.kind = 'semanticize';

-- No pre-migration running lease is allowed to survive the binary transition.
UPDATE jobs
SET status = 'pending',
    lease_generation = lease_generation + 1,
    next_run_at = LEAST(next_run_at, statement_timestamp())
WHERE status = 'running';

-- Rebuild the entire JSON object from an allowlist (empty today). This scrubs
-- nested and unknown source-bearing fields from pending through failed rows.
UPDATE jobs SET payload = '{}'::jsonb;

UPDATE jobs
SET terminal_at = statement_timestamp()
WHERE status IN ('done', 'failed')
  AND terminal_at IS NULL;

-- Existing releases need the same durable trigger as future Release calls.
-- Thirty days is the historical value at this migration boundary; application
-- writes use the generated release.soft_delete_retention_days constant.
-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM release_groups AS rg
        JOIN jobs AS j ON j.id = 'release-retention:' || rg.id
        WHERE j.user_id <> rg.user_id
           OR j.kind <> 'retention_sweep'
    ) THEN
        RAISE EXCEPTION 'deletion-safe queue migration found a retention job id collision';
    END IF;
END
$$;
-- +goose StatementEnd

INSERT INTO jobs (
    id,
    user_id,
    kind,
    payload,
    status,
    attempts,
    next_run_at,
    created_at,
    lease_generation,
    dedup_key
)
SELECT
    'release-retention:' || rg.id,
    rg.user_id,
    'retention_sweep',
    '{}'::jsonb,
    'pending',
    0,
    rg.deleted_at + INTERVAL '30 days',
    rg.created_at,
    0,
    rg.id
FROM release_groups AS rg
ON CONFLICT (user_id, kind, dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;

INSERT INTO job_targets (job_id, user_id, target_kind, target_id, expected_revision)
SELECT j.id, rg.user_id, 'release_group', rg.id, NULL
FROM release_groups AS rg
JOIN jobs AS j
  ON j.user_id = rg.user_id
 AND j.kind = 'retention_sweep'
 AND j.dedup_key = rg.id
ON CONFLICT DO NOTHING;

ALTER TABLE jobs
    ADD CONSTRAINT jobs_dedup_key_nonempty
        CHECK (dedup_key IS NULL OR btrim(dedup_key) <> ''),
    ADD CONSTRAINT jobs_payload_empty
        CHECK (payload = '{}'::jsonb),
    ADD CONSTRAINT jobs_status_valid
        CHECK (status IN ('pending', 'running', 'done', 'failed', 'cancelled')),
    ADD CONSTRAINT jobs_status_terminal_check CHECK (
        (status IN ('pending', 'running') AND terminal_at IS NULL)
        OR
        (status IN ('done', 'failed', 'cancelled') AND terminal_at IS NOT NULL)
    );

-- +goose Down
-- Source text is intentionally not reconstructed. Active source-free work is
-- terminalized before the new metadata is removed so an older worker cannot
-- execute it with incomplete legacy payloads.
DELETE FROM jobs WHERE kind = 'retention_sweep';

UPDATE jobs
SET payload = '{}'::jsonb,
    status = 'failed',
    terminal_at = COALESCE(terminal_at, statement_timestamp()),
    cancelled_by_release_id = NULL,
    lease_generation = lease_generation + 1
WHERE status IN ('pending', 'running', 'cancelled');

ALTER TABLE jobs
    DROP CONSTRAINT IF EXISTS jobs_status_terminal_check,
    DROP CONSTRAINT IF EXISTS jobs_status_valid,
    DROP CONSTRAINT IF EXISTS jobs_payload_empty,
    DROP CONSTRAINT IF EXISTS jobs_payload_object,
    DROP CONSTRAINT IF EXISTS jobs_dedup_key_nonempty;

DROP INDEX IF EXISTS jobs_terminal_idx;
DROP INDEX IF EXISTS jobs_due_idx;
DROP INDEX IF EXISTS jobs_user_kind_dedup_key_unique;
DROP INDEX IF EXISTS job_targets_user_target_idx;
DROP TABLE IF EXISTS job_targets;

ALTER TABLE jobs
    DROP CONSTRAINT jobs_id_user_id_unique,
    DROP COLUMN cancelled_by_release_id,
    DROP COLUMN terminal_at,
    DROP COLUMN dedup_key;

ALTER TABLE neurons
    DROP CONSTRAINT neurons_representation_revision_positive,
    DROP COLUMN representation_revision;

ALTER TABLE episodic_memories
    DROP CONSTRAINT episodic_memories_representation_revision_positive,
    DROP COLUMN representation_revision;
