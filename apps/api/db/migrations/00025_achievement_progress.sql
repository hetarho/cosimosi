-- +goose Up

-- achievement_counters — the cumulative facts every Achievement condition is evaluated against
-- ([A1a][A2][U1]). One row per (user, counter_key). `value` is a monotonic sum for
-- accumulate-mode keys and a high-water mark for reach-mode keys; the mode lives in the in-code
-- catalog, not here. There is deliberately NO per-event row and no event timestamp: an aggregate
-- cannot answer "how many days in a row", so a streak condition is unanswerable from this schema.
-- No FK to users, matching every other product table; the one hard delete is the user's own
-- withdrawal sweep ([I1]).
CREATE TABLE achievement_counters (
    user_id     TEXT        NOT NULL,
    counter_key TEXT        NOT NULL,
    value       BIGINT      NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, counter_key),
    CHECK (value >= 0)
);

COMMENT ON COLUMN achievement_counters.counter_key IS
    'a member of the closed counter vocabulary owned by the achievement context''s in-code '
    'catalog; an unknown key is a wiring fault refused before this table is reached ([A2])';

-- achievement_progress — the two non-derivable per-achievement facts ([A4][U1]): when the condition
-- was first met, and when the reward was received. Progress itself is NOT stored — it is derived at
-- read from achievement_counters against the in-code target (ARCHITECTURE §2.9 #3). The PK is the
-- double-payout guard; claim_id is the dedup key both reward legs carry. Rows are never deleted
-- except by the withdrawal sweep, and achieved_at is never cleared ([I1]). Both
-- timestamps are stamped by SQL now(), which is what lets the Go context own no clock ([A1a]).
-- claim_id carries the two guards the ledger's dedup_key already carries, because it IS the dedup
-- key both reward legs pair on: UNIQUE per user (two achievements claimed under one key would make
-- the second reward vanish silently into the ledger's replay check) and non-blank (the pairing
-- CHECK below accepts '' on its own, which would collapse every claim into one dedup identity).
-- Multiple NULLs are still fine — an unclaimed row has neither column.
CREATE TABLE achievement_progress (
    user_id        TEXT        NOT NULL,
    achievement_id TEXT        NOT NULL,
    achieved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_at     TIMESTAMPTZ,
    claim_id       TEXT,
    PRIMARY KEY (user_id, achievement_id),
    UNIQUE (user_id, claim_id),
    CHECK ((claimed_at IS NULL) = (claim_id IS NULL)),
    CHECK (claim_id IS NULL OR btrim(claim_id) <> '')
);

COMMENT ON COLUMN achievement_progress.claim_id IS
    'the idempotent-pairing key both reward legs carry; set exactly when claimed_at is';

-- +goose Down

DROP TABLE achievement_progress;
DROP TABLE achievement_counters;
