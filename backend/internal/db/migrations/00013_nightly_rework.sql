-- 야간 배치 재작성(spec 27 change 20). 두 컬럼 신설:
--   memories.abstraction_stage — 요지화 이산 단계 0~4(반지름 임계를 넘을 때마다 +1, 단조). 별 형태(plan 53)·
--     재공고화 AI 변형(plan 54)의 입력. 연속 form_seed_delta를 대체하는 새 요지 신호(form_seed_delta는 23 소유로 보존).
--   memory_links.severed — 가지치기가 끊은 듯 처리한 선(밝기 바닥 + 끊김 플래그). 행은 보존(헌법2 — DELETE 없음),
--     재-KNN 패스가 닮은 기억을 다시 찾으면 severed=false로 되살린다.
-- 번호: 00012(spec 07 recall_count)가 선점 → 이 작업은 00013. ⚠️ schema.sql 동기화 필수.

-- +goose Up
ALTER TABLE memories ADD COLUMN abstraction_stage SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE memory_links ADD COLUMN severed BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE memory_links DROP COLUMN severed;
ALTER TABLE memories DROP COLUMN abstraction_stage;
