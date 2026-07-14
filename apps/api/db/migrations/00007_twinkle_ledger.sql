-- +goose Up
-- twinkle_balances — one authoritative balance row per user. `additional` is the permanent (carrying)
-- balance [G2]; basic is DERIVED (not stored as a live counter) from the daily grant + the in-window
-- basic spend + the reset anchor, so there is no stored basic balance to drift. Server-authoritative
-- single-writer state (like universe_state) — the FE reads it, never writes it ([I5] governs
-- positions, not this). The daily-grant literal lives in twinkle.basic_daily_amount (values.yaml),
-- never a DDL default.
CREATE TABLE twinkle_balances (
    user_id                  TEXT PRIMARY KEY,            -- one balance per user [U1]
    additional               INT  NOT NULL DEFAULT 0,     -- permanent, carrying balance [G2]
    basic_spent_this_window  INT  NOT NULL DEFAULT 0,     -- basic Twinkle spent within the current reset window
    basic_reset_window       DATE NOT NULL,               -- UTC calendar day of the current basic window (reset anchor)
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (additional >= 0),
    CHECK (basic_spent_this_window >= 0)
);

-- twinkle_ledger_entries — append-only earn/spend log ([I1] spirit): auditability, idempotency,
-- reconstruction. Never UPDATEd or DELETEd by the system. `dedup_key` makes a retried earn/spend
-- idempotent (NULL = not deduped; PG treats NULLs as distinct under UNIQUE). kind/reason are TEXT
-- closed sets owned by the domain (like neuron_type / jobs.kind), not PG enums.
CREATE TABLE twinkle_ledger_entries (
    id              TEXT PRIMARY KEY,                     -- nanoid, backend-minted (ARCHITECTURE §5)
    user_id         TEXT NOT NULL,                        -- per-user isolation [U1]
    kind            TEXT NOT NULL,                        -- 'earn' | 'spend'
    reason          TEXT NOT NULL,                        -- 'payment' | 'invite' | 'write_diary' | 'recall'
                                                          -- | 'gist_view' — the earn/spend source [G3][G1]
    amount          INT  NOT NULL,                        -- always positive; kind gives the sign
    from_basic      INT  NOT NULL DEFAULT 0,              -- for spends: portion drawn from basic [G2]
    from_additional INT  NOT NULL DEFAULT 0,              -- for spends: portion drawn from additional [G2]
    dedup_key       TEXT,                                 -- idempotency key for retried earn/spend
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, dedup_key),
    -- Reconstruction invariants: the log must stay foldable back into the balance row, so the
    -- domain contract (positive amount; non-negative per-tier draws; a spend's amount equals
    -- its two-tier split) is enforced here as the last line, not only in Go.
    CHECK (amount > 0),
    CHECK (from_basic >= 0),
    CHECK (from_additional >= 0),
    CHECK (kind <> 'spend' OR amount = from_basic + from_additional)
);

-- +goose Down
DROP TABLE twinkle_ledger_entries;
DROP TABLE twinkle_balances;
