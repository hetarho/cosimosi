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
