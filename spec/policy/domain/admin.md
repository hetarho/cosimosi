# 관리자 콘솔 (admin) 도메인 정책 (policy/domain/admin)

> 현재 구현된 관리자 전용 표면(`/admin` + `AdminService`)의 접근·LLM 키 보안·런타임 LLM
> 설정·사용량 계측 규칙의 사실 정의. (spec 34 — `backend/internal/admin`,
> `backend/internal/llm/resolver.go`, `backend/internal/platform/rpcserver/admin_gate.go`,
> `frontend/src/pages/admin`)

## 접근 규칙 (allowlist · fail-closed)

- `AdminService`의 모든 RPC는 `ADMIN_USER_IDS` allowlist 게이트(`NewAdminGateInterceptor`)
  뒤에 있다. 항목은 쉼표 구분 **Supabase user UUID 또는 계정 이메일** — 서명 검증된 JWT의
  `sub`/`email` 클레임과 대소문자 무시로 대조한다. 이메일 매칭은 **`user_metadata.
  email_verified=true`인 토큰만** 신뢰한다(미검증 가입으로 allowlist 이메일을 선점하는
  우회 차단 — 플래그 없는 토큰은 UUID 항목으로만 통과 가능).
- **빈 allowlist = 전원 거부(fail-closed).** 환경별로 명시적으로 켜야만 admin 표면이 존재한다.
- 거부는 항상 `PermissionDenied` + 불투명 메시지("permission denied") 한 종류 — 미인증은
  기존대로 auth 인터셉터의 `Unauthenticated`가 먼저 끊는다.
- **비노출 원칙:** 비관리자가 `/admin`에 진입하면 FE는 PermissionDenied를 받아
  **NotFound 화면을 렌더**한다(콘솔 무에러). admin 표면의 존재를 광고하지 않는다.

## LLM 키 보안 (봉투 암호화 · write-only)

- 저장 키는 DB에 **AES-256-GCM 암호문만** 둔다: `0x01(버전)‖nonce(12B)‖ciphertext+tag`,
  **AAD = provider명**(다른 행으로 복사한 암호문은 복호화 실패 — 행 간 스왑 방지).
- 마스터키 `LLM_KEY_ENCRYPTION_KEY`(base64 32B, `openssl rand -base64 32`)는 **서버 env에만**
  존재한다 — DB 덤프·백업 유출 단독으로는 평문 복원 불가.
- **평문 키는 write-only:** 요청(`SetProviderKey`/`TestProviderKey`) → 메모리에서 암호화/1회
  핑 → 끝. 어떤 RPC 응답·로그·Sentry에도 평문이 나가지 않는다(응답은 `key_set`+`key_last4`+
  `updated_at`만). `TestProviderKey` 실패 메시지에서도 키 원문은 스크럽된다.
- 마스터키 미설정 시: 읽기는 정상(`encryption_ready=false`로 FE 배너), 키 저장은
  `FailedPrecondition`(env 이름 명시)으로 거부. 마스터키가 **잘못된 형식**이면 부팅 실패
  (오타가 조용히 암호화를 끄는 것보다 낫다).
- 키는 **최소 8자**(`ErrKeyTooShort` → InvalidArgument) — last4 표시가 키 전체와 같아질 수
  있는 초단키를 차단한다. `llm_provider_configs.updated_at`은 **키 변경 시각**의 의미로만
  쓴다(모델 리스트 편집은 건드리지 않음 — 로테이션 감사 보존).
- 키 삭제는 `api_key_enc`/`api_key_last4`를 NULL로 비운다(행의 모델 리스트는 보존).

## 런타임 LLM 설정 (DB > env · overrides-only)

- 공급자 5종(openai·gemini·claude·deepseek·grok)의 목록·기본 모델·엔드포인트 SSOT는
  **코드 매트릭스**(`llm/providers.go`)다. DB(`llm_provider_configs`)는 관리자가 바꾼 것
  (추가 모델·암호화 키)만 담는다 — 시드 행 없음, `GetLLMConfig`가 매트릭스 위에 병합해
  항상 전 공급자 카드를 채운다(30 personalization의 overrides-only 철학).
- 활성 추출 LLM은 `llm_selection` 단일행(id=1 CHECK). `model=''`은 공급자 기본 모델.
  `SetActiveLLM`은 `model ∈ models ∪ {default_model, ''}` 밖이면 `InvalidArgument`.
