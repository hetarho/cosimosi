-- 시각 개인 설정(spec 30). 서버는 사용자 오버라이드만 저장한다 — 행/엔트리가 없으면
-- GetUserSettings는 pgx.ErrNoRows, ListUserEmotionColors는 빈 슬라이스이고, 클라가
-- 기본값(테마/오브젝트/MOOD_PALETTE) 위에 머지한다. 사용자 행을 미리 시드하지 않는다.

-- name: GetUserSettings :one
-- 단일값 오버라이드(테마·오브젝트). 둘 다 nullable — NULL이면 클라 기본값.
SELECT theme, star_object FROM user_settings WHERE user_id = $1;

-- name: ListUserEmotionColors :many
-- 감정색 오버라이드(0~13행). 없는 mood는 클라가 MOOD_PALETTE로 채운다.
SELECT mood, color FROM user_emotion_colors WHERE user_id = $1 ORDER BY mood;

-- name: UpsertUserSettings :exec
-- 부분 갱신: NULL로 들어온 필드는 기존 값을 보존(COALESCE)해 "보낸 필드만 덮어쓰기".
INSERT INTO user_settings (user_id, theme, star_object, updated_at)
VALUES (@user_id, @theme, @star_object, now())
ON CONFLICT (user_id) DO UPDATE SET
    theme       = COALESCE(EXCLUDED.theme, user_settings.theme),
    star_object = COALESCE(EXCLUDED.star_object, user_settings.star_object),
    updated_at  = now();

-- name: UpsertUserEmotionColor :exec
-- 감정색 1건 upsert. (user_id, mood) 유일 — 한 mood당 한 색.
INSERT INTO user_emotion_colors (user_id, mood, color)
VALUES (@user_id, @mood, @color)
ON CONFLICT (user_id, mood) DO UPDATE SET color = EXCLUDED.color;
