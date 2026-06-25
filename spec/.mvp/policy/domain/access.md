# 접근·멤버십 (access) 도메인 정책 (policy/domain/access)

> 현재 구현된 **초대 코드 멤버십 게이트**의 사실 정의(spec 41 — `backend/internal/invite`,
> `backend/internal/platform/rpcserver/membership_gate.go`, `frontend/src/app/ui/MembershipGate.tsx`,
> `frontend/src/pages/invite`). 닫힌 베타 동안 "초대 코드를 한 번 redeem해야 우주에 들어온다"는
> 가입 게이트를 실제 인증(spec 01) 위에 **제거 가능한 한 겹**으로 얹는다.

## 인증 vs 멤버십 (두 경계)

- **인증(authentication, spec 01):** Supabase 세션 보유 = 인증됨. `SessionGate`가 미인증을
  `/sign-in`으로 보낸다. 인증은 "누구인가"만 정한다.
- **멤버십(membership, spec 41):** `invite_redemptions`에 사용자 1행이 있으면 멤버다. 멤버십이
  "우주를 쓸 수 있는가"를 정한다. **인증됐지만 비멤버**인 사용자는 `/invite`로 보내져 코드를 redeem
  하기 전까지 코어 우주를 쓸 수 없다(세션은 있어도 "진짜 입장"은 멤버십이 선이다).

## 접근 규칙 (서버 강제 · 인터셉터 체인)

서버가 강제한다(프런트 우회 불가). Connect 핸들러를 노출 수위별 체인으로 마운트한다(`server.go`):

| 체인 | 인터셉터 | service | 멤버십 |
|---|---|---|---|
| 공개(무인증) | Logging | `VisitService`(35) | — |
| auth-only | Logging→Auth | `InviteService` | ✗ |
| auth+membership | Logging→Auth→**Membership** | `MemoryService`·`SettingsService`·`ShareService`·`GiftService` | ✓ |
| auth+admin | Logging→Auth→AdminGate | `AdminService`(34)·`InviteAdminService` | ✗ |

- 코어 우주 RPC는 멤버만 호출 가능 — 비멤버는 `PermissionDenied`(불투명 메시지; DB/인프라 세부는
  서버 로그로만, 클라엔 "internal error"). 미인증은 그 앞 Auth가 `Unauthenticated`로 먼저 끊는다.
- `InviteService`(`GetMembershipStatus`·`ValidateInviteCode`·`RedeemInviteCode`)는 게이트를 통과하는
  유일한 표면이라 **멤버십을 요구하지 않는다**(인증만).
- `InviteAdminService`(발행·목록·취소)·`AdminService`는 `ADMIN_USER_IDS` allowlist 뒤에 있고
  **멤버십과 무관**하다 — 부트스트랩 관리자가 멤버가 되기 전에 첫 코드를 발행해야 하므로.
- **관리자는 멤버 면제:** `ADMIN_USER_IDS`의 사용자는 초대 코드 없이도 코어 우주에 들어간다 —
  멤버십 인터셉터가 admin을 통과시키고 `GetMembershipStatus`도 `is_member=true`를 돌려준다(FE
  게이트가 admin을 `/invite`로 보내지 않는다). 판정은 admin gate와 같은 `IsAllowlistedAdmin`
  (검증된 JWT sub/email · 대소문자 무시)이고, allowlist가 비면 아무도 면제되지 않는다(fail-closed).
- 공유 auth `opts` 슬라이스는 앨리어싱하지 않고 **복제 후 누적**한다(체인이 서로 새지 않게, 34/35 선례).
  `server_test.go`의 `TestMembershipBoundary`가 회귀를 가드한다(비멤버 토큰: 코어 4 `PermissionDenied`,
  InviteService 도달, 미인증은 `Unauthenticated`).

## 초대 코드 규칙 (직교 모델 + 프리셋)

- 코드는 **두 독립 축**으로 저장한다: `max_uses`(NULL=무제한, 1=1회용) × `expires_at`(NULL=만료 없음).
  UI 프리셋 **1회용 / 시간지정 / 무제한**은 이 두 축의 조합일 뿐이다(스키마 변경 없이 "10회+7일" 같은
  조합도 가능 — 확장성). 발행 시 `max_uses`·`ttl_seconds`는 둘 다 양수여야 한다(0/음수 → `InvalidArgument`).
- **유효성 판정(단일 출처 `evaluate`):** 우선순위 revoked > expired > exhausted. revoked(`revoked_at`)
  / expired(`expires_at ≤ now`) / exhausted(`used_count ≥ max_uses`)면 사유와 함께 거부(`InviteReason`
  enum: NOT_FOUND·EXPIRED·EXHAUSTED·REVOKED). 사유는 RPC 에러가 아니라 응답 필드로 인라인 반환한다.
- **redeem은 원자·멱등·경쟁 안전:** 코드 행을 `FOR UPDATE`로 잠그고 판정 후 소비한다. 멤버십 INSERT는
  `ON CONFLICT (user_id) DO NOTHING` + 영향 행 수로, 같은 사용자가 서로 다른 코드를 동시에 redeem해도
  (코드 잠금이 직렬화 못 하는 TOCTOU) PK 위반 대신 멱등 OK가 되고 둘째 코드의 `used_count`는 안 오른다.
  이미 멤버면 무소비 OK. `invite_redemptions.user_id`가 PK라 한 사용자는 한 번만 멤버가 된다.
