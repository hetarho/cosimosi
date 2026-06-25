-- 변천사 요지화 단계 노출(change 32 / job 47). evolution_history.abstraction_stage 신설:
--   야간 요지화(trigger='nightly_gist')가 별의 추상화 단계를 올린 그 시점의 단계 숫자를 변천사 행에 함께
--   싣는다(예: '요지화 · 3단계'). 지금까지 변천사엔 단계가 안 담겨 "몇 단계로 올라갔는지"를 보여줄 수 없었다.
--   시각 reshape/재공고화·ai_rewrite 행은 단계를 안 바꾸므로 기본값 0(미표시). 기존 행(컬럼 추가 전)도 0으로
--   안전 폴백한다 — NOT NULL DEFAULT 0이라 백필 불필요. records 불변(헌법1).
-- 번호: 00015(user_emotion_forms) 다음 → 00016. ⚠️ schema.sql 동기화 필수.

-- +goose Up
ALTER TABLE evolution_history ADD COLUMN abstraction_stage SMALLINT NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE evolution_history DROP COLUMN abstraction_stage;
