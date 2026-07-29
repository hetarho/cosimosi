-- +goose Up

-- [P7][P9][I11][U1] Permanent ownership history: a purchase or an achievement grant, never
-- expiring, never revoked, never UPDATEd by the system. The insert is ON CONFLICT DO NOTHING,
-- which is also the idempotency guard for the achievement reward leg. No `kind` column — kind
-- is derivable from the id prefix, so storing it would be a second truth (ARCHITECTURE §2.9 #3).
-- No FK to users, matching every other product table: a withdrawn user leaves no cascade, and
-- the one hard delete is that user's own withdrawal sweep ([I1]).
--
-- The columns are ids, an enum and a timestamp. There is deliberately NO params/config/overrides
-- column of any kind: an ornament sells a render-parameter id and nothing else, so a color, size,
-- brightness or seed has nowhere to be written ([V10][I11]).
CREATE TABLE ornament_ownerships (
    user_id      TEXT NOT NULL,
    ornament_id  TEXT NOT NULL,
    acquired_via TEXT NOT NULL,
    acquired_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, ornament_id),
    CHECK (acquired_via IN ('purchase', 'achievement'))
);

COMMENT ON COLUMN ornament_ownerships.acquired_via IS
    'the [P9]/[P11] audit trail: purchase | achievement';

-- [P8][I11] The single source of truth for what the universe wears right now — one row per kind,
-- which is what makes "exactly one applied ornament per kind" a schema fact rather than a rule.
-- ABSENCE = the kind's free default, so no row is ever written for a default and no signup grant
-- or backfill exists.
--
-- The second CHECK is why the id prefix is not decoration: it turns "the selection belongs to its
-- kind" into something the database refuses to break, so a STAR_SHADER row can never hold a
-- background id. starts_with rather than LIKE deliberately: `_` is a LIKE wildcard, so
-- `LIKE lower(kind) || '.%'` would also accept `starXshader.geode`. The length term is what refuses
-- a bare prefix with no registry key behind it.
CREATE TABLE ornament_selections (
    user_id     TEXT NOT NULL,
    kind        TEXT NOT NULL,
    ornament_id TEXT NOT NULL,
    selected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, kind),
    CHECK (kind IN ('BACKGROUND', 'STAR_SHADER')),
    CHECK (starts_with(ornament_id, lower(kind) || '.') AND length(ornament_id) > length(kind) + 1)
);

COMMENT ON COLUMN ornament_selections.kind IS
    'closed set, owned by the store domain: BACKGROUND | STAR_SHADER — the two staging-layer '
    'surfaces decoration opens. A feeling''s color is not one of them: mood_colors owns that, '
    'and an emotion color is not for sale ([P10] as amended).';

-- +goose Down

DROP TABLE ornament_selections;
DROP TABLE ornament_ownerships;
