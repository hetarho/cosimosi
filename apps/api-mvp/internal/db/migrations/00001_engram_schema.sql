-- 엔그램 우주의 영속 계층(3겹): 불변 원본(records) · 가변 별(memories) ·
-- 임베딩(embeddings) · 시냅스 가중치 그래프(memory_links) · 비동기 큐(jobs) ·
-- 회상 강화 멱등(processed_batches). 이 DDL이 단일 권위 스키마다.
--
-- 헌법: ① 원본 일기 불변(records UPDATE/DELETE 쿼리 절대 금지) ② 별·시냅스 행 삭제 금지(감쇠는 밝기만).

-- +goose Up

CREATE EXTENSION IF NOT EXISTS vector;

-- 불변 원본(원칙 1): UPDATE/DELETE 쿼리 절대 생성 금지
CREATE TABLE records (
    id              TEXT PRIMARY KEY,            -- 서버 생성 nanoid/uuid
    user_id         TEXT NOT NULL,               -- = Supabase auth uid (단일 사용자 MVP: FK 없음)
    body            TEXT NOT NULL,               -- 일기 원본(불변)
    entry_date      DATE NOT NULL,
    mood            TEXT,                        -- nullable; enum 이름 7종 중 하나 또는 null
    intensity       REAL,                        -- nullable; 0~1 비주얼용
    idempotency_key TEXT,                        -- nullable; RecordMemory 멱등키
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 별(가변): 원본과 분리, record_id로 참조. mood/intensity/entry_date는 records에만(JOIN으로 읽음)
CREATE TABLE memories (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    record_id        TEXT NOT NULL REFERENCES records(id),
    visual_spec      JSONB,                                -- nullable; MVP 미사용(FE가 memory_id로 seed 결정론 파생)
    last_recalled_at TIMESTAMPTZ NOT NULL DEFAULT now(),   -- 활성도 감쇠 기준(§6)
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 임베딩: ⚠️ vector(1536) 비수식 선언(public.vector 금지 — sqlc #3548)
CREATE TABLE embeddings (
    memory_id TEXT PRIMARY KEY REFERENCES memories(id),
    user_id   TEXT NOT NULL,            -- 격리: 모든 KNN 쿼리에 WHERE user_id 강제
    embedding vector(1536) NOT NULL,
    model     TEXT NOT NULL             -- 어댑터/차원 기록
);

-- 시냅스(가중치 그래프): 무방향 1행 정규화 a_id < b_id, 삭제 안 함(원칙 2)
CREATE TABLE memory_links (
    a_id                TEXT NOT NULL REFERENCES memories(id),
    b_id                TEXT NOT NULL REFERENCES memories(id),
    user_id             TEXT NOT NULL,           -- 격리: a_id/b_id 둘 다 같은 user 소속
    weight              REAL NOT NULL,           -- 0~1
    link_type           TEXT NOT NULL,           -- semantic/temporal/entity/co_recall
    co_activation_count INT NOT NULL DEFAULT 0,
    last_activated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (a_id, b_id),
    CONSTRAINT memory_links_order_chk CHECK (a_id < b_id)
);

-- 비동기 큐(§4.6): FOR UPDATE SKIP LOCKED claim용
CREATE TABLE jobs (
    id          TEXT PRIMARY KEY,
    memory_id   TEXT NOT NULL REFERENCES memories(id),
    kind        TEXT NOT NULL,                    -- embed/extract
    status      TEXT NOT NULL DEFAULT 'pending',  -- pending/running/done/failed
    attempts    INT NOT NULL DEFAULT 0,
    error       TEXT NOT NULL DEFAULT '',
    next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- 지수 백오프 예약 시각(now + base*2^attempts)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 회상 강화 배치 멱등성: 이미 본 batch_id면 ReinforceLinks skip(재전송 이중 가산 방지)
CREATE TABLE processed_batches (
    batch_id   TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스(HNSW 포함)는 goose의 세미콜론 분할에 흔들리지 않도록 StatementBegin/End로 보호한다.
-- +goose StatementBegin
-- 멱등성: (user_id, idempotency_key) 부분 UNIQUE — key가 NULL이면 제약 없음
CREATE UNIQUE INDEX records_idem_idx ON records (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX memories_user_idx ON memories (user_id);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX embeddings_hnsw_idx ON embeddings USING hnsw (embedding vector_cosine_ops);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX embeddings_user_idx ON embeddings (user_id);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX memory_links_b_idx ON memory_links (b_id);  -- 역방향 이웃 조회
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX memory_links_user_idx ON memory_links (user_id);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX jobs_claim_idx ON jobs (status, next_run_at);  -- claim: status + next_run_at<=now()
-- +goose StatementEnd

-- +goose Down

DROP TABLE IF EXISTS processed_batches, jobs, memory_links, embeddings, memories, records CASCADE;
DROP EXTENSION IF EXISTS vector;
