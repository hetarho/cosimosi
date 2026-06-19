-- 회상 빈도 영속(spec 07): Bjork 저장강도 S의 누적 신호. 회상(RecallMemoryTouch)마다 +1 되고
-- Star payload로 클라에 전달돼 클라가 S=(storage_base+recall_count)·(1+emo·intensity), R=exp(-Δt/τ(S))를
-- 파생한다(자기근접 반지름 38 + 배경 감정 순위를 함께 구동). 기존 별은 1로 백필(합리적 기본값 — A1).
-- 번호: 00010(44)·00011(46 admin_stardust_grants)이 선점 → 이 작업은 00012. ⚠️ schema.sql 동기화 필수.

-- +goose Up
ALTER TABLE memories ADD COLUMN recall_count INT NOT NULL DEFAULT 1;

-- +goose Down
ALTER TABLE memories DROP COLUMN recall_count;
