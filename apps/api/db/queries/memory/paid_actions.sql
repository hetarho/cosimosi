-- Paid-action idempotency receipts (A2/A3). Every query is user-scoped ([U1]); the recall/gist-view
-- transaction takes the per-user graph advisory lock (LockGraphMutation) before the lookup, so
-- concurrent duplicates of one operation serialize — the loser reads the winner's committed receipt
-- instead of doing the work twice.

-- The receipt lookup by client operation id. Absent → pgx.ErrNoRows (the use-case treats it as "no
-- prior commit, do the work"). A present row's action_kind + request_fingerprint are compared in Go:
-- an exact match replays `response`; a mismatch (same id, different canonical input) is a conflict.
-- name: GetPaidActionReceipt :one
SELECT action_kind, request_fingerprint, response
FROM memory_paid_action_receipts
WHERE user_id = sqlc.arg(user_id) AND operation_id = sqlc.arg(operation_id);

-- The commit-time receipt write, in the same transaction as the debit + effects (A3). Exactly one
-- of episodic_memory_id / diary_id is set (the table CHECK), tying the receipt to its retained
-- target for cascade cleanup. A plain INSERT is safe: the graph lock guarantees single-writer per
-- user, and the lookup above already proved no receipt exists for this operation.
-- name: InsertPaidActionReceipt :exec
INSERT INTO memory_paid_action_receipts (
    user_id,
    operation_id,
    action_kind,
    request_fingerprint,
    episodic_memory_id,
    diary_id,
    response
) VALUES (
    sqlc.arg(user_id),
    sqlc.arg(operation_id),
    sqlc.arg(action_kind),
    sqlc.arg(request_fingerprint),
    sqlc.narg(episodic_memory_id),
    sqlc.narg(diary_id),
    sqlc.arg(response)
);
