-- 초대 코드 멤버십 게이트(spec 41). 코드는 직교 모델(max_uses × expires_at) — NULL=무제한/만료없음.
-- invite_redemptions는 사용자당 1행 = 멤버십 마커이자 사용 내역. 코드 생성(crypto/rand)·만료/소진 판정은
-- 서비스/도메인이 하고, 여기엔 영속만 둔다. redeem 원자성은 GetInviteCodeByCodeForUpdate(FOR UPDATE)를
-- 트랜잭션에서 잠그고 used_count를 올리는 것으로 보장한다. 게이트 제거 시 이 파일과 두 테이블을 통째로 지운다.

-- name: CreateInviteCode :one
-- 관리자 발행(InviteAdminService.IssueInviteCode). id/code(crypto/rand)·expires_at·max_uses는 서비스가 채운다.
INSERT INTO invite_codes (id, code, label, created_by, expires_at, max_uses)
VALUES (@id, @code, @label, @created_by, @expires_at, @max_uses)
RETURNING id, code, label, created_by, created_at, expires_at, max_uses, used_count, revoked_at;

-- name: GetInviteCodeByCode :one
-- 비소비 검증(ValidateInviteCode)용. 만료/소진/취소 판정은 도메인 evaluate가 한다.
SELECT id, code, label, created_by, created_at, expires_at, max_uses, used_count, revoked_at
FROM invite_codes WHERE code = $1;

-- name: GetInviteCodeByCodeForUpdate :one
-- 원자 redeem용: 행을 잠가(FOR UPDATE) 동시 redeem을 직렬화한다(1회용 중복 소비 방지, acceptance A5).
SELECT id, code, label, created_by, created_at, expires_at, max_uses, used_count, revoked_at
FROM invite_codes WHERE code = $1 FOR UPDATE;

-- name: IncrementInviteCodeUse :exec
-- redeem 성공 시 사용 횟수 +1(잠근 트랜잭션 안에서만 호출).
UPDATE invite_codes SET used_count = used_count + 1 WHERE id = $1;

-- name: RevokeInviteCode :one
-- 관리자 취소(RevokeInviteCode): 즉시 무효(revoked_at). 행이 없으면 0행 → 서비스가 NotFound로 변환.
UPDATE invite_codes SET revoked_at = now() WHERE id = $1
RETURNING id, code, label, created_by, created_at, expires_at, max_uses, used_count, revoked_at;

-- name: ListInviteCodes :many
-- 관리자 발행 목록(ListInviteCodes): 최신 발행이 위로. 상태(active/expired/exhausted/revoked)는 서비스가 파생.
SELECT id, code, label, created_by, created_at, expires_at, max_uses, used_count, revoked_at
FROM invite_codes ORDER BY created_at DESC, id;

-- name: InsertRedemption :execrows
-- redeem 성공 시 멤버십 1행(잠근 트랜잭션 안에서만 호출). user_id PK라 한 사용자는 한 번만 멤버가 된다.
-- ON CONFLICT DO NOTHING + 영향 행 수로 멱등·경쟁 안전: 같은 사용자가 서로 다른 코드를 동시에 redeem해도
-- (코드 행 잠금이 서로 다른 행이라 직렬화 안 됨) 둘째 INSERT는 0행을 돌려주고, 서비스가 그걸 "이미 멤버"로
-- 처리해 PK 위반(CodeInternal) 대신 멱등 OK가 된다(used_count도 안 올린다).
INSERT INTO invite_redemptions (user_id, invite_code_id) VALUES (@user_id, @invite_code_id)
ON CONFLICT (user_id) DO NOTHING;

-- name: UserIsMember :one
-- 멤버십 게이트 인터셉터 + GetMembershipStatus가 본다. EXISTS라 인덱스 한 번.
SELECT EXISTS(SELECT 1 FROM invite_redemptions WHERE user_id = $1);
