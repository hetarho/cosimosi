-- +goose Up

-- [ACCT-21] Signup settlement runs after every admitted launch until it has nothing left to do. Its
-- legs are dedup-keyed, so re-running them was always safe — but it also re-ran an invite probe and
-- a ledger transaction on every launch for the life of the account. signup_settled_at records that
-- every leg reported applied or not applicable; once set, settlement returns before touching either.
-- Existing rows start NULL, so their next launch settles once more and stamps them.
ALTER TABLE users ADD COLUMN signup_settled_at TIMESTAMPTZ;

-- +goose Down
ALTER TABLE users DROP COLUMN signup_settled_at;
