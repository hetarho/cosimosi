-- +goose Up
-- memory_provenance — append-only 변천사 (variant history) for a memory's representation ([R8a][D1],
-- plan 32 / CC5). One row per representational event. NEVER updated while retained (append-only [I1]);
-- only Epic H's post-window user full-delete sweep deletes it, via the parent memory's ON DELETE CASCADE.
-- The Diary is NOT represented here as mutable — the objective original is the Diary/export while
-- retained ([I2][R7]). No kind='created' row is ever written: the created/original baseline is
-- synthesized at READ from the memory's creation facts, never backfilled (CC5) — so a memory with zero
-- reconsolidations still yields a one-entry 변천사. Reconsolidation appends kind='reconsolidated'/
-- source='user'; semanticization appends kind='semanticized'/source='system' (Epic E).
CREATE TABLE memory_provenance (
    id                 TEXT PRIMARY KEY,                 -- nanoid, backend-minted (ARCHITECTURE §5)
    user_id            TEXT NOT NULL,                    -- per-user isolation [U1]
    episodic_memory_id TEXT NOT NULL REFERENCES episodic_memories(id) ON DELETE CASCADE,
    kind               TEXT NOT NULL,                    -- 'created' | 'semanticized' | 'reconsolidated'
    source             TEXT NOT NULL,                    -- 'original' | 'system' | 'user'
    text               TEXT NOT NULL,                    -- the representation text at this event
    universe_time      DATE NOT NULL,                    -- when (in universe-time [T]) the event happened
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The time-ordered read the 변천사 panel needs (plan 46, Epic G): a user's one memory's events in
-- universe-time order, created_at as the deterministic tiebreak for same-day events.
CREATE INDEX memory_provenance_timeline
    ON memory_provenance (user_id, episodic_memory_id, universe_time, created_at);

-- +goose Down
DROP TABLE memory_provenance;
