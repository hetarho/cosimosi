-- +goose Up

-- first_counted_at — when this exact color first entered the aggregate. It breaks the tie between
-- two buckets holding an equal number of choices, which are otherwise separable only by hue_bucket:
-- a property of the hue circle rather than of anyone's choice.
--
-- Still no user_id, and this is not one either: the stamp belongs to the color's first appearance
-- across every account. A row is deleted once its count falls to zero, so a color that comes back
-- starts its clock again.
--
-- Existing rows backfill to now(), since nothing recorded when they arrived; their ties fall through
-- to hue_bucket.
ALTER TABLE mood_color_counts
    ADD COLUMN first_counted_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN mood_color_counts.first_counted_at IS
    'when this exact color first entered the aggregate; breaks ties between equally-chosen buckets';

-- +goose Down

ALTER TABLE mood_color_counts
    DROP COLUMN first_counted_at;
