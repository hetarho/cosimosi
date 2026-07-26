-- Invite aggregate reads use the inviter's user_id as their scope ([U1][U8][G6]).

-- name: CountRewardedInvitesByInviter :one
SELECT count(*)
FROM invites
WHERE user_id = sqlc.arg(user_id)
  AND rewarded_at IS NOT NULL;
