-- sqlc 입력 스키마 스냅샷 — 00001_engram_schema.sql 의 `-- +goose Up` 섹션을 평탄화한 것.
--
-- 단일 출처는 goose 마이그레이션이고, 이 파일은 그 Up DDL의 평탄화 스냅샷이다(goose 주석 없음).
-- sqlc.yaml 의 `schema`가 이 파일을 가리킨다 — 마이그레이션 디렉터리를 직접 가리키면
-- goose `Down` 섹션의 DROP 문을 sqlc가 누적 DDL로 해석해 객체가 드롭된 것으로 오인하기 때문.
-- ⚠️ 마이그레이션을 추가할 때마다 이 파일을 동기화한다.

CREATE EXTENSION IF NOT EXISTS vector;

-- 불변 원본(원칙 1): UPDATE/DELETE 쿼리 절대 생성 금지
CREATE TABLE records (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    body            TEXT NOT NULL,
    entry_date      DATE NOT NULL,
    mood            TEXT,
    intensity       REAL,
    idempotency_key TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX records_idem_idx ON records (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 별(가변): 원본과 분리, record_id로 참조
CREATE TABLE memories (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    record_id        TEXT NOT NULL REFERENCES records(id),
    visual_spec      JSONB,
    last_recalled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX memories_user_idx ON memories (user_id);

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

-- 비동기 큐(§4.6): FOR UPDATE SKIP LOCKED claim용
CREATE TABLE jobs (
    id          TEXT PRIMARY KEY,
    memory_id   TEXT NOT NULL REFERENCES memories(id),
    kind        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    attempts    INT NOT NULL DEFAULT 0,
    error       TEXT NOT NULL DEFAULT '',
    next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX jobs_claim_idx ON jobs (status, next_run_at);

-- 회상 강화 배치 멱등성
CREATE TABLE processed_batches (
    batch_id   TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