- 발행인은 `created_by`(현재 관리자 sub)로 남는다. 관리자 목록은 코드·상태(서버 파생 ACTIVE/EXPIRED/
  EXHAUSTED/REVOKED)·`used_count`/`max_uses`·만료·발행인·라벨을 보이고, 취소(`revoked_at`)·복사를 제공한다.

## 발행 권한

- **현재 관리자 전용**(`InviteAdminService`, admin allowlist 뒤). `/admin`의 "초대 코드" 탭에서 발행한다.
- 일반 사용자 발행은 아직 정책이 아니다(비목표) — plan 41이 도메인 `invite.Service`와 발행 표면을
  분리해 둬, 열 때는 `Issue`/내-발행-목록을 `InviteService`(auth)로 옮기고 발행 한도 정책만 얹으면 된다.

## 제거성 (베타 게이트)

- `INVITE_GATE_ENABLED`(env, 기본 true)가 게이트를 켜고 끈다. **false면** 서버가 멤버십 인터셉터를
  체인에 장착하지 않고 `GetMembershipStatus`가 인증 전원에 `is_member=true`를 돌려준다 → 코어 RPC가
  멤버십 없이 통과하고 FE는 `/invite`로 보내지 않는다. 게이트 전체(도메인·proto 2서비스·테이블 2종·
  인터셉터·FE 슬라이스)는 한 덩어리라, 베타 종료 시 플래그를 끄고 이후 통째로 삭제할 수 있다.

## FE 표면

- **최초 로그인(비멤버):** `MembershipGate`(코어 라우트 `/`·`/gift/$token`을 `SessionGate` 안쪽에서 감쌈)가
  `GetMembershipStatus`를 보고 비멤버를 `/invite?redirect=<원래경로>`로 보낸다. redeem 성공 시 멤버십
  쿼리 캐시를 **제거**(invalidate 아님)해 stale `false`가 복귀 직후 다시 게이트를 튕기지 않게 한다.
- **`/invite`:** `MembershipGate` 밖. 라우트는 `app/ui/InviteRoute`가 세션으로 분기한다(`SessionGate` 래퍼 대신 — 미인증도 코드가 있으면 통과해야 하므로). 코드를 redeem하면 우주가 열린다. 계정을 잘못 골랐으면 로그아웃(`supabase.auth.signOut()`)해 다른 계정으로 — 세션 anon → `/sign-in`으로.
- **초대 URL 온보딩(change 05):** `/invite?code=<code>`가 초대장 진입 표면이다.
  - **미인증 + 코드:** 사인인으로 즉시 튕기지 않고 초대장 카피 + `회원가입하기`를 먼저 본다(코드 없는 미인증만 `/sign-in`으로). `회원가입하기`는 `/sign-in?redirect=/invite?code=<code>`로 가며, 코드를 sessionStorage(`cosimosi:invite`)에 stash해 **풀페이지 Google OAuth(→`/` 복귀, `?redirect` 소실)에서도 코드가 보존**된다.
  - **인증 + 비멤버:** 수동 입력 없이 코드(URL 또는 stash)를 **자동 redeem**. 성공 시 멤버십 캐시 제거·환영 연출 후 redirect(없으면 `/`). 실패는 코드 무소비 + 사유별 카피로 수동 입력 폴백. **이미 멤버**면 무소비로 redirect. stash는 소비·실패 시 비운다.
  - redirect는 내부 경로만(`safeRedirect`), `//`·`/\`·게이트/인증 라우트 자기 재귀 거부. 서버 발송(이메일·문자)은 없다 — 관리자가 복사/공유한 URL을 채널에 붙이는 모델.
- **사인인·초대 비주얼:** 랜딩(spec 15)과 같은 우주 백드롭(`shared/ui/CosmosBackdrop`) 위에 우리 3D 별
  로고(`widgets/star3d/BrandMark` — 오브제 형태 + 테마 accent 색)와 입력·버튼이 **카드 없이** 떠 있다.
  `prefers-reduced-motion`이면 글로우 드리프트·트윙클이 멎는다.

## 구현 근거

- plan [41](../../plan/41.invite-membership.md) — 게이트·발행 콘솔·사인인/초대 비주얼.
- BE: `backend/internal/invite/{invite,service,repository_pg,handler}.go`,
  `backend/internal/platform/rpcserver/membership_gate.go`·`server.go`,
  `backend/internal/db/migrations/00009_invite_codes.sql`, `proto/cosimosi/v1/invite.proto`.
- FE: `frontend/src/app/ui/MembershipGate.tsx`, `frontend/src/pages/invite/*`,
  `frontend/src/pages/admin/ui/InviteCodesTab.tsx`, `frontend/src/widgets/star3d/BrandMark.tsx`.
- config: `INVITE_GATE_ENABLED`(env/`config.go`·`docker-compose.yml`), `spec/values.yaml` `invite` 그룹.