- **우선순위 DB(콘솔) > env:** `llm.NewResolver`가 selection을 **TTL 30s 캐시**로 읽어
  어댑터에 위임한다 — 공급자/모델/키 교체는 **재시작 없이 ≤30s 내** 다음 `Complete`부터
  반영. selection이 비어 있으면 `SwitchingExtractor`가 resolver 호출 전에 키리스 mock으로
  라우팅한다 — 추출 on/off는 콘솔 액션이고 env 노브는 없다(resolver 자체의 env
  `factory.New` 폴백은 TTL 어긋남 창에서만 닿는 엣지 경로). 소스 에러(DB 다운·복호화
  실패)는 로그 후 마지막 라우트 유지 — 추출을 실패시키지 않는다.
- 의존 방향: `llm`은 DB·admin을 모른다 — admin이 `llm.ConfigSource`(selection+복호화)와
  `llm.UsageSink`(계측)를 구현해 주입한다(헌법7 유지).

## 사용량 계측 (usage)

- Resolver 경유 `Complete` 성공 1회 = `llm_usage_daily`(**UTC day** × provider × model ×
  kind) 행에 calls/input_tokens/output_tokens **upsert 누적**. kind는 현재 `'extract'`만
  (임베딩 계측은 비목표 — kind 컬럼만 확장 대비).
- 계측은 **베스트에포트**: 싱크 실패는 로그만 남기고 호출을 실패시키지 않는다. 토큰 수는
  공급자 응답의 usage 필드 매핑(부재 시 0).
- **비용 환산은 FE**(`pages/admin/lib/pricing.ts`)의 정적 단가표 × 토큰 — 단가는 자주
  바뀌므로 서버·DB에 두지 않고 "추정" 라벨을 단다. 단가표에 없는 모델은 비용을 표시하지
  않는다(모르는 단가로 추정하지 않음).

## 대시보드 범위 (비중복 원칙)

- 담는 것: 서비스 합계(users·records·memories·synapses) · 잡 큐(pending/processing/failed/
  done_24h) · 최근 30일 일기 시리즈 · LLM 토큰 사용량. 전부 관리자 클릭 시 1회 on-demand
  집계(폴링 없음).
- 안 담는 것: 에러율(Sentry) · 사용자 행동/퍼널(PostHog) · CPU/메모리(호스팅 콘솔) —
  이미 담당자가 있는 지표는 복제하지 않는다.
- 가입자 수 기본값은 `COUNT(DISTINCT user_id) FROM records`(우리 스키마엔 사용자 테이블이
  없다). `to_regclass('auth.users')` 존재 시에만 `auth.users` 카운트로 대체 — auth 스키마가
  없는 로컬 도커 pg에서도 무에러.

## 콘솔 탭 구성 (LLM 관리 + 초대 코드)

- `/admin`은 두 탭으로 나뉜다(`?tab=llm|invite`, 기본 llm): **LLM 관리**(이 문서 — 키·모델·활성
  선택·운영 대시보드)와 **초대 코드**(발행·목록·취소). 두 탭의 권한 게이트는 동일한 admin
  allowlist다 — 셸이 `GetLLMConfig` PermissionDenied로 비관리자를 NotFound로 가른다.
- 초대 코드 발행·목록·취소는 `InviteAdminService`(spec 41)가 담당하며 admin allowlist 뒤에 있다
  (멤버십과 무관 — 부트스트랩 관리자가 멤버 되기 전 첫 코드를 발행해야 하므로). 규칙·발행 모델·
  제거성은 [policy/domain/access.md](access.md)가 단일 출처다(이 문서는 LLM 운영만 소유).
- 초대 코드 행은 **코드 문자열 복사 + 초대 URL(`${origin}/invite?code=<code>`) 복사 + 공유**(Web Share API 지원 시 OS 공유 시트, 미지원·실패 시 URL 복사 폴백)를 제공한다(change 05). 서버 발송 RPC는 없다 — 관리자가 복사/공유한 URL을 원하는 채널에 붙이는 모델.

## FE 표면

- `/admin`은 `lazyRouteComponent` 코드 스플릿(메인 번들 영향 0) + SessionGate(인증) 뒤.
  관리자 판정은 서버 게이트가 한다 — FE는 판정하지 않고 PermissionDenied에 반응만 한다.
- 키 입력 필드는 저장/테스트 직후 즉시 클리어 — 평문 키를 화면·상태·쿼리 캐시에 남기지
  않는다. 차트는 외부 의존성 없이 경량 인라인 SVG.
