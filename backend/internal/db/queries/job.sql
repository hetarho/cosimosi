-- Async job queue. The RecordMemory transaction enqueues; the embedding
-- worker claims/completes/fails. Jobs are never deleted — a give-up is
-- preserved as status='failed' (constitution §1/§2).

-- name: EnqueueExtractJob :exec
-- Hands segmentation (1 diary → N fragment stars, spec 21) to the async worker.
-- Keyed by record_id — there is no memory yet (the fragments don't exist until
-- the extract worker fans them out). RecordMemory only enqueues.
INSERT INTO jobs (id, record_id, user_id, kind, status)
VALUES ($1, $2, $3, 'extract', 'pending');

-- name: EnqueueEmbedJob :exec
-- Hands embedding/linking of ONE fragment star to the async worker. Enqueued by
-- the extract fan-out transaction (spec 21), one per fragment.
INSERT INTO jobs (id, memory_id, kind, status)
VALUES ($1, $2, 'embed', 'pending');

-- name: EnqueueConsolidateJob :execrows
-- 야간 공고화(spec 27) 잡 enqueue — 별 단위 memory_id 없이 user_id로 키잉(전체 그래프 1패스).
-- 멱등: 그 사용자의 consolidate 잡이 이미 대기/실행 중이면 넣지 않는다(티커가 cmd/api·cmd/worker
-- 양쪽에서 돌거나 하루에 여러 번 깨어나도 중복 적재되지 않게). 반환 행 수로 실제 적재 여부를 안다.
INSERT INTO jobs (id, user_id, kind, status)
SELECT @id, @user_id, 'consolidate', 'pending'
WHERE NOT EXISTS (
    SELECT 1 FROM jobs
    WHERE user_id = @user_id AND kind = 'consolidate' AND status IN ('pending', 'running')
);

-- name: ListActiveUserIDs :many
-- 야간 티커가 consolidate 잡을 돌릴 대상 — 별이 하나라도 있는 사용자(베타 규모엔 distinct로 충분).
SELECT DISTINCT user_id FROM memories;

-- name: ClaimJob :one
-- Atomically claim one job of the kind and mark it running. FOR UPDATE SKIP LOCKED
-- makes concurrent workers safe. Two cases are claimable:
--   (a) a due pending job (status='pending' AND next_run_at<=now()), or
--   (b) a STALE running job (status='running' whose updated_at is older than the
--       lease) — a worker that was killed/crashed/shut down after claiming but
--       before Complete/Fail left it stranded; the lease lets the next worker
--       reclaim it instead of it being orphaned forever. Reclaim does NOT bump
--       attempts (the interruption is not the job's fault). All pipeline steps are
--       idempotent, so reprocessing a reclaimed job is safe.
-- Returns no rows when nothing is claimable.
UPDATE jobs
SET status = 'running', updated_at = now()
WHERE id = (
    SELECT j.id FROM jobs j
    WHERE j.kind = @kind
      AND (
        (j.status = 'pending' AND j.next_run_at <= now())
        OR (j.status = 'running' AND j.updated_at < now() - make_interval(secs => @lease_seconds::float8))
      )
    ORDER BY j.next_run_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
RETURNING id, memory_id, record_id, user_id, attempts;

-- name: CompleteJob :exec
UPDATE jobs SET status = 'done', updated_at = now() WHERE id = @id;

-- name: JobQueueStats :one
-- 큐 백로그 가시화(spec 18): 상태별 카운트 + 최고령 pending의 나이(초). 워커가 주기
-- 요약 로그 한 줄로 남긴다 — 백로그가 침묵 속에 쌓이는 걸 docker logs로 본다.
-- due_pending은 지금 처리 가능한 것(ClaimJob과 같은 next_run_at<=now() 기준) —
-- pending 전체에는 backoff 대기 중인 재시도도 섞여 있어 따로 센다.
SELECT
    count(*) FILTER (WHERE status = 'pending')::int8 AS pending,
    count(*) FILTER (WHERE status = 'pending' AND next_run_at <= now())::int8 AS due_pending,
    count(*) FILTER (WHERE status = 'running')::int8 AS running,
    count(*) FILTER (WHERE status = 'failed')::int8  AS failed,
    COALESCE(
        EXTRACT(EPOCH FROM now() - min(created_at) FILTER (WHERE status = 'pending')),
        0
    )::float8 AS oldest_pending_seconds
FROM jobs;

-- name: FailJob :exec
-- Records the failure and reschedules. The worker passes status='pending' with a
-- backed-off next_run_at to retry, or status='failed' once attempts hit the cap
-- (preserve, never delete). attempts is incremented here.
UPDATE jobs
SET status      = @status,
    attempts    = attempts + 1,
    error       = @error,
    next_run_at = @next_run_at,
    updated_at  = now()
WHERE id = @id;
