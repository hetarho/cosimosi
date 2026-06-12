-- 기억 분할(spec 21): 일기 1편 → N개 조각 별. 조각별 감정은 가변 별(memories)
-- 레이어에 둔다 — 불변 record에 조각 데이터를 두면 헌법1 위반. records.mood/intensity
-- (+ 신규 valence)는 "선택적 전체-일기 사용자 힌트(prior)"로 남는다.
-- 00001은 수정 금지(append-only DDL).

-- +goose Up

ALTER TABLE memories ADD COLUMN mood           TEXT;            -- 조각 감정(AI 감지, nullable)
ALTER TABLE memories ADD COLUMN intensity      REAL;            -- 조각 강도 0~1(nullable)
ALTER TABLE memories ADD COLUMN fragment_index INT NOT NULL DEFAULT 0;  -- 일기 내 조각 순서(0-based)
ALTER TABLE memories ADD COLUMN fragment_text  TEXT;            -- 임베딩용 조각 텍스트(record 본문 편집 아님), NULL이면 r.body fallback
ALTER TABLE memories ADD COLUMN valence        REAL DEFAULT 0;  -- -1..1 부호 정동(26이 λ_eff에 소비)

-- 수동 감정 힌트(valence) — records.mood/intensity와 같은 결의 선택적 prior.
-- 행 불변 원칙(헌법1)은 행 UPDATE/DELETE 금지이지 append-only 컬럼 추가 금지가 아니다.
ALTER TABLE records ADD COLUMN valence REAL;

-- 기존(21 이전) 별 백필: 1 record = 1 memory 시절의 mood/intensity를 records에서
-- 옮겨와 GetUniverse가 m.mood/m.intensity만 읽어도 색이 비지 않게 한다.
-- (memories는 가변 레이어 — 헌법1 위반 아님. records는 건드리지 않는다.)
-- +goose StatementBegin
UPDATE memories m
SET mood = r.mood, intensity = r.intensity
FROM records r
WHERE r.id = m.record_id AND m.mood IS NULL;
-- +goose StatementEnd

-- job 키잉(00.overview 공유 설계 결정): jobs.memory_id는 embed 전용이 되고,
-- extract job은 record를(consolidate job(27)은 user를) 참조한다.
ALTER TABLE jobs ALTER COLUMN memory_id DROP NOT NULL;
ALTER TABLE jobs ADD COLUMN record_id TEXT REFERENCES records(id);  -- extract job 키
ALTER TABLE jobs ADD COLUMN user_id   TEXT;                         -- consolidate job 키(27)

-- 조각 fan-out·extract 멱등 체크용(record_id로 조각 조회). UNIQUE (record_id,
-- fragment_index)라 lease 만료로 같은 extract job이 이중 실행돼도 두 번째
-- fan-out 트랜잭션은 충돌·롤백된다(기존 1:1 행은 전부 fragment_index=0 — 위반 없음).
-- +goose StatementBegin
CREATE UNIQUE INDEX memories_record_fragment_idx ON memories (record_id, fragment_index);
-- +goose StatementEnd

-- +goose Down

DROP INDEX IF EXISTS memories_record_fragment_idx;

-- ⚠️ dev 전용 롤백(00002·00003의 DROP TABLE과 같은 결): NOT NULL 복원을 위해
-- memory_id 없는 행(extract/consolidate job — 완료 이력 포함)을 지운다.
-- 프로덕션에서는 goose down을 실행하지 않는 것이 전제다.
DELETE FROM jobs WHERE memory_id IS NULL;
ALTER TABLE jobs DROP COLUMN user_id;
ALTER TABLE jobs DROP COLUMN record_id;
ALTER TABLE jobs ALTER COLUMN memory_id SET NOT NULL;

ALTER TABLE records DROP COLUMN valence;

ALTER TABLE memories DROP COLUMN valence;
ALTER TABLE memories DROP COLUMN fragment_text;
ALTER TABLE memories DROP COLUMN fragment_index;
ALTER TABLE memories DROP COLUMN intensity;
ALTER TABLE memories DROP COLUMN mood;
