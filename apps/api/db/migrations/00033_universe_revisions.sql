-- +goose Up

-- [MEM-21] One freshness counter per user. The graph lock statement (LockGraphMutation) upserts it
-- in every graph-mutating transaction, so a client can tell whether its universe snapshot is
-- current without reading the snapshot; a rollback undoes the advance with the rest of the work.
-- No row reads as revision 0.
CREATE TABLE IF NOT EXISTS universe_revisions (
    user_id TEXT PRIMARY KEY,
    revision BIGINT NOT NULL
);

-- +goose Down
DROP TABLE IF EXISTS universe_revisions;
