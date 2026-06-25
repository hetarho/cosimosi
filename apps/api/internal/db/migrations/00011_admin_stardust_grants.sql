-- 관리자 별가루 보정 지급 감사(spec 46). 운영자가 사용자 지갑에 별가루를 보정 지급할 때마다 1행 append —
-- 사용자 직접 충전·결제는 비목표이고, 별가루 증가 경로는 시작 잔액 시드 + 이 관리자 지급뿐(A11). 잔액 컬럼은
-- user_wallet.stardust와 같은 INTEGER 범위를 전제한다. UI는 이력을 노출하지 않지만(비목표) 사고 복구·운영 추적용
-- 으로 DB에는 남긴다. 원본 일기/별/좌표와 무관한 독립 테이블이라 헌법1·2·3과 충돌하지 않는다.
-- 번호: 00010(44)이 점유 → 이 작업은 00011. ⚠️ schema.sql 동기화 필수.

-- +goose Up
CREATE TABLE admin_stardust_grants (
    id             TEXT PRIMARY KEY,
    admin_user_id  TEXT NOT NULL,    -- 지급한 관리자(auth context의 JWT sub)
    target_user_id TEXT NOT NULL,    -- 지급 대상 사용자
    amount         INTEGER NOT NULL, -- 지급액(양의 정수)
    balance_before INTEGER NOT NULL, -- 지급 직전 유효 잔액
    balance_after  INTEGER NOT NULL, -- 지급 직후 잔액(= before + amount)
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 조회용 인덱스는 대상/관리자별 최신순까지만(이력 화면은 비목표라 그 이상 안 둔다).
CREATE INDEX admin_stardust_grants_target_idx ON admin_stardust_grants (target_user_id, created_at DESC);
CREATE INDEX admin_stardust_grants_admin_idx ON admin_stardust_grants (admin_user_id, created_at DESC);

-- +goose Down
DROP TABLE admin_stardust_grants;
