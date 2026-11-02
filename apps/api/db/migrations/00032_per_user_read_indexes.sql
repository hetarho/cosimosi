-- +goose Up

-- [ARCH-11] Per-user reads that grow with a user's data get an index matching their shape:
--   - the twinkle ledger page is a keyset scan ordered by (created_at DESC, id DESC) per user;
--   - the launch's persist-time dedup matches LOWER(name) among the user's live neurons, inside the
--     graph lock;
--   - an inviter's rewarded-invite count and the withdrawal purge filter invites by user_id.
CREATE INDEX IF NOT EXISTS twinkle_ledger_entries_user_page_idx
    ON twinkle_ledger_entries (user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS neurons_user_lower_name_idx
    ON neurons (user_id, lower(name)) WHERE sealed_at IS NULL;
CREATE INDEX IF NOT EXISTS invites_user_idx ON invites (user_id);

-- +goose Down
DROP INDEX IF EXISTS invites_user_idx;
DROP INDEX IF EXISTS neurons_user_lower_name_idx;
DROP INDEX IF EXISTS twinkle_ledger_entries_user_page_idx;
