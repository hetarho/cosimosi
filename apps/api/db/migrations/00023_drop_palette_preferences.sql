-- +goose Up
-- palette_preferences held one registry palette id per user — a whole-set choice from a named
-- first-party catalog. mood_colors (00021) replaced it with a per-mood override, and no surface
-- ever wrote or read the id again: nothing selected one, and the resolved id colored nothing.
-- Dropping it leaves one home for a user's colors.
DROP TABLE palette_preferences;

-- +goose Down
-- Recreated empty and unread. There is nothing to restore: the ids were a closed first-party set,
-- absence already meant "the authored default", and every row said exactly that.
CREATE TABLE palette_preferences (
    user_id    TEXT PRIMARY KEY,
    palette_id TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
