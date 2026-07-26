-- Invite aggregate reads use the inviter's user_id as their scope ([U1][U8][G6]).

-- Bind from the verified capability payload only. The authenticated invitee is a parameter,
-- while the inviter-shaped user_id is accepted only when that product-owned user is still live.
-- name: BindInviteToInvitee :one
INSERT INTO invites (id, user_id, invitee_user_id, token, created_at, bound_at)
SELECT sqlc.arg(id),
       sqlc.arg(user_id),
       sqlc.arg(invitee_user_id),
       sqlc.arg(token),
       sqlc.arg(created_at),
       sqlc.arg(bound_at)
FROM users
WHERE users.user_id = sqlc.arg(user_id)
  AND users.deleted_at IS NULL
  AND sqlc.arg(user_id) <> sqlc.arg(invitee_user_id)
-- A replayed token is an expected best-effort refusal. The invitee uniqueness race is
-- classified at the pg edge; every other constraint violation (especially an id collision)
-- remains an infrastructure/integrity error.
ON CONFLICT (token) DO NOTHING
RETURNING id;

-- Deliberately invitee-scoped: one authenticated invitee can own at most one row, and this
-- returns only the settlement identity. The persistence gate cannot express invitee_user_id as
-- the authenticated scope, so this one relationship read is explicitly allowlisted.
-- name: FindSettleableInviteForInvitee :one
SELECT invites.id,
       invites.user_id AS inviter_user_id,
       invites.token
FROM invites
JOIN users ON users.user_id = invites.user_id
WHERE invites.invitee_user_id = sqlc.arg(invitee_user_id)
  AND invites.user_id <> sqlc.arg(invitee_user_id)
  AND invites.rewarded_at IS NULL
  AND users.deleted_at IS NULL
LIMIT 1;

-- name: CountRewardedInvitesByInviter :one
SELECT count(*)
FROM invites
WHERE user_id = sqlc.arg(user_id)
  AND rewarded_at IS NOT NULL;

-- name: MarkInviteRewarded :exec
UPDATE invites
SET rewarded_at = sqlc.arg(rewarded_at)
WHERE user_id = sqlc.arg(user_id)
  AND id = sqlc.arg(id)
  AND rewarded_at IS NULL;
