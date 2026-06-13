-- records is immutable (constitution §1): there are deliberately NO UPDATE or
-- DELETE queries here. Order matters — record → memory → job — because
-- memories.record_id is a NOT NULL FK to records.id.
-- Since spec 21 the relation is 1 record → N fragment memories (record_id is a
-- non-unique FK); per-fragment mood/intensity/valence live on memories.

-- name: FindRecordByIdempotencyKey :one
-- Idempotency: return the existing record id for a (user_id, idempotency_key)
-- pair. Fragment memory ids (possibly none yet — extract is async) are listed
-- separately via ListMemoryIDsByRecord.
SELECT r.id
FROM records r
WHERE r.user_id = $1 AND r.idempotency_key = $2;

-- name: ListMemoryIDsByRecord :many
-- All fragment stars born from one record, in fragment order. Used by the
-- idempotent RecordMemory replay and the extract worker's already-fanned-out check.
SELECT id
FROM memories
WHERE record_id = $1
ORDER BY fragment_index;

-- name: InsertRecord :exec
-- The immutable original. No memory_id column (the star points to the record, not
-- the reverse). mood/intensity/valence are optional whole-diary user hints
-- (spec 21 — the AI detects per-fragment emotion); idempotency_key is nullable.
INSERT INTO records (id, user_id, body, entry_date, mood, intensity, valence, idempotency_key)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8);

-- name: InsertMemory :one
-- One fragment star (spec 21): record_id (non-unique FK) links back to the
-- original; the fragment's own emotion and text live HERE on the mutable star
-- layer (never on the immutable record).
INSERT INTO memories (id, user_id, record_id, mood, intensity, fragment_index, fragment_text, valence)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id;

-- name: GetRecordForExtract :one
-- Loads what the extract worker needs: the immutable body to segment, the owner,
-- entry_date, and the optional manual-emotion hints (fallback when extraction
-- degrades to a single neutral segment).
SELECT r.user_id, r.body, r.entry_date, r.mood, r.intensity, r.valence
FROM records r
WHERE r.id = $1;

-- name: GetMemoryForEmbed :one
-- Loads what the embedding worker needs: the star's owner, the FRAGMENT text
-- (NULL → whole-diary body fallback), and entry_date (for the temporal_bonus
-- baseline). Each fragment embeds separately (spec 21).
SELECT m.user_id, COALESCE(m.fragment_text, r.body) AS text, r.entry_date
FROM memories m
JOIN records r ON r.id = m.record_id
WHERE m.id = $1;

-- name: RecallMemoryTouch :exec
-- Re-ignite a star on recall: only memories.last_recalled_at changes (the
-- star is mutable; the original record is NOT — constitution §1). No RETURNING.
UPDATE memories SET last_recalled_at = now() WHERE id = @id AND user_id = @user_id;

-- name: ListLastRecalled :many
-- The candidate stars' last_recalled_at (spec 22): the per-star excitability event
-- feeding e(c,t). Derived from the existing timestamp — no excitability column
-- (acceptance 1.5, single source). user_id = isolation.
SELECT m.id, m.last_recalled_at FROM memories m
WHERE m.user_id = @user_id AND m.id = ANY(@ids::text[]);

-- name: GetRecordByMemory :one
-- Read the immutable original for the recall panel (records JOIN). body/entry_date/
-- mood live on records; never mutated, never RETURNING * from memories (no body there).
SELECT r.body, r.entry_date, r.mood, r.intensity, r.created_at
FROM memories m
JOIN records r ON r.id = m.record_id
WHERE m.id = @id AND m.user_id = @user_id;

-- name: ListMemoriesByUser :many
-- Every star for the user, dormant included (no brightness filter — constitution
-- §2). mood/intensity/valence are the FRAGMENT's own (memories, spec 21) — no
-- records JOIN anymore. The reshaping state (spec 23) rides the same row.
SELECT m.id AS memory_id, m.mood, m.intensity, m.valence, m.last_recalled_at,
       m.brightness_offset, m.hue_shift, m.form_seed_delta, m.version
FROM memories m
WHERE m.user_id = $1
ORDER BY m.created_at, m.fragment_index;

-- name: ListDormant :many
-- Long-unrecalled (dormant) stars for the dormant-search page. A search aid,
-- NOT a delete/filter — GetUniverse still returns the full graph (constitution §2). The WHERE
-- compares only the last_recalled_at time cutoff (sargable; NO exp()/decay math in SQL —
-- brightness is computed client-side from this same value). The service converts the
-- dormancy threshold into `cutoff`. mood/intensity/valence are the fragment's own
-- (memories, spec 21; no body sent — the dormant list renders Star; the original is
-- fetched on recall, spec 11). Same column shape as ListMemoriesByUser so it maps to
-- the same domain Memory (reshaping state included, spec 23).
SELECT m.id AS memory_id, m.mood, m.intensity, m.valence, m.last_recalled_at,
       m.brightness_offset, m.hue_shift, m.form_seed_delta, m.version
FROM memories m
WHERE m.user_id = $1
  AND m.last_recalled_at < sqlc.arg(cutoff)::timestamptz
ORDER BY m.last_recalled_at ASC;

-- name: GetReshapeContext :one
-- PE/strength inputs for one recalled star (spec 23): the cumulative reshaping
-- state + version, the star's embedding (PE = 1-cos(recall_ctx, last_consolidated);
-- embeddings filled by 03/05), the co-recall total (strength = how consolidated),
-- and created_at (age term). Star-only read — never touches the immutable record.
SELECT m.version, m.brightness_offset, m.hue_shift, m.form_seed_delta,
       e.embedding,
       COALESCE((SELECT SUM(ml.co_activation_count) FROM memory_links ml
                 WHERE (ml.a_id = m.id OR ml.b_id = m.id) AND ml.user_id = m.user_id), 0)::int AS co_recall_total,
       m.created_at
FROM memories m JOIN embeddings e ON e.memory_id = m.id
WHERE m.id = @id AND m.user_id = @user_id;

-- name: ListDirectNeighbors :many
-- 1-hop direct neighbors over memory_links (spec 23, content-limited scope): only
-- the recalled star + these are reshaped; indirect neighbors stay untouched.
SELECT (CASE WHEN ml.a_id = @id THEN ml.b_id ELSE ml.a_id END)::text AS neighbor_id
FROM memory_links ml
WHERE ml.user_id = @user_id AND (ml.a_id = @id OR ml.b_id = @id);

-- name: ApplyReshape :exec
-- Reshape one mutable star (spec 23): only memories changes, version++ — the
-- original record is NEVER touched (constitution §1, grep: no UPDATE records).
UPDATE memories
SET brightness_offset = @brightness_offset, hue_shift = @hue_shift,
    form_seed_delta = @form_seed_delta, version = version + 1
WHERE id = @id AND user_id = @user_id;

-- name: AppendEvolution :exec
-- One append-only variant row (spec 23): INSERT only — never UPDATE/DELETE an
-- existing evolution_history row (constitution §1·§2).
INSERT INTO evolution_history (id, memory_id, user_id, version, brightness, hue_shift, form_seed_delta, trigger, pe, dir)
VALUES (@id, @memory_id, @user_id, @version, @brightness, @hue_shift, @form_seed_delta, @trigger, @pe, @dir);

-- name: GetEvolutionHistory :many
-- A star's variant log, version ascending (spec 23; UI is spec 24). user_id = isolation.
SELECT version, brightness, hue_shift, form_seed_delta, trigger, pe, dir, created_at
FROM evolution_history WHERE memory_id = @memory_id AND user_id = @user_id ORDER BY version ASC;
