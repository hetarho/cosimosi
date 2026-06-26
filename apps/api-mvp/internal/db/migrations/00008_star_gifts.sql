-- 함께한 기억 — 공명(spec 36). 별 하나를 친구에게 토큰 링크로 보내고(star_gifts), 친구가
-- 수락하며 자기 관점으로 재작성하면 친구 우주에 새 별이 태어나 두 별이 공명으로 이어진다
-- (resonances: memory↔memory 쌍). 토큰은 base64url 22자(128bit, crypto/rand) — 35 슬러그와
-- 같은 엔트로피·UNIQUE. 미수락 링크가 영원히 떠돌지 않게 생성 +30일 만료(expires_at). 공명은
-- 삭제하지 않는다(헌법2의 정신 — 별이 잠들어도 공명은 남는다). 00001은 수정 금지(append-only DDL).

-- +goose Up
CREATE TABLE star_gifts (
    id                TEXT PRIMARY KEY,
    token             TEXT NOT NULL UNIQUE,             -- base64url 22자(128bit)
    sender_user_id    TEXT NOT NULL,
    sender_memory_id  TEXT NOT NULL REFERENCES memories(id),
    message           TEXT NOT NULL DEFAULT '',
    status            TEXT NOT NULL DEFAULT 'pending',   -- pending|accepted|declined|canceled (expired는 만료시각으로 지연 판정)
    recipient_user_id TEXT,                              -- 수락/거절 시 기록(pending이면 NULL)
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at        TIMESTAMPTZ NOT NULL,              -- 생성 +30일
    responded_at      TIMESTAMPTZ
);
-- 보낸/받은 목록(ListStarGifts) 조회용 인덱스.
CREATE INDEX star_gifts_sender_idx ON star_gifts (sender_user_id);
CREATE INDEX star_gifts_recipient_idx ON star_gifts (recipient_user_id);

CREATE TABLE resonances (
    id                  TEXT PRIMARY KEY,
    gift_id             TEXT NOT NULL UNIQUE REFERENCES star_gifts(id),
    sender_memory_id    TEXT NOT NULL REFERENCES memories(id),
    recipient_memory_id TEXT NOT NULL REFERENCES memories(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- GetUniverse의 resonant 플래그 조인 + GetResonanceInfo의 상대 별 조회용(양 끝점 모두).
CREATE INDEX resonances_sender_memory_idx ON resonances (sender_memory_id);
CREATE INDEX resonances_recipient_memory_idx ON resonances (recipient_memory_id);

-- +goose Down
DROP TABLE resonances;
DROP TABLE star_gifts;
