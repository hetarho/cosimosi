-- +goose Up
-- universe_state — the per-user, diary-driven universe clock ([T5]): exactly one row per user,
-- holding the authoritative stored clock (NOT an [I5] emergent value — that invariant governs
-- positions). Advanced only by a memory launch (→ diary date) and recall (→ today) inside the
-- memory use-case transactions ([T2]); monotonic, never moved backward ([I10]). No backfill: the
-- row is born lazily on a user's first advance, so an empty universe keeps its nil universe time.
CREATE TABLE universe_state (
    user_id               TEXT PRIMARY KEY,
    current_universe_time DATE NOT NULL,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE universe_state;
