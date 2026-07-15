-- +goose Up
-- release_groups + its three effect tables — the retention-scoped release-effect ledger the
-- full-delete restore window needs ([X2]). One release_group is one user's full delete of one Diary:
-- deleted_at is real-clock UTC (a human-time promise, not universe-time), and the effect rows record
-- exactly what the release changed so Restore can reverse it precisely. These rows are NOT long-term
-- provenance — they live only for the restore window and are swept with the release once deleted_at is
-- older than release.soft_delete_retention_days (the sole hard delete, [I1]). Every table carries
-- user_id ([U1], §4). The effect tables cascade off the group so retiring a release (Restore) or
-- sweeping it clears its effects in one delete.
CREATE TABLE release_groups (
    id         TEXT PRIMARY KEY,                 -- nanoid, backend-minted (ARCHITECTURE §5)
    user_id    TEXT NOT NULL,                    -- per-user isolation [U1]
    diary_id   TEXT NOT NULL,                    -- the released Diary; one live release per (user, diary)
    deleted_at TIMESTAMPTZ NOT NULL,             -- real-clock UTC — the restore-window clock [X2]
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, diary_id)
);

-- The sweep read (groups whose deleted_at is older than the window) and the restore/already-released
-- guard (a group for one diary) both scan by user; deleted_at orders the sweep.
CREATE INDEX release_groups_user_deleted_at_idx ON release_groups (user_id, deleted_at);

-- The episodic memories this release soft-deleted — the removal set, so Restore clears exactly these
-- and the sweep hard-deletes exactly these.
CREATE TABLE release_memories (
    release_id         TEXT NOT NULL REFERENCES release_groups(id) ON DELETE CASCADE,
    user_id            TEXT NOT NULL,
    episodic_memory_id TEXT NOT NULL,
    PRIMARY KEY (release_id, episodic_memory_id)
);

-- The orphan neurons THIS release sealed — so Restore unseals exactly these, and the sweep hard-deletes
-- the ones no other memory still references (never a shared neuron — only orphans are recorded here).
CREATE TABLE release_sealed_neurons (
    release_id TEXT NOT NULL REFERENCES release_groups(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL,
    neuron_id  TEXT NOT NULL,
    PRIMARY KEY (release_id, neuron_id)
);

-- The LTD amount this release removed from each shared-neuron contribution synapse — so Restore adds it
-- back (clamped) to return the edge to its pre-release strength. The edge itself is never deleted here.
CREATE TABLE release_synapse_deltas (
    release_id    TEXT NOT NULL REFERENCES release_groups(id) ON DELETE CASCADE,
    user_id       TEXT NOT NULL,
    synapse_id    TEXT NOT NULL,
    applied_delta REAL NOT NULL,
    PRIMARY KEY (release_id, synapse_id)
);

-- +goose Down
DROP TABLE IF EXISTS release_synapse_deltas;
DROP TABLE IF EXISTS release_sealed_neurons;
DROP TABLE IF EXISTS release_memories;
DROP INDEX IF EXISTS release_groups_user_deleted_at_idx;
DROP TABLE IF EXISTS release_groups;
