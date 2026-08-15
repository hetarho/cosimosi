-- The balance-row read. Absent row → pgx.ErrNoRows, which the store maps to nil: the
-- lazy-birth default (a user who never earned/spent derives a full-basic balance with
-- today's window and owns no row until the first write).
-- name: GetTwinkleBalance :one
SELECT user_id, additional, basic_spent_this_window, basic_reset_window, updated_at
FROM twinkle_balances
WHERE user_id = $1;

-- Batch balance facts for the admin list. Missing rows remain absent so the Twinkle service can
-- apply the same lazy-birth default as GetBalance without writing a row.
-- name: ListTwinkleBalancesByUserIDs :many
SELECT user_id, additional, basic_spent_this_window, basic_reset_window, updated_at
FROM twinkle_balances
WHERE user_id = ANY(sqlc.arg(user_ids)::text[]);

-- The spend/charge delta against the existing balance row (one row per user, serialized by
-- the row lock — the universe_state single-writer pattern, so concurrent spends cannot
-- oversell: the CHECKs reject any delta that would drive a tier negative, and the basic_grant
-- guard in the WHERE refuses a basic draw past the daily grant even when two spends planned
-- against the same stale read — the loser matches no row and the store surfaces the
-- rejection). The grant arrives as a query argument (generated twinkle.basic_daily_amount),
-- never a DDL literal. A stale basic_reset_window rolls forward: the fresh window's basic
-- spend starts from just this delta (the prior window's unspent basic is discarded — no carry
-- [G2]); the anchor never rolls backward (GREATEST), so a caller with a stale now accumulates
-- into the current window instead of resurrecting an old one. No row yet → no rows returned;
-- the store births the row via InsertTwinkleBalance (a plain upsert can't carry a negative
-- delta — PG CHECKs the proposed insert tuple even when it conflicts into the UPDATE arm).
-- name: UpdateTwinkleBalanceDelta :one
UPDATE twinkle_balances
SET additional = additional + sqlc.arg(additional_delta),
    basic_spent_this_window = CASE
        WHEN basic_reset_window < sqlc.arg(reset_window) THEN sqlc.arg(basic_spent_delta)::int
        ELSE basic_spent_this_window + sqlc.arg(basic_spent_delta)::int
    END,
    basic_reset_window = GREATEST(basic_reset_window, sqlc.arg(reset_window)),
    updated_at = now()
WHERE user_id = sqlc.arg(user_id)
  AND (CASE
        WHEN basic_reset_window < sqlc.arg(reset_window) THEN sqlc.arg(basic_spent_delta)::int
        ELSE basic_spent_this_window + sqlc.arg(basic_spent_delta)::int
    END) <= sqlc.arg(basic_grant)::int
RETURNING user_id, additional, basic_spent_this_window, basic_reset_window, updated_at;

-- The lazy birth: the first-ever write creates the balance row carrying that first delta
-- directly, so a first-write overdraw hits the CHECK (additional) or the grant guard (basic)
-- and is rejected — never masked to zero. A concurrent birth loses the (user_id) conflict,
-- returns no rows, and the store retries the UPDATE against the winner's row.
-- name: InsertTwinkleBalance :one
INSERT INTO twinkle_balances (
    user_id,
    additional,
    basic_spent_this_window,
    basic_reset_window
)
SELECT sqlc.arg(user_id),
       sqlc.arg(additional_delta),
       sqlc.arg(basic_spent_delta),
       sqlc.arg(reset_window)
WHERE sqlc.arg(basic_spent_delta)::int <= sqlc.arg(basic_grant)::int
ON CONFLICT (user_id) DO NOTHING
RETURNING user_id, additional, basic_spent_this_window, basic_reset_window, updated_at;

-- The append-only log write ([I1] — twinkle_ledger_entries is never UPDATEd/DELETEd by the
-- system). ON CONFLICT DO NOTHING covers both the per-user idempotency guard and the partial
-- global payment-transaction guard: either replay affects 0 rows instead of double-applying
-- (NULL dedup_key opts out — PG treats NULLs as distinct).
-- name: AppendTwinkleLedgerEntry :execrows
INSERT INTO twinkle_ledger_entries (
    id,
    user_id,
    kind,
    reason,
    amount,
    from_basic,
    from_additional,
    dedup_key,
    created_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
)
ON CONFLICT DO NOTHING;

-- Disambiguate an idempotency conflict from an unrelated primary-key collision after the
-- unqualified ON CONFLICT above. General keys are user-scoped; payment transaction keys are
-- deliberately global because one provider transaction cannot be replayed across accounts.
-- name: TwinkleLedgerDedupExists :one
SELECT EXISTS (
    SELECT 1
    FROM twinkle_ledger_entries
    WHERE dedup_key = sqlc.arg(dedup_key)
      AND (
          user_id = sqlc.arg(user_id)
          OR (reason = 'payment' AND sqlc.arg(entry_reason)::text = 'payment')
      )
);

-- Serialize the inviter-side lifetime cap inside the same transaction that writes both invite
-- legs. A transaction advisory lock leaves no row or reservation behind and is released on
-- commit, rollback, or connection loss.
-- name: LockTwinkleInviteRewardsByInviter :one
SELECT pg_advisory_xact_lock(hashtextextended(sqlc.arg(user_id), 610091));

-- The ledger is the crash-safe backstop for the account invite count: credits exist before
-- invites.rewarded_at, so a post-credit crash must still consume one lifetime slot. A replay
-- of this exact inviter key remains admissible at the cap so account can stamp rewarded_at.
-- name: GetTwinkleInviteRewardState :one
SELECT count(*)::bigint AS reward_count,
       coalesce(bool_or(dedup_key = sqlc.arg(dedup_key)), false)::bool AS replay
FROM twinkle_ledger_entries
WHERE user_id = sqlc.arg(user_id)
  AND kind = 'earn'
  AND reason = 'invite'
  AND dedup_key LIKE 'invite:%';

-- The chronological history read ([G7][U9]): newest first, keyset-paged on (created_at, id) so a
-- page boundary cannot skip or duplicate a row when an entry lands mid-scroll — which OFFSET would.
-- Ties on created_at break on the backend-minted id: arbitrary, but total and stable. Conjunctively
-- user-scoped over the one relation, so a cross-user page is unrepresentable rather than validated.
-- name: ListTwinkleLedgerPage :many
SELECT id, kind, reason, amount, from_basic, from_additional, created_at
FROM twinkle_ledger_entries
WHERE user_id = sqlc.arg(user_id)
  AND (
      sqlc.narg(cursor_created_at)::timestamptz IS NULL
      OR (created_at, id) < (sqlc.narg(cursor_created_at)::timestamptz, sqlc.narg(cursor_id)::text)
  )
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg(page_size);
