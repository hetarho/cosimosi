-- +goose Up
-- Signed, accumulated neighbor forgetting nudge in universe-days ([R5], plan 32 / CC4). Written on
-- RECALL to a memory's NEIGHBORS (never to the recalled memory itself — it recovers wholly [F5]);
-- Epic D reads it as effectiveElapsed = max(0, (now − last_recalled_universe_time) + offset). Negative
-- slows forgetting (spreading activation), positive speeds it (retrieval-induced forgetting). Additive
-- (+= the signed delta per co-recall). Never deletes a row [I1] — forgetting is a read-time offset, not
-- a delete. DEFAULT 0 makes every existing row read a zero offset — no backfill.
ALTER TABLE episodic_memories ADD COLUMN forgetting_offset_days REAL NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE episodic_memories DROP COLUMN forgetting_offset_days;
