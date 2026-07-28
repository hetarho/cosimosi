-- Account withdrawal owns only the User aggregate and its account-context dependents.

-- name: AccountWithdrawalStatus :one
SELECT deleted_at
FROM users
WHERE user_id = sqlc.arg(user_id);

-- name: AccountWithdrawalStatusForUpdate :one
SELECT deleted_at
FROM users
WHERE user_id = sqlc.arg(user_id)
FOR UPDATE;

-- name: MarkAccountWithdrawn :one
UPDATE users
SET deleted_at = sqlc.arg(deleted_at)
WHERE user_id = sqlc.arg(user_id)
  AND deleted_at IS NULL
RETURNING deleted_at;

-- name: ClearAccountWithdrawal :execrows
UPDATE users
SET deleted_at = NULL
WHERE user_id = sqlc.arg(user_id)
  AND deleted_at = sqlc.arg(deleted_at);

-- name: PurgeAccountAuthProviders :exec
DELETE FROM auth_providers
WHERE user_id = sqlc.arg(user_id);

-- Only invitations owned by the withdrawing inviter are theirs to erase. A row
-- naming them as invitee belongs to the inviter and deliberately survives.
-- name: PurgeAccountInvites :exec
DELETE FROM invites
WHERE user_id = sqlc.arg(user_id);

-- name: PurgeAccountMoodColors :exec
DELETE FROM mood_colors
WHERE user_id = sqlc.arg(user_id);

-- Completion marker: called only after every context leg and credential deletion.
-- name: PurgeAccountUser :execrows
DELETE FROM users
WHERE user_id = sqlc.arg(user_id);
