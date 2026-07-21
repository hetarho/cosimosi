-- +goose Up
-- Consolidation/semanticization convergence. A gist rise whose
-- pregenerated text is missing is never published — it is recorded as
-- revision-bound pending work on the memory row and finalized by the semanticize
-- completion transaction once real text exists. A per-user watermark makes the
-- interval's synapse downscale exactly-once, and semanticized 변천사 rows carry
-- their stage identity so blank or duplicate stage events are database-guarded.

-- The deferred gist rise: the stage the timer already crossed (visible
-- semantic_stage stays at the last readable stage until the ladder text lands)
-- and the universe-time of the crossing (the finalized 변천사 rows' event time).
ALTER TABLE episodic_memories
    ADD COLUMN pending_semantic_stage SMALLINT,
    ADD COLUMN pending_semantic_rise_at DATE,
    ADD CONSTRAINT episodic_memories_pending_rise_pair
        CHECK ((pending_semantic_stage IS NULL) = (pending_semantic_rise_at IS NULL)),
    ADD CONSTRAINT episodic_memories_pending_stage_range
        CHECK (pending_semantic_stage IS NULL OR pending_semantic_stage BETWEEN 1 AND 4);

-- The consolidation watermark: the universe-time consolidation has processed
-- through. Duplicate or overlapping invocations clamp to the unprocessed suffix,
-- so the homeostatic downscale applies exactly once per slept interval.
ALTER TABLE universe_state
    ADD COLUMN consolidated_through DATE;

-- Stage identity for semanticized 변천사 rows. Legacy rows keep NULL — retained
-- history is append-only and never repaired by mutation.
ALTER TABLE memory_provenance
    ADD COLUMN semantic_stage SMALLINT,
    ADD CONSTRAINT memory_provenance_stage_semanticized_only
        CHECK (semantic_stage IS NULL OR (kind = 'semanticized' AND semantic_stage BETWEEN 1 AND 4));

-- Forward-only materialization guard: every NEW semanticized event must carry
-- non-blank text and its stage. NOT VALID skips the retained legacy blank rows
-- (they are handled by the repair/regen path, not by UPDATEing history).
ALTER TABLE memory_provenance
    ADD CONSTRAINT memory_provenance_semanticized_materialized
        CHECK (kind <> 'semanticized' OR (btrim(text) <> '' AND semantic_stage IS NOT NULL)) NOT VALID;

-- Exactly one event per (user, memory, stage): a stage can only ever rise once
-- ([C7] one-way), so a duplicate stage event is always a replay/race bug.
CREATE UNIQUE INDEX memory_provenance_semantic_stage_once
    ON memory_provenance (user_id, episodic_memory_id, semantic_stage)
    WHERE semantic_stage IS NOT NULL;

-- +goose Down
DROP INDEX memory_provenance_semantic_stage_once;

ALTER TABLE memory_provenance
    DROP CONSTRAINT memory_provenance_semanticized_materialized,
    DROP CONSTRAINT memory_provenance_stage_semanticized_only,
    DROP COLUMN semantic_stage;

ALTER TABLE universe_state
    DROP COLUMN consolidated_through;

ALTER TABLE episodic_memories
    DROP CONSTRAINT episodic_memories_pending_stage_range,
    DROP CONSTRAINT episodic_memories_pending_rise_pair,
    DROP COLUMN pending_semantic_stage,
    DROP COLUMN pending_semantic_rise_at;
