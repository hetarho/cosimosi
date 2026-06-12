-- 관리자 콘솔(spec 34): LLM 공급자 설정 CRUD·활성 선택·토큰 사용량 누적·대시보드 집계.
-- overrides-only — 행이 없으면 그 공급자는 "기본값 그대로"(서비스가 코드 매트릭스와 병합).
-- ⚠️ api_key_enc는 AES-256-GCM 암호문만 담는다. 평문을 SELECT하는 쿼리는 존재하지 않고,
-- 암호문 자체도 ConfigSource 복호화 경로(GetLLMProviderKeyEnc)만 읽는다.

-- name: ListLLMProviderConfigs :many
-- 콘솔 카드용 상태 조회 — 암호문은 내보내지 않고 존재 여부(key_set)만 노출한다.
SELECT provider, models, (api_key_enc IS NOT NULL)::bool AS key_set, api_key_last4, updated_at
FROM llm_provider_configs
ORDER BY provider;

-- name: GetLLMProviderKeyEnc :one
-- Resolver/TestProviderKey의 복호화 입력. 행 없음 = 키 없음(pgx.ErrNoRows).
SELECT api_key_enc FROM llm_provider_configs WHERE provider = $1;

-- name: UpsertLLMProviderKey :exec
INSERT INTO llm_provider_configs (provider, api_key_enc, api_key_last4, updated_at)
VALUES (@provider, @api_key_enc, @api_key_last4, now())
ON CONFLICT (provider) DO UPDATE SET
    api_key_enc   = EXCLUDED.api_key_enc,
    api_key_last4 = EXCLUDED.api_key_last4,
    updated_at    = now();

-- name: ClearLLMProviderKey :exec
-- 키 삭제는 NULL 비우기 — 행(모델 리스트)은 남는다.
UPDATE llm_provider_configs
SET api_key_enc = NULL, api_key_last4 = NULL, updated_at = now()
WHERE provider = @provider;

-- name: UpsertLLMProviderModels :exec
-- 모델 리스트 통째 교체(관리자 편집 결과가 곧 전체 리스트).
-- updated_at은 건드리지 않는다 — 그 컬럼은 "키가 언제 바뀌었나"(key_updated_at 표시)로
-- 소비되므로 모델 편집이 키 갱신 시각을 덮어쓰면 로테이션 감사가 깨진다.
INSERT INTO llm_provider_configs (provider, models)
VALUES (@provider, @models)
ON CONFLICT (provider) DO UPDATE SET
    models = EXCLUDED.models;

-- name: GetLLMSelection :one
-- 활성 추출 LLM(단일행). 행 없음 = 미설정 → Resolver가 env로 폴백.
SELECT provider, model FROM llm_selection WHERE id = 1;

-- name: UpsertLLMSelection :exec
INSERT INTO llm_selection (id, provider, model, updated_at)
VALUES (1, @provider, @model, now())
ON CONFLICT (id) DO UPDATE SET
    provider   = EXCLUDED.provider,
    model      = EXCLUDED.model,
    updated_at = now();

-- name: AddLLMUsage :exec
-- (UTC day × provider × model × kind) 행에 호출/토큰을 upsert 누적한다(4.2).
INSERT INTO llm_usage_daily (day, provider, model, kind, calls, input_tokens, output_tokens)
VALUES (@day, @provider, @model, @kind, @calls, @input_tokens, @output_tokens)
ON CONFLICT (day, provider, model, kind) DO UPDATE SET
    calls         = llm_usage_daily.calls + EXCLUDED.calls,
    input_tokens  = llm_usage_daily.input_tokens + EXCLUDED.input_tokens,
    output_tokens = llm_usage_daily.output_tokens + EXCLUDED.output_tokens;

-- name: ListLLMUsageSince :many
SELECT day, provider, model, kind, calls, input_tokens, output_tokens
FROM llm_usage_daily
WHERE day >= @since
ORDER BY day, provider, model, kind;

-- name: AdminTotals :one
-- 합계 4종 — 전부 인덱스/시퀀셜 카운트, 관리자 클릭 시 1회(베타 규모에서 ms 단위).
-- users 기본값은 기록 보유 사용자 수(우리 스키마엔 사용자 테이블이 없다 — 4.3);
-- auth.users 카운트는 repository가 to_regclass 가드로 곁들인다.
SELECT
    (SELECT count(DISTINCT user_id) FROM records)::int8 AS users,
    (SELECT count(*) FROM records)::int8                AS records,
    (SELECT count(*) FROM memories)::int8               AS memories,
    (SELECT count(*) FROM memory_links)::int8           AS synapses;

-- name: AdminJobCounts :one
-- 잡 큐 건강(failed 적체 감지). done_24h = 최근 24시간 완료분.
SELECT
    count(*) FILTER (WHERE status = 'pending')::int8 AS pending,
    count(*) FILTER (WHERE status = 'running')::int8 AS processing,
    count(*) FILTER (WHERE status = 'failed')::int8  AS failed,
    count(*) FILTER (WHERE status = 'done' AND updated_at >= now() - interval '24 hours')::int8 AS done_24h
FROM jobs;

-- name: AdminRecordDaySeries :many
-- 최근 30일 일기 작성 추이(UTC 일 단위) — 성장 스파크라인 입력.
SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*)::int8 AS count
FROM records
WHERE created_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1;
