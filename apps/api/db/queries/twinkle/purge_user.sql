-- Account withdrawal's Twinkle-context leg. Counterpart rows belong to their own
-- users and are never reversed or deleted.

-- name: PurgeUserTwinkleLedger :exec
DELETE FROM twinkle_ledger_entries
WHERE user_id = sqlc.arg(user_id);

-- name: PurgeUserTwinkleBalance :exec
DELETE FROM twinkle_balances
WHERE user_id = sqlc.arg(user_id);
