-- Session-level serialization for the credits-first invite settlement. The lock is keyed only
-- by the live inviter id and held on one dedicated pool connection across resolve, credit, and
-- rewarded_at stamping; no product row or external directory call is placed in a DB transaction.

-- name: AcquireInviteSettlementLock :one
SELECT pg_advisory_lock(hashtextextended(sqlc.arg(user_id), 610090));

-- name: ReleaseInviteSettlementLock :one
SELECT pg_advisory_unlock(hashtextextended(sqlc.arg(user_id), 610090));
