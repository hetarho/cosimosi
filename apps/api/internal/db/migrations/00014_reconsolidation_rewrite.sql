-- 재공고화 AI 내용 변형(spec 54). evolution_history.content 신설:
--   추상화 단계 ≥2 별을 다시 열람하면 AI가 표시 내용을 단계만큼 흐리게 다시 쓰고, 그 텍스트를 변천사 행에
--   함께 싣는다(trigger='ai_rewrite'). 시각 reshape/gist 행은 content NULL(내용 변형 아님). 원본 record는
--   불변(헌법1) — 변형 텍스트는 별 파생 레이어인 변천사에만 산다. 별의 '현재 표시 내용'은 최신 content 행이고,
--   재변형 디바운스(A6)는 별도 컬럼 없이 이 trigger 행의 created_at으로 판정한다.
-- jobs_one_active_rewrite_idx: 별당 활성(대기/실행) rewrite 잡 최대 1개 — 동시 회상이 게이트의 NOT EXISTS를
--   둘 다 통과해 잡을 두 번 적재(→ 한 별이 두 번 변형)하는 레이스의 DB 백스톱. consolidate의 동형 인덱스와 같은 패턴.
-- 번호: 00013(야간 재작성) 다음 → 00014. ⚠️ schema.sql 동기화 필수.

-- +goose Up
ALTER TABLE evolution_history ADD COLUMN content TEXT;
CREATE UNIQUE INDEX jobs_one_active_rewrite_idx ON jobs (memory_id)
    WHERE kind = 'rewrite' AND status IN ('pending', 'running');

-- +goose Down
DROP INDEX IF EXISTS jobs_one_active_rewrite_idx;
ALTER TABLE evolution_history DROP COLUMN content;
