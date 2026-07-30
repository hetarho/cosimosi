-- +goose Up

-- paid_at — the reward LANDED. It is separate from claimed_at because the two facts are separated in
-- time by design: claimed_at is stamped and committed BEFORE any credit moves (that ordering is the
-- double-payout guard), and the payout then runs outside the claim transaction so this context never
-- owns the ledger's or the ornament catalog's tables. The window between them is therefore a real
-- state a row sits in, and without this column it was unrepresentable — a claimed-but-uncredited row
-- read as paid, and the recovery the claim path promises had no surface to be seen or driven from.
--
-- Existing claimed rows backfill to NULL, which is honest rather than conservative: nothing recorded
-- whether those payouts landed and nobody can prove it after the fact. The settle sweep drains them,
-- and both reward legs are idempotent on claim_id, so a replay credits nothing and only stamps.
ALTER TABLE achievement_progress
    ADD COLUMN paid_at TIMESTAMPTZ,
    ADD CONSTRAINT achievement_progress_paid_requires_claim
        CHECK (paid_at IS NULL OR claimed_at IS NOT NULL);

COMMENT ON COLUMN achievement_progress.paid_at IS
    'when the reward reached the other context; NULL while a claim is stamped but uncredited, '
    'which is the state the settle sweep drains';

-- +goose Down

ALTER TABLE achievement_progress
    DROP CONSTRAINT achievement_progress_paid_requires_claim,
    DROP COLUMN paid_at;
