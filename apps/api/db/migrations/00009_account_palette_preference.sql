-- +goose Up
-- palette_preferences — one row per user holding that user's single account preference: the chosen
-- emotion-palette id. A user who never chose one owns no row; the read derives the default id from
-- absence. The id is an opaque first-party registry key validated in the account context before it
-- is written — never a color table, so this preference cannot carry meaning-layer data ([U1], §4).
CREATE TABLE palette_preferences (
    user_id    TEXT PRIMARY KEY,             -- per-user isolation [U1]; one preference row per user
    palette_id TEXT NOT NULL,                -- the chosen registry id (validated first-party key)
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE palette_preferences;
