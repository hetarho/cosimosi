-- View-semantic use-case read (plan 34 / job 45): the user-scoped gist columns of one
-- episodic memory — semantic_stage (how far it has risen, [C6]) and the pregenerated
-- semantic_stages texts ([C7]). A pure SELECT: the view path writes nothing ([R8][I2]).
-- Scoped to the authenticated user (§4, lint:persistence); a soft-deleted memory is
-- invisible to the universe, so its gist is not viewable (not-found).
-- name: LoadEpisodicMemoryGist :one
SELECT
    semantic_stage,
    semantic_stages
FROM episodic_memories
WHERE user_id = sqlc.arg(user_id)
  AND id = sqlc.arg(memory_id)
  AND deleted_at IS NULL;
