-- +goose Up

-- [P8][V10][I11] Three more surfaces decoration opens: the body a memory's SUMMARY is shown as, and
-- the two halves of the decorative dust behind everything — one speck's look, and the space the
-- specks are scattered through. The closed set goes from two to five.
--
-- Only the kind CHECK moves. Nothing else has to: the id prefix rule, the one-row-per-kind primary
-- key and the absence-means-default convention were all written against the KIND rather than against
-- the two that existed, so widening the set is a one-predicate edit and no row is rewritten,
-- backfilled or granted. An account that has never decorated still owns no rows at all.
--
-- ornament_ownerships is untouched by design: it has no kind column ([I1] — the prefix is the only
-- truth), so a new kind's purchases store there with no DDL at all.
ALTER TABLE ornament_selections DROP CONSTRAINT ornament_selections_kind_check;

ALTER TABLE ornament_selections
    ADD CONSTRAINT ornament_selections_kind_check
    CHECK (kind IN ('BACKGROUND', 'STAR_SHADER', 'GIST_SHADER', 'MOTE', 'MOTE_FIELD'));

COMMENT ON COLUMN ornament_selections.kind IS
    'closed set, owned by the store domain: BACKGROUND | STAR_SHADER | GIST_SHADER | MOTE | '
    'MOTE_FIELD — the staging-layer surfaces decoration opens. Every name is the SURFACE, never '
    'the renderer''s own noun for the look that fills it. A feeling''s color is not one of them: '
    'mood_colors owns that, and an emotion color is not for sale ([P10] as amended).';

-- +goose Down

ALTER TABLE ornament_selections DROP CONSTRAINT ornament_selections_kind_check;

-- The down path has to REMOVE what the widened set allowed, or the narrower CHECK cannot be
-- restored. The rows are the user's own selections and the default is their absence, so deleting a
-- retired kind's row restores exactly the picture that kind's absence meant.
DELETE FROM ornament_selections WHERE kind NOT IN ('BACKGROUND', 'STAR_SHADER');

ALTER TABLE ornament_selections
    ADD CONSTRAINT ornament_selections_kind_check
    CHECK (kind IN ('BACKGROUND', 'STAR_SHADER'));
