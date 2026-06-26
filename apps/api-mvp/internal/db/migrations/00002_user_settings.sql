-- +goose Up
-- 시각 개인 설정(spec 30). 사용자 행은 사용자가 설정을 바꿀 때만 생성된다(온보딩/세팅) —
-- 기본 팔레트·테마·오브젝트는 클라가 소유하므로(미인증·오프라인 경로에서도 필요) 서버는
-- 사용자가 바꾼 오버라이드만 저장한다. user_emotion_colors는 정규화 행이라 미래
-- "xx%가 골랐어요"를 GROUP BY (mood, color)로 집계할 수 있다(00001은 수정 금지 — append-only).
CREATE TABLE user_settings (
    user_id     TEXT PRIMARY KEY,
    theme       TEXT,
    star_object TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_emotion_colors (
    user_id TEXT NOT NULL,
    mood    TEXT NOT NULL,
    color   TEXT NOT NULL,
    PRIMARY KEY (user_id, mood)
);

-- +goose Down
DROP TABLE user_emotion_colors;
DROP TABLE user_settings;
