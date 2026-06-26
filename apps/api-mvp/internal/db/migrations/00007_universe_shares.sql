-- 우주 공개(spec 35): 사용자당 1행, overrides-only. 행이 없으면 "공개한 적 없음"(GetShareSettings는
-- enabled=false·slug="" 폴백). slug는 base64url 22자(128bit, crypto/rand) — UNIQUE 제약이 있다(충돌은
-- 128bit 엔트로피상 사실상 불가능 — 발생 시 INSERT가 23505로 실패해 CodeInternal로 표면화된다; 재시도
-- 루프는 두지 않는다). enabled=false면 방문자에게 즉시 NotFound(존재 비노출),
-- 회전(rotate)하면 slug가 교체돼 옛 URL이 즉시 무효가 된다. 원본 일기·조각은 어떤 컬럼으로도
-- 담지 않는다 — 공개되는 건 풍경뿐이다(콘텐츠 제로). 00001은 수정 금지(append-only DDL).

-- +goose Up
CREATE TABLE universe_shares (
    user_id      TEXT PRIMARY KEY,
    slug         TEXT NOT NULL UNIQUE,        -- base64url 22자(128bit)
    enabled      BOOLEAN NOT NULL DEFAULT false,
    display_name TEXT NOT NULL DEFAULT '',    -- '' = 익명("어느 우주")
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    rotated_at   TIMESTAMPTZ
);

-- +goose Down
DROP TABLE universe_shares;
