-- name: ListLinksByUser :many
-- Every synapse for the user, dormant included (no weight filter — constitution
-- §2). Scoped by memory_links.user_id.
SELECT ml.a_id, ml.b_id, ml.weight, ml.link_type, ml.co_activation_count, ml.last_activated_at
FROM memory_links ml
WHERE ml.user_id = $1;
