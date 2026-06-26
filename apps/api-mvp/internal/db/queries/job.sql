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

-- name: EnqueueRewriteIfDue :execrows
-- 재공고화 AI 내용 변형(spec 54) 잡 enqueue — 별 열람(RecallMemory) 시 best-effort. 게이트(전부 SQL에서):
--   ① 추상화 단계 ≥ 임계(stage_threshold) — 또렷한 별(단계<2)은 내용 안 바뀜(A1).
--   ② 디바운스(A6) + 중복 방지: 이 별의 rewrite 잡이 대기/실행 중이거나 debounce_cutoff 이후에 처리된 적
--      있으면 skip. updated_at으로 판정하므로 실제 변형이 일어난 잡뿐 아니라 *무변(no-op)으로 끝난 잡*도
--      디바운스에 든다 — AI 꺼짐/동일 출력이라 변천사 행이 안 쌓여도 연속 열람이 잡을 무한 재적재하지 않게.
--      잡은 삭제 안 됨(done 보존)이라 done 잡의 updated_at = 처리 시각 → 시간 창 판정에 그대로 쓸 수 있다.
-- 반환 행 수로 실제 적재 여부를 안다(로그용). 임계·디바운스는 values.yaml(rewrite.*)에서 service가 넘긴다.
-- ON CONFLICT DO NOTHING + jobs_one_active_rewrite_idx(00014): 동시 회상 둘이 NOT EXISTS를 같이 통과해도
-- (READ COMMITTED, 서로의 미커밋 INSERT 미관측) 두 번째 INSERT는 부분 유니크 인덱스에 막혀 조용히 0행 — 별당
-- 활성 rewrite 잡은 정확히 1개. 레이스 패자는 에러 아닌 no-op(best-effort enqueue 계약과 정합).
INSERT INTO jobs (id, memory_id, user_id, kind, status)
SELECT @id, m.id, m.user_id, 'rewrite', 'pending'
FROM memories m
WHERE m.id = @memory_id AND m.user_id = @user_id
  AND m.abstraction_stage >= sqlc.arg(stage_threshold)::int
  AND NOT EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.memory_id = m.id AND j.kind = 'rewrite'
      AND (j.status IN ('pending', 'running') OR j.updated_at >= sqlc.arg(debounce_cutoff)::timestamptz)
  )
ON CONFLICT DO NOTHING;

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

-- name: CompleteConsolidateJob :execrows
-- Guarded completion for the nightly pass (spec 27 change 20): only completes a job still
-- 'running'. Returns 0 rows if another worker already completed it — which happens when a job
-- outruns the 120s claim lease and a second worker reclaims it (ClaimJob case b). The nightly
-- reweight is NOT idempotent (multiplicative/additive), so unlike the extract/embed pipeline a
-- double commit would double-apply it; RunConsolidation rolls back its whole tx when this returns
-- 0, making the consolidation exactly-once (the first committer wins, the loser discards its writes).
UPDATE jobs SET status = 'done', updated_at = now() WHERE id = @id AND status = 'running';

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
