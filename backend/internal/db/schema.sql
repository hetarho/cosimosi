-- sqlc 입력 스키마 스냅샷 — 00001_engram_schema.sql 의 `-- +goose Up` 섹션을 평탄화한 것.
--
-- 단일 출처는 goose 마이그레이션이고, 이 파일은 그 Up DDL의 평탄화 스냅샷이다(goose 주석 없음).
-- sqlc.yaml 의 `schema`가 이 파일을 가리킨다 — 마이그레이션 디렉터리를 직접 가리키면
-- goose `Down` 섹션의 DROP 문을 sqlc가 누적 DDL로 해석해 객체가 드롭된 것으로 오인하기 때문.
-- ⚠️ 마이그레이션을 추가할 때마다 이 파일을 동기화한다.

CREATE EXTENSION IF NOT EXISTS vector;

-- 불변 원본(원칙 1): UPDATE/DELETE 쿼리 절대 생성 금지.
-- mood/intensity/valence는 선택적 전체-일기 사용자 힌트(prior, spec 21).
CREATE TABLE records (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    body            TEXT NOT NULL,
    entry_date      DATE NOT NULL,
    mood            TEXT,
    intensity       REAL,
    idempotency_key TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    valence         REAL                              -- 00004(spec 21)
);
CREATE UNIQUE INDEX records_idem_idx ON records (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 별(가변): 원본과 분리, record_id로 참조(non-unique — 1 record → N 조각 별, spec 21).
-- 조각별 감정(mood/intensity/valence)·조각 데이터(fragment_*)는 이 가변 레이어에 산다.
CREATE TABLE memories (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    record_id        TEXT NOT NULL REFERENCES records(id),
    visual_spec      JSONB,
    last_recalled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    mood             TEXT,                             -- 00004(spec 21) 조각 감정
    intensity        REAL,                             -- 00004 조각 강도 0~1
    fragment_index   INT NOT NULL DEFAULT 0,           -- 00004 일기 내 조각 순서
    fragment_text    TEXT,                             -- 00004 임베딩용 조각 텍스트(NULL → r.body)
    valence          REAL DEFAULT 0,                   -- 00004 부호 정동 -1..1
    brightness_offset REAL NOT NULL DEFAULT 0,         -- 00005(spec 23) 재공고화 누적 ±밝기 오프셋
    hue_shift        REAL NOT NULL DEFAULT 0,          -- 00005 감정 기준 색 ±28° 색조
    form_seed_delta  REAL NOT NULL DEFAULT 0,          -- 00005 형태 시드 미세 jitter(27 야간 요지가 단조 증가)
    version          INT NOT NULL DEFAULT 0,           -- 00005 재성형 횟수(=변천사 길이)
    stable_x         REAL,                             -- 00006(spec 27) 야간 재안정화 안정 좌표 캐시(권위 아님 — 헌법3)
    stable_y         REAL,                             -- 00006 클라/서버가 force-sim 재진입 시드로만 재사용(proto 미노출)
    stable_z         REAL                              -- 00006 NULL이면 처음부터 산출
);
CREATE INDEX memories_user_idx ON memories (user_id);
CREATE UNIQUE INDEX memories_record_fragment_idx ON memories (record_id, fragment_index);

-- 임베딩: vector(1536) 비수식 선언(sqlc #3548 회피)
CREATE TABLE embeddings (
    memory_id TEXT PRIMARY KEY REFERENCES memories(id),
    user_id   TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    model     TEXT NOT NULL
);
CREATE INDEX embeddings_hnsw_idx ON embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX embeddings_user_idx ON embeddings (user_id);

-- 시냅스(가중치 그래프): 무방향 1행 정규화 a_id < b_id, 삭제 안 함(원칙 2)
CREATE TABLE memory_links (
    a_id                TEXT NOT NULL REFERENCES memories(id),
    b_id                TEXT NOT NULL REFERENCES memories(id),
    user_id             TEXT NOT NULL,
    weight              REAL NOT NULL,
    link_type           TEXT NOT NULL,
    co_activation_count INT NOT NULL DEFAULT 0,
    last_activated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (a_id, b_id),
    CONSTRAINT memory_links_order_chk CHECK (a_id < b_id)
);
CREATE INDEX memory_links_b_idx ON memory_links (b_id);
CREATE INDEX memory_links_user_idx ON memory_links (user_id);

-- 비동기 큐(§4.6): FOR UPDATE SKIP LOCKED claim용.
-- 키잉(00004, spec 21): embed job = memory_id, extract job = record_id(memory_id NULL),
-- consolidate job(27) = user_id.
CREATE TABLE jobs (
    id          TEXT PRIMARY KEY,
    memory_id   TEXT REFERENCES memories(id),
    kind        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    attempts    INT NOT NULL DEFAULT 0,
    error       TEXT NOT NULL DEFAULT '',
    next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    record_id   TEXT REFERENCES records(id),          -- 00004(spec 21) extract job 키
    user_id     TEXT                                  -- 00004 consolidate job 키(27)
);
CREATE INDEX jobs_claim_idx ON jobs (status, next_run_at);
-- 사용자당 활성(대기/실행) consolidate 잡 최대 1개(27 — 야간 티커 중복 적재 방지 백스톱).
CREATE UNIQUE INDEX jobs_one_active_consolidate_idx ON jobs (user_id)
    WHERE kind = 'consolidate' AND status IN ('pending', 'running');

-- 회상 강화 배치 멱등성
CREATE TABLE processed_batches (
    batch_id   TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 재공고화 변천사(spec 23, 00005): 별이 다시 빚어질 때마다 1행 append(INSERT 전용 —
-- UPDATE/DELETE 절대 금지, 헌법1·2). 24가 version 오름차순으로 읽어 타임랩스를 그린다.
CREATE TABLE evolution_history (
    id              TEXT PRIMARY KEY,
    memory_id       TEXT NOT NULL REFERENCES memories(id),
    user_id         TEXT NOT NULL,
    version         INT  NOT NULL,
    brightness      REAL NOT NULL,
    hue_shift       REAL NOT NULL,
    form_seed_delta REAL NOT NULL,
    trigger         TEXT NOT NULL,
    pe              REAL NOT NULL,
    dir             INT  NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX evolution_history_memory_idx ON evolution_history (memory_id, version);

-- 시각 개인 설정(spec 30, 00002): 서버는 사용자 오버라이드만 저장(기본값은 클라 소유).
CREATE TABLE user_settings (
    user_id     TEXT PRIMARY KEY,
    theme       TEXT,
    star_object TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 감정색 오버라이드 — 정규화 행(미래 "xx%가 골랐어요" GROUP BY (mood,color) 집계).
CREATE TABLE user_emotion_colors (
    user_id TEXT NOT NULL,
    mood    TEXT NOT NULL,
    color   TEXT NOT NULL,
    PRIMARY KEY (user_id, mood)
);

-- 관리자 콘솔 LLM 운영(spec 34, 00003): overrides-only — 코드 매트릭스가 SSOT, DB는
-- 관리자가 바꾼 것(추가 모델·AES-256-GCM 암호화 키·활성 선택·사용량 누적)만 담는다.
CREATE TABLE llm_provider_configs (
    provider      TEXT PRIMARY KEY,
    models        TEXT[] NOT NULL DEFAULT '{}',
    api_key_enc   BYTEA,
    api_key_last4 TEXT,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE llm_selection (
    id         SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    provider   TEXT NOT NULL,
    model      TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE llm_usage_daily (
    day           DATE NOT NULL,
    provider      TEXT NOT NULL,
    model         TEXT NOT NULL,
    kind          TEXT NOT NULL,
    calls         BIGINT NOT NULL DEFAULT 0,
    input_tokens  BIGINT NOT NULL DEFAULT 0,
    output_tokens BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (day, provider, model, kind)
);

-- 우주 공개(spec 35, 00007): 사용자당 1행 overrides-only. slug(base64url 22자·UNIQUE)로 무인증
-- 방문 라우트(/u/:slug)가 풍경만 공개한다. enabled=false·회전 시 옛 slug는 즉시 NotFound.
-- 원본 일기·조각 텍스트는 어떤 컬럼으로도 담지 않는다(콘텐츠 제로 — 풍경만).
CREATE TABLE universe_shares (
    user_id      TEXT PRIMARY KEY,
    slug         TEXT NOT NULL UNIQUE,
    enabled      BOOLEAN NOT NULL DEFAULT false,
    display_name TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    rotated_at   TIMESTAMPTZ
);
