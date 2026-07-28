-- +goose Up

-- Aggregate-only recommendation counters. Deliberately no user_id: an aggregate row cannot be
-- resolved back to an account.
CREATE TABLE mood_color_counts (
    mood       TEXT NOT NULL,
    hue_bucket SMALLINT NOT NULL,
    color      TEXT NOT NULL,
    count      BIGINT NOT NULL,
    PRIMARY KEY (mood, hue_bucket, color),
    CHECK (mood IN (
        'JOY', 'CALM', 'SAD', 'ANGER', 'FEAR', 'LOVE', 'NEUTRAL',
        'EXCITEMENT', 'GRATITUDE', 'RELIEF', 'STRESS', 'TIRED', 'EMPTINESS'
    )),
    CHECK (hue_bucket BETWEEN 0 AND 12),
    CHECK (color ~ '^#[0-9a-f]{6}$'),
    CHECK (count > 0)
);

-- +goose Down

DROP TABLE mood_color_counts;
