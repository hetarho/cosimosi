-- +goose Up
-- The passage of the diary this memory was encoded from, in the writer's own words. It is the
-- initial value of current_text and stays fixed while current_text moves with reconsolidation
-- ([R8a]) — which is why it is its own column and not a read of current_text: the created/original
-- baseline in 변천사 must still show what the memory was at birth after it has been rewritten.
--
-- NULL means "encoded before per-memory passages existed", and the baseline falls back to the
-- immutable Diary body for those rows. No backfill: an LLM re-run would rewrite the basis under
-- decay and gist stages that were already generated from the whole diary ([C7] keeps risen stages).
ALTER TABLE episodic_memories
    ADD COLUMN source_text TEXT;

COMMENT ON COLUMN episodic_memories.source_text IS
    'Immutable encode-time diary passage in the writer''s words; NULL for memories launched before per-memory passages.';

-- +goose Down
ALTER TABLE episodic_memories
    DROP COLUMN source_text;
