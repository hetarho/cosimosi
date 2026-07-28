-- +goose Up

-- One optional color per mood and user. Absence is the authored client default, so there is no
-- onboarding-completion flag to synchronize with this table.
CREATE TABLE mood_colors (
    user_id    TEXT NOT NULL,
    mood       TEXT NOT NULL,
    color      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, mood),
    CHECK (mood IN (
        'JOY', 'CALM', 'SAD', 'ANGER', 'FEAR', 'LOVE', 'NEUTRAL',
        'EXCITEMENT', 'GRATITUDE', 'RELIEF', 'STRESS', 'TIRED', 'EMPTINESS'
    )),
    CHECK (color ~ '^#[0-9a-f]{6}$')
);

-- +goose Down

DROP TABLE mood_colors;
