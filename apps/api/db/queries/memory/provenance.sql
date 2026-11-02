-- Provenance + export reads. SELECTs only: this unit reads and exports the append-only history, it
-- never writes it — the only INSERT on memory_provenance is the reconsolidation/semanticization append
-- path (reconsolidation.sql). Every statement is scoped to the authenticated user
-- ([U1], §4, lint:persistence).

-- The creation facts the created/original baseline is synthesized from at read ([I2]): the
-- memory's created_universe_time and the passage it was encoded from — never current_text (which
-- reconsolidation moves), never a stored row. The immutable Diary body comes along as the fallback
-- for memories encoded before per-memory passages existed, whose source_text is NULL. A soft-deleted
-- memory is invisible, so the panel that opens it is not-found. The join is user-scoped on both sides
-- so no cross-user diary body can leak.
-- name: LoadMemoryProvenanceBaseline :one
SELECT
    em.created_universe_time,
    em.source_text,
    d.body AS diary_body
FROM episodic_memories em
JOIN diaries d
  ON d.id = em.diary_id
 AND d.user_id = em.user_id
WHERE em.user_id = sqlc.arg(user_id)
  AND em.id = sqlc.arg(memory_id)
  AND em.deleted_at IS NULL;

-- The time-ordered appended variant history for one memory ([R8a], A1): universe-time ascending,
-- created_at the tiebreak for same-universe-day events, then the primary-key id as a final total-order
-- tiebreak so the read is fully deterministic even if two appends share a clock_timestamp() (otherwise
-- Postgres could flip same-day entries between reads). Backed by the memory_provenance_timeline index.
-- Empty when the memory has never been reconsolidated/semanticized — the use-case still returns the baseline.
-- name: ListMemoryProvenance :many
SELECT
    id,
    kind,
    source,
    text,
    universe_time,
    created_at
FROM memory_provenance
WHERE user_id = sqlc.arg(user_id)
  AND episodic_memory_id = sqlc.arg(episodic_memory_id)
ORDER BY universe_time, created_at, id;

-- The export walks retained diaries in bounded keyset batches, including released diaries.
-- name: ListDiariesForExportPage :many
SELECT id, body, diary_date
FROM diaries
WHERE user_id = sqlc.arg(user_id)
  AND (sqlc.narg(cursor_date)::date IS NULL
    OR (diary_date, id) > (sqlc.narg(cursor_date)::date, sqlc.narg(cursor_id)::text))
ORDER BY diary_date, id
LIMIT sqlc.arg(page_limit);
