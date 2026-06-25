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

-- ── 사용자 목록 + 별가루 지급(spec 46) ──────────────────────────────────────────────
-- ⚠️ production Supabase는 auth.users가 1차 출처라 repository가 to_regclass 가드 + raw SQL로
-- 대체한다(sqlc는 auth 스키마를 모델링하지 않는다 — AdminTotals와 같은 패턴). 아래 쿼리는
-- auth.users가 없는 로컬/fallback 경로: 앱 도메인 테이블의 user_id 합집합을 1차 출처로 쓴다.

-- name: AdminListUsersFallback :many
-- 앱 도메인 테이블 user_id 합집합 keyset 페이지네이션(user_id ASC). query는 대소문자 무시 부분 일치
-- (position으로 ILIKE 와일드카드 주입 회피). 유효 잔액 = COALESCE(지갑, starting_stardust) — 목록 조회는
-- 지갑을 시드하지 않는다(wallet_seeded=false면 아직 행 없음). page_limit = page_size + 1(다음 페이지 탐지).
WITH all_users AS (
    SELECT user_id AS uid FROM records
    UNION SELECT user_id FROM memories
    UNION SELECT user_id FROM user_settings
    UNION SELECT user_id FROM user_wallet
    UNION SELECT user_id FROM user_owned_items
    UNION SELECT user_id FROM user_emotion_colors
    UNION SELECT user_id FROM universe_shares
    UNION SELECT user_id FROM invite_redemptions
)
SELECT u.uid AS user_id,
       COALESCE(w.stardust, @starting_stardust::int)::int AS stardust,
       (w.user_id IS NOT NULL)::bool AS wallet_seeded
FROM all_users u
LEFT JOIN user_wallet w ON w.user_id = u.uid
WHERE (@query::text = '' OR position(lower(@query::text) IN lower(u.uid)) > 0)
  AND (@page_token::text = '' OR u.uid > @page_token::text)
ORDER BY u.uid ASC
LIMIT @page_limit::int;

-- target 존재 확인(production auth.users / 로컬 fallback 합집합)은 repository_pg가 raw SQL로 처리한다
-- (sqlc 분석기가 auth 스키마를 모델링하지 않고, 다중-테이블 UNION EXISTS의 param 타입도 해석하지 못함 —
-- AdminTotals의 auth.users 가드와 같은 정책).

-- name: AdminAddStardust :one
-- 관리자 지급 증가(spec 46): SeedWallet(settings.sql, 멱등)로 행 보장 후 호출. overflow 가드 —
-- 잔액+지급액이 INT4 상한을 넘으면 0행(pgx.ErrNoRows) → 서비스가 ErrStardustOverflow로 거부.
-- bigint 산술로 비교해 int4 연산 자체의 오버플로를 피한다. RETURNING으로 지급 후 잔액을 돌려준다.
UPDATE user_wallet
SET stardust = stardust + @amount::int, updated_at = now()
WHERE user_id = @user_id
  AND stardust::bigint + @amount::bigint <= 2147483647
RETURNING stardust;

-- name: InsertStardustGrant :exec
-- 지급 감사 행 append(같은 트랜잭션). UI 비노출이지만 운영 추적·사고 복구용 내부 기록.
INSERT INTO admin_stardust_grants
    (id, admin_user_id, target_user_id, amount, balance_before, balance_after)
VALUES (@id, @admin_user_id, @target_user_id, @amount, @balance_before, @balance_after);
