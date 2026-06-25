-- 우주 공개(spec 35). universe_shares는 사용자당 1행 overrides-only. 슬러그 생성(crypto/rand)은
-- 서비스가 하고, 여기엔 upsert/회전/조회만 둔다. 공개 스냅샷은 memories/memory_links의 *풍경 컬럼만*
-- SELECT한다 — 원본/조각 텍스트·record_id·정확 시각은 쿼리에 등장하지 않는다(콘텐츠 제로, 헌법1).

-- name: GetShareByUser :one
-- 소유자 공유 설정 조회(ShareService.GetShareSettings). 행이 없으면 pgx.ErrNoRows → 서비스가
-- enabled=false·slug="" 폴백으로 변환("공개한 적 없음").
SELECT slug, enabled, display_name FROM universe_shares WHERE user_id = $1;

-- name: UpsertShareSettings :one
-- 공유 설정 upsert. 최초엔 서비스가 생성한 slug로 INSERT, 이미 있으면 enabled/display_name만 갱신
-- (slug 보존 — 회전은 RotateShareSlug 전용). 끄고 다시 켜면 같은 slug를 재사용한다(회전이 아닌 한).
INSERT INTO universe_shares (user_id, slug, enabled, display_name)
VALUES (@user_id, @slug, @enabled, @display_name)
ON CONFLICT (user_id) DO UPDATE SET
    enabled      = EXCLUDED.enabled,
    display_name = EXCLUDED.display_name
RETURNING slug, enabled, display_name;

-- name: RotateShareSlug :one
-- 슬러그 회전: 새 slug로 교체 + rotated_at 갱신. 옛 slug는 즉시 무효(acceptance 1.3). 행이 없으면
-- 0행(pgx.ErrNoRows) → 서비스가 "공개한 적 없음"으로 처리(회전할 게 없음).
UPDATE universe_shares SET slug = @slug, rotated_at = now()
WHERE user_id = @user_id
RETURNING slug, enabled, display_name;

-- name: GetShareUserBySlug :one
-- 무인증 방문(VisitService): slug → user_id + display_name, 단 enabled=true일 때만. 꺼졌거나
-- (enabled=false) slug가 없으면 pgx.ErrNoRows → 서비스가 *균일* NotFound로 변환한다(존재/꺼짐/빈
-- 우주 구분 비노출, acceptance 1.2). display_name도 함께 돌려 공개 스냅샷 헤더를 한 번에 채운다.
SELECT user_id, display_name FROM universe_shares WHERE slug = $1 AND enabled = true;

-- name: ListSharedStars :many
-- 공개 스냅샷 풍경(별): 색(mood)·강도(intensity)·날짜만. id는 시냅스 인덱스 매핑에만 쓰고 DTO엔
-- 안 나간다. 타임스탬프는 서비스가 *일 단위 양자화*한다(행동 핑거프린팅 방지). ⚠️ 정렬은 created_at이
-- 아니라 **m.id**로 한다 — 시각 필드를 일 단위로 양자화해 놓고 응답 배열 *순서*가 생성 시각 순이면
-- 일내 시간순·조각 묶임이 2차 채널로 새기 때문(codex 지적). m.id는 crypto/rand base64url이라
-- 비시간성·결정적 — 순서는 호출마다 안정적이지만 어떤 연대기도 드러내지 않는다.
SELECT m.id AS memory_id, m.mood, m.intensity, m.last_recalled_at, m.created_at
FROM memories m
WHERE m.user_id = $1
ORDER BY m.id;

-- name: ListSharedStarIDs :many
-- 겹쳐보기(spec 37) 공명 다리 인덱스 매핑 전용: id만 읽는다(풍경 컬럼 불필요). ⚠️ WHERE·ORDER BY는
-- ListSharedStars와 **반드시 동일**해야 한다 — 공개 스냅샷이 ListSharedStars로 만든 배열 순서와 같은
-- 인덱스를 줘야 클라가 그 배열에 다리 끝점을 정확히 얹는다(순서가 갈리면 엉뚱한 별을 가리킨다).
SELECT m.id
FROM memories m
WHERE m.user_id = $1
ORDER BY m.id;

-- name: ListSharedSynapses :many
-- 공개 스냅샷 풍경(시냅스): 끝점 id + weight만. 활성 시각·co_activation 등 행동 신호는 보내지 않는다.
-- 서비스가 a_id/b_id를 별 인덱스로 환원한다(SharedSynapse.a/b).
SELECT ml.a_id, ml.b_id, ml.weight
FROM memory_links ml
WHERE ml.user_id = $1;
