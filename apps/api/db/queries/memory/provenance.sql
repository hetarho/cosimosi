-- Provenance + export reads. SELECTs only: this unit reads and exports the append-only history, it
-- never writes it — the only INSERT on memory_provenance is the reconsolidation/semanticization append
-- path (reconsolidation.sql). Every statement is scoped to the authenticated user
-- ([U1], §4, lint:persistence).

-- The creation facts the created/original baseline is synthesized from at read ([CC5][I2]): the
-- memory's created_universe_time and its immutable Diary body (the objective record via diary_id) —
-- never current_text, never a stored row. A soft-deleted memory is invisible, so the panel that opens
-- it is not-found. The join is user-scoped on both sides so no cross-user diary body can leak.
-- name: LoadMemoryProvenanceBaseline :one
SELECT
    em.created_universe_time,
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

-- The whole-account export's diaries ([W6][D4]): the user's retained immutable objective records,
-- diary-date ordered. diaries has no deleted_at — the Diary is never soft-deleted ([I2]); a
-- saved-but-past-dated diary whose memory was never launched is still here (A8).
-- name: ListDiariesForExport :many
SELECT
    id,
    body,
    diary_date
FROM diaries
WHERE user_id = sqlc.arg(user_id)
ORDER BY diary_date, id;

-- The still-live episodic memories launched from those diaries ([W6]): deleted_at IS NULL honors the
-- letting-go exclusion in what is handed out ([I1][X3]); no neuron content is read, so sealing is
-- honored structurally (A8). Only the legible structure (name, mood, created universe-time) — never
-- current_text or stage texts, which are the mutable trace, not the record ([D4]).
-- name: ListEpisodicMemoriesForExport :many
SELECT
    diary_id,
    name,
    mood,
    created_universe_time
FROM episodic_memories
WHERE user_id = sqlc.arg(user_id)
  AND deleted_at IS NULL
ORDER BY diary_id, created_universe_time, id;
