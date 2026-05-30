CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE entries (
    id           TEXT PRIMARY KEY,
    entry_date   DATE NOT NULL,
    mood         TEXT NOT NULL,
    note         TEXT NOT NULL DEFAULT '',
    artwork_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
    thumb_key    TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX entries_entry_date_uniq ON entries (entry_date);
CREATE INDEX entries_mood_idx ON entries (mood);
