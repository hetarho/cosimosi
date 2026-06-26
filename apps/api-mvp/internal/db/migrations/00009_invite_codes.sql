-- 초대 코드 멤버십 게이트(spec 41). 닫힌 베타 동안 "코드를 한 번 redeem해야 멤버"가 되는 가입 게이트를
-- 실제 인증(01) 위에 제거 가능한 한 겹으로 얹는다. 코드는 직교 모델: max_uses(NULL=무제한) × expires_at
-- (NULL=만료 없음) 두 축 — UI의 1회용/시간지정/무제한은 그 프리셋이다. invite_redemptions는 사용자당
-- 1행으로 멤버십 마커이자 사용 내역을 겸한다(used_count는 invite_codes에 비정규화 — 캡 판정·표시용).
-- 원본 일기/별/좌표와 무관한 독립 테이블이라 헌법1·2·3과 충돌하지 않는다. 게이트 제거 시 통째로 DROP.
-- 00001은 수정 금지(append-only DDL).

-- +goose Up
CREATE TABLE invite_codes (
    id          TEXT PRIMARY KEY,                 -- crypto/rand base64url 22자(내부 id, 35 슬러그 규약)
    code        TEXT NOT NULL UNIQUE,             -- 사람이 입력하는 코드(모호문자 제외 대문자 영숫자)
    label       TEXT NOT NULL DEFAULT '',         -- 발행 메모('' = 없음)
    created_by  TEXT NOT NULL,                    -- 발행인 user_id(현재 관리자 sub; 후속 일반 사용자)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ,                      -- NULL = 만료 없음(시간지정 프리셋만 설정)
    max_uses    INTEGER,                          -- NULL = 무제한; 1 = 1회용
    used_count  INTEGER NOT NULL DEFAULT 0,
    revoked_at  TIMESTAMPTZ,                      -- NULL = 활성
    CONSTRAINT invite_codes_max_uses_pos CHECK (max_uses IS NULL OR max_uses > 0)
);
CREATE INDEX invite_codes_created_by_idx ON invite_codes (created_by);

-- 사용자당 1행 = 멤버십. redeem 시 INSERT(코어 RPC 게이트가 EXISTS로 본다). 코드별 사용 내역도 겸한다.
CREATE TABLE invite_redemptions (
    user_id        TEXT PRIMARY KEY,
    invite_code_id TEXT NOT NULL REFERENCES invite_codes(id),
    redeemed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX invite_redemptions_code_idx ON invite_redemptions (invite_code_id);

-- +goose Down
DROP TABLE invite_redemptions;
DROP TABLE invite_codes;
