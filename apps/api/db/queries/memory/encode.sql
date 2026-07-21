-- Encode use-case queries (plan 20): dedup-candidate assembly and persist-time
-- neuron resolution. Every query is user-scoped. (The monotonic launch guard
-- reads the universe_state clock — clock.sql — since plan 30.)

-- name: ListNeuronCandidatesInBody :many
SELECT id, name, neuron_type, representation_revision
FROM neurons
WHERE user_id = $1
  AND sealed_at IS NULL
  AND name IS NOT NULL
  AND POSITION(LOWER(name) IN LOWER($2::text)) > 0
ORDER BY LENGTH(name) DESC, id
LIMIT $3;

-- name: ListNeuronsByNames :many
SELECT id, name, neuron_type, representation_revision
FROM neurons
WHERE user_id = $1
  AND sealed_at IS NULL
  AND name IS NOT NULL
  AND LOWER(name) = ANY($2::text[])
ORDER BY id;

-- name: ListNearestNeuronCandidates :many
SELECT n.id, n.name, n.neuron_type, n.representation_revision
FROM embeddings AS e
JOIN neurons AS n
  ON n.user_id = e.user_id
 AND n.id = e.neuron_id
WHERE e.user_id = $1
  AND n.sealed_at IS NULL
  AND n.name IS NOT NULL
  AND (1 - (e.vector <=> $2::vector)) >= $3::float8
ORDER BY e.vector <=> $2::vector
LIMIT $4;
