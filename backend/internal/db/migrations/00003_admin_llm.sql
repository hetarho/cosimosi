-- +goose Up
-- 관리자 콘솔 LLM 운영(spec 34). overrides-only(30 철학): 공급자 목록·기본 모델·엔드포인트의
-- SSOT는 코드 매트릭스(internal/llm/providers.go)이고, DB에는 관리자가 바꾼 것(추가 모델·
-- 암호화된 키·활성 선택)만 담는다 — 시드 행 없음.
--
-- 키 보안: api_key_enc는 AES-256-GCM 봉투 암호문(0x01‖nonce‖ct, AAD=provider)만 저장.
-- 마스터키(LLM_KEY_ENCRYPTION_KEY)는 서버 env에만 있으므로 DB 덤프 단독으론 복호화 불가.
CREATE TABLE llm_provider_configs (
    provider      TEXT PRIMARY KEY,             -- openai|gemini|claude|deepseek|grok (+미래 확장)
    models        TEXT[] NOT NULL DEFAULT '{}', -- 관리자가 추가한 지원 모델(기본 모델은 코드 매트릭스)
    api_key_enc   BYTEA,                        -- 0x01‖nonce‖ct (NULL=키 없음)
    api_key_last4 TEXT,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 활성 추출 LLM(단일행). 비어 있으면 Resolver가 env(LLM_PROVIDER/키)로 폴백한다.
CREATE TABLE llm_selection (
    id         SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    provider   TEXT NOT NULL,
    model      TEXT NOT NULL DEFAULT '',        -- '' = 공급자 기본 모델
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LLM 토큰 사용량 upsert 누적(일×공급자×모델×kind). 사용자당 AI 원가(수익화 단위경제)의
-- 원천 데이터 — 비용 환산(단가표)은 FE 정적 상수가 담당한다.
CREATE TABLE llm_usage_daily (
    day           DATE NOT NULL,                -- UTC
    provider      TEXT NOT NULL,
    model         TEXT NOT NULL,
    kind          TEXT NOT NULL,                -- 'extract' (embed는 후속)
    calls         BIGINT NOT NULL DEFAULT 0,
    input_tokens  BIGINT NOT NULL DEFAULT 0,
    output_tokens BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (day, provider, model, kind)
);

-- +goose Down
DROP TABLE llm_usage_daily;
DROP TABLE llm_selection;
DROP TABLE llm_provider_configs;
