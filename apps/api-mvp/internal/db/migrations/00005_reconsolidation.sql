-- 재공고화 재성형(spec 23): 회상이 예측 오차(PE) 게이트로 말랑한 창을 열 때만 별을
-- 양방향으로 다시 빚고, 모든 변형을 append-only 변천사(evolution_history)에 쌓는다.
-- 재성형 상태는 가변 별(memories) 레이어에만 둔다 — 불변 records엔 절대 두지 않는다(헌법1).
-- evolution_history는 INSERT 전용: UPDATE/DELETE 쿼리를 절대 만들지 않는다(헌법1·2).
-- 00001은 수정 금지(append-only DDL).

-- +goose Up

-- 변천사: 추가만 되는 로그(24가 읽고 27이 gist로 append). UPDATE/DELETE 금지(헌법1/2).
CREATE TABLE evolution_history (
    id              TEXT PRIMARY KEY,
    memory_id       TEXT NOT NULL REFERENCES memories(id),
    user_id         TEXT NOT NULL,                 -- 격리
    version         INT  NOT NULL,
    brightness      REAL NOT NULL,                 -- 그 시점 brightness_offset 스냅샷
    hue_shift       REAL NOT NULL,
    form_seed_delta REAL NOT NULL,
    trigger         TEXT NOT NULL,                 -- 'recall' | 'new_neighbor' | 'nightly_gist'
    pe              REAL NOT NULL,
    dir             INT  NOT NULL,                 -- +1 / -1
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose StatementBegin
CREATE INDEX evolution_history_memory_idx ON evolution_history (memory_id, version);
-- +goose StatementEnd

-- 가변 별 레이어에만 재성형 상태(헌법1: 불변 records엔 절대 두지 않음).
ALTER TABLE memories ADD COLUMN brightness_offset REAL NOT NULL DEFAULT 0;
ALTER TABLE memories ADD COLUMN hue_shift         REAL NOT NULL DEFAULT 0;
ALTER TABLE memories ADD COLUMN form_seed_delta   REAL NOT NULL DEFAULT 0;
ALTER TABLE memories ADD COLUMN version           INT  NOT NULL DEFAULT 0;

-- +goose Down

ALTER TABLE memories DROP COLUMN brightness_offset, DROP COLUMN hue_shift,
    DROP COLUMN form_seed_delta, DROP COLUMN version;
DROP TABLE IF EXISTS evolution_history;
