-- Embedding persistence + KNN. embeddings.vector(1536) is declared
-- unqualified (sqlc #3548) and indexed with HNSW vector_cosine_ops.

-- name: UpsertEmbedding :exec
-- Idempotent per memory: a retried job replaces the vector/model rather than
-- erroring, so the pipeline is safe to re-run (constitution §1: never touches records).
INSERT INTO embeddings (memory_id, user_id, embedding, model)
VALUES (@memory_id, @user_id, @embedding::vector, @model)
ON CONFLICT (memory_id) DO UPDATE
SET embedding = EXCLUDED.embedding,
    user_id   = EXCLUDED.user_id,
    model     = EXCLUDED.model;

-- name: KnnNearest :many
-- Top-k nearest same-user neighbors (excluding self), cosine similarity ≥ τ=0.75,
-- nearest first. Returns each candidate's entry_date for the temporal_bonus.
-- user_id filter = multi-user isolation; HNSW serves the ORDER BY.
-- Since spec 22 the worker calls this with k=candidateK (=knnK*2) to widen the pool the
-- excitability re-rank (biasedLinks) trims to biasedK; the query itself is unchanged.
SELECT
    e.memory_id,
    (1 - (e.embedding <=> @query::vector))::float8 AS cos_sim,
    r.entry_date
FROM embeddings e
JOIN memories m ON m.id = e.memory_id
JOIN records r ON r.id = m.record_id
WHERE e.user_id = @user_id
  AND e.memory_id <> @self_id
  AND 1 - (e.embedding <=> @query::vector) >= 0.75
ORDER BY e.embedding <=> @query::vector
LIMIT @k;
