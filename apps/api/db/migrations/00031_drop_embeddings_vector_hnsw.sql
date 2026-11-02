-- +goose Up

-- [MEM-9] The neuron-dedup nearest-neighbour read is always scoped to one user, and the planner
-- serves it from embeddings_user_neuron_idx with an exact sort over that user's vectors; measured
-- 261103 on 100 users × 500 neurons sharing names, it never chose this global HNSW index. The index
-- was pure write cost on every embedding upsert — and were it chosen, a global approximate scan
-- filtered to one user would drop that user's own neurons whenever other users share the name.
DROP INDEX IF EXISTS embeddings_vector_hnsw;

-- +goose Down
CREATE INDEX IF NOT EXISTS embeddings_vector_hnsw ON embeddings USING hnsw (vector vector_cosine_ops);
