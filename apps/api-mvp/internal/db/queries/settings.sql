-- 시각 개인 설정(spec 30) + 커스터마이즈 소유권·지갑(spec 44). 서버는 사용자 오버라이드만 저장한다 —
-- 행/엔트리가 없으면 GetUserSettings는 pgx.ErrNoRows, ListUserEmotionColors는 빈 슬라이스이고, 클라가
-- 기본값(테마/오브젝트/MOOD_PALETTE) 위에 머지한다. 사용자 행을 미리 시드하지 않는다. 지갑은 인벤토리
-- 첫 조회에서만 시드(SeedWallet, 멱등). 잔액은 구매 차감(DebitWallet)으로만 줄고 음수 불가(가드 WHERE).

-- name: GetUserSettings :one
-- 단일값 오버라이드(4축 선택). 전부 nullable — NULL이면 클라 기본값(축별 무료 종).
SELECT theme, star_object, self_object, synapse_style FROM user_settings WHERE user_id = $1;

-- name: ListUserEmotionColors :many
-- 감정색 오버라이드(0~13행). 없는 mood는 클라가 MOOD_PALETTE로 채운다.
SELECT mood, color FROM user_emotion_colors WHERE user_id = $1 ORDER BY mood;

-- name: ListUserEmotionForms :many
-- 감정별 형태 오버라이드(0~13행, change 30). 없는 mood는 클라가 전역 기본 룩(star_object)으로 그린다.
SELECT mood, look FROM user_emotion_forms WHERE user_id = $1 ORDER BY mood;

-- name: UpsertUserSettings :exec
-- 부분 갱신: NULL로 들어온 필드는 기존 값을 보존(COALESCE)해 "보낸 필드만 덮어쓰기"(4축 전부).
INSERT INTO user_settings (user_id, theme, star_object, self_object, synapse_style, updated_at)
VALUES (@user_id, @theme, @star_object, @self_object, @synapse_style, now())
ON CONFLICT (user_id) DO UPDATE SET
    theme         = COALESCE(EXCLUDED.theme, user_settings.theme),
    star_object   = COALESCE(EXCLUDED.star_object, user_settings.star_object),
    self_object   = COALESCE(EXCLUDED.self_object, user_settings.self_object),
    synapse_style = COALESCE(EXCLUDED.synapse_style, user_settings.synapse_style),
    updated_at    = now();

-- name: UpsertUserEmotionColor :exec
-- 감정색 1건 upsert. (user_id, mood) 유일 — 한 mood당 한 색.
INSERT INTO user_emotion_colors (user_id, mood, color)
VALUES (@user_id, @mood, @color)
ON CONFLICT (user_id, mood) DO UPDATE SET color = EXCLUDED.color;

-- name: UpsertUserEmotionForm :exec
-- 감정별 형태 1건 upsert(change 30). (user_id, mood) 유일 — 한 mood당 한 룩. 보낸 mood만 갱신(부분 패치).
INSERT INTO user_emotion_forms (user_id, mood, look)
VALUES (@user_id, @mood, @look)
ON CONFLICT (user_id, mood) DO UPDATE SET look = EXCLUDED.look;

-- name: GetWallet :one
-- 잔액 조회(시드하지 않음). 행이 없으면 pgx.ErrNoRows → 서비스가 SeedWallet으로 시드한다.
SELECT stardust FROM user_wallet WHERE user_id = $1;

-- name: SeedWallet :one
-- 인벤토리 첫 조회 시 멱등 시드(spec 44, A1): 행이 없으면 starting_stardust(@stardust, values)로 INSERT,
-- 이미 있으면 잔액을 *건드리지 않고*(DO UPDATE SET user_id=자기자신 — no-op) 현재 잔액을 RETURNING.
-- DO NOTHING은 충돌 시 RETURNING이 0행이라 못 쓴다 — no-op UPDATE라야 항상 현재 잔액 1행을 돌려준다.
INSERT INTO user_wallet (user_id, stardust)
VALUES (@user_id, @stardust)
ON CONFLICT (user_id) DO UPDATE SET user_id = user_wallet.user_id
RETURNING stardust;

-- name: DebitWallet :execrows
-- 구매 차감(spec 44, A2c/A3): 잔액 ≥ 가격일 때만 차감 — affected=0이면 잔액 부족(음수 방지 가드).
-- 트랜잭션 안에서 호출, affected 행 수로 잔액 부족을 원자 판정한다.
UPDATE user_wallet SET stardust = stardust - @amount, updated_at = now()
WHERE user_id = @user_id AND stardust >= @amount;

-- name: ListOwnedItems :many
-- 소유한 유료 아이템 id(무료 종은 행 없음 — 묵시 소유). 인벤토리·구매 응답에 실린다.
SELECT item_id FROM user_owned_items WHERE user_id = $1 ORDER BY item_id;

-- name: GrantItem :execrows
-- 소유 부여(spec 44, A2b): 멱등 — 이미 소유면 ON CONFLICT DO NOTHING으로 affected=0이라
-- 서비스가 "이미 소유"로 판정(이중 차감 방지, 트랜잭션 안에서 차감 직후 호출).
INSERT INTO user_owned_items (user_id, item_id) VALUES (@user_id, @item_id)
ON CONFLICT (user_id, item_id) DO NOTHING;
