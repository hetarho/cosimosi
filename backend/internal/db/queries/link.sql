-- name: ListLinksByUser :many
-- Every synapse for the user, dormant included (no weight filter — constitution
-- §2). Scoped by memory_links.user_id.
SELECT ml.a_id, ml.b_id, ml.weight, ml.link_type, ml.co_activation_count, ml.last_activated_at
FROM memory_links ml
WHERE ml.user_id = $1;

-- name: BatchUpsertLinks :exec
-- Initial semantic synapses from the embedding worker (spec 05), one statement
-- via UNNEST, with link_type literal 'semantic' (memory_links.link_type is NOT
-- NULL, no default — spec 03). On conflict we keep the stronger weight (GREATEST)
-- so re-running a job never weakens an existing link; co-recall reinforcement is
-- spec 11's job.
--
-- IMPORTANT: the (a_id, b_id) pair is normalized HERE with LEAST/GREATEST, not by
-- the caller, so ordering uses the SAME database collation (en_US.utf8) as the
-- a_id<b_id CHECK and the (a_id,b_id) PK. The ids are mixed-case base64url; a Go
-- byte-order swap disagrees with the locale collation (e.g. 'Zx' < 'aB' is true
-- in Go but false in Postgres) and would violate the CHECK — so the DB decides.
INSERT INTO memory_links (a_id, b_id, weight, user_id, link_type)
SELECT LEAST(a, b), GREATEST(a, b), w, u, 'semantic'
FROM (
    SELECT
        unnest(@a_ids::text[])     AS a,
        unnest(@b_ids::text[])     AS b,
        unnest(@weights::float8[]) AS w,
        unnest(@user_ids::text[])  AS u
) AS pairs
ON CONFLICT (a_id, b_id) DO UPDATE
SET weight = GREATEST(memory_links.weight, EXCLUDED.weight);

-- name: ReinforceLinks :exec
-- Co-recall (Hebbian) reinforcement (spec 11, Architecture §6/§4.5): apply per-pair
-- INCREMENTAL deltas. New row → weight=LEAST(1.0, delta), link_type='co_recall';
-- existing → weight=LEAST(1.0, weight+delta), co_activation_count++,
-- last_activated_at=now. The cap is on BOTH branches: a single batch's summed delta
-- for a pair can exceed 1.0 (the client accumulates uncapped), so a first-ever link
-- must clamp too — weight is a 0..1 invariant (schema §50), not just on conflict.
-- a_id<b_id is normalized HERE with LEAST/GREATEST under the DB collation (matches
-- the a_id<b_id CHECK / PK — a Go byte-order swap would disagree with en_US.utf8).
INSERT INTO memory_links (a_id, b_id, user_id, weight, link_type, co_activation_count, last_activated_at, created_at)
SELECT LEAST(a, b), GREATEST(a, b), @user_id, LEAST(1.0, d), 'co_recall', 1, now(), now()
FROM (
    SELECT
        unnest(@a_ids::text[])    AS a,
        unnest(@b_ids::text[])    AS b,
        unnest(@deltas::float8[]) AS d
) AS pairs
ON CONFLICT (a_id, b_id) DO UPDATE
SET weight              = LEAST(1.0, memory_links.weight + EXCLUDED.weight),
    co_activation_count = memory_links.co_activation_count + 1,
    last_activated_at   = now();

-- name: ClaimBatch :execrows
-- Idempotency CLAIM (spec 11, 1.5/1.10): insert the batch_id row FIRST, inside the
-- reinforce tx. Returns 1 if THIS tx claimed the batch (proceed with the upsert), 0 if
-- it was already processed (skip). Because the insert runs before the upsert, the
-- batch_id PK holds a lock for the whole tx, so a concurrent duplicate batch_id BLOCKS
-- here until the first tx commits, then sees the conflict and gets 0 — true
-- serialization (a check-then-act EXISTS guard would let both pass and double-count).
INSERT INTO processed_batches (batch_id, user_id)
VALUES (@batch_id, @user_id)
ON CONFLICT (batch_id) DO NOTHING;
