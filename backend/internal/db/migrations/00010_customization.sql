-- 커스터마이즈 소유권·별가루(spec 44). 4축 외형(배경·별·나·시냅스)에 *아이템 소유권 + 지갑*을
-- 얹어 유료화 골격을 세운다. user_wallet은 사용자당 1행 별가루 잔액(시작 100은 시드 시 값 채움 —
-- DB 기본값 아님; 잔액은 구매 차감으로만 줄고 음수 불가, 충전·결제는 비목표). user_owned_items는
-- *유료 소유분만* 1행씩(무료 종은 행 없이 묵시 소유). 선택은 user_settings에 self_object/synapse_style
-- 두 축을 더해 4축 전부 서버화한다(나 축이 기기-로컬→서버 승격). 소유권·잔액·선택=서버 권위, 시각
-- 정의=코드, 가격·무료=values.yaml. 원본 일기/별/좌표와 무관한 독립 테이블이라 헌법1·2·3과 충돌하지
-- 않는다. 00001은 수정 금지(append-only DDL).

-- +goose Up
-- 지갑: 사용자당 1행. stardust는 GetInventory 첫 조회에서 starting_stardust(values)로 멱등 시드된다.
CREATE TABLE user_wallet (
    user_id    TEXT PRIMARY KEY,
    stardust   INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 소유한 유료 아이템(무료 종은 행 없음 — 묵시 소유). item_id = 안정 식별자 "<axis>:<kind>".
CREATE TABLE user_owned_items (
    user_id     TEXT NOT NULL,
    item_id     TEXT NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, item_id)
);

-- 선택 4축화: 나(self)·시냅스(synapse) 두 축을 user_settings에 추가(nullable → NULL=클라 기본).
ALTER TABLE user_settings ADD COLUMN self_object   TEXT;
ALTER TABLE user_settings ADD COLUMN synapse_style TEXT;

-- +goose Down
ALTER TABLE user_settings DROP COLUMN synapse_style;
ALTER TABLE user_settings DROP COLUMN self_object;
DROP TABLE user_owned_items;
DROP TABLE user_wallet;
