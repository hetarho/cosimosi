# 분석·관측 (analytics & observability) — 정책

> 베타는 측정 장치다: 에러는 Sentry, 행동 지표는 PostHog. 단, **일기는 비공개**가 제품
> 정체성이므로(concept.md) 측정이 본문을 만지는 일은 어떤 예외도 없다.

## 정의

- **제품 이벤트**: `shared/lib/analytics`의 `capture(EVENTS.*, props)`로만 보낸다. 이벤트
  이름과 속성 모양은 그 모듈의 `EVENTS`/`EventProps`가 단일 출처 — 임의 문자열 이벤트나
  자유 속성은 타입이 막는다.
- **키 없으면 no-op**: `VITE_POSTHOG_KEY`(PostHog)·`VITE_SENTRY_DSN`(Sentry)이 비면 해당
  계측은 초기화조차 되지 않는다. 로컬 dev·체험 모드는 기본적으로 아무것도 보내지 않는다.

## 규칙 — 프라이버시 (불변)

1. **일기 body·임베딩·기억 내용은 어떤 이벤트에도 싣지 않는다.** 본문 관련은 길이 버킷
   (`short` ≤100 · `medium` ≤500 · `long` >500 코드포인트)과 mood까지만.
2. **autocapture 텍스트 전면 마스킹**: `mask_all_text` + `mask_all_element_attributes`.
   일기 입력(`MemoryForm` textarea)과 회상 본문(`MemoryPanel` article)은 `ph-no-capture`로
   요소 자체를 제외한다(이중 가드).
3. **Session Replay 미사용**: `disable_session_recording: true` (PostHog), Sentry Replay
   미도입. 도입하려면 텍스트·입력 마스킹 기본이 전제(plan 18, 3.5).
4. **PII 최소화**: 식별자는 Supabase uid만(`identify`). 이메일·이름은 보내지 않는다.
   사인아웃/계정 전환 시 `posthog.reset()`으로 식별을 끊는다.
5. **공통 속성 `demo`**: 모든 이벤트에 체험 모드 여부가 붙는다 — 체험 트래픽을 베타
   퍼널에서 걸러내기 위함.

## 규칙 — 이벤트 설계표 (정전)

| 이벤트 | 속성 | 발화 지점 |
|---|---|---|
| `sign_in` | — | uid가 새로 확인될 때(신규 사인인·세션 복원·계정 전환) — "가입/재방문" |
| `universe_loaded` | star_count, synapse_count, load_ms, renderer(webgpu\|webgl2) | 렌더러 백엔드 확정 + GetUniverse 도착이 합류한 순간, 페이지 로드당 1회 |
| `record_memory` | mood, body_length_bucket, success | 서버 왕복 결과(낙관 제출 성공/실패). 로컬 검증 차단은 세지 않는다 |
| `recall_open` | is_dormant | ≥2s 체류로 회상이 실제 발화한 시점. is_dormant는 발화 직전 활성도(`isDormant`) 기준 |
| `reinforce_flush` | pair_count | 강화 배치 전송 **성공** 시(재시도는 같은 batchId라 성공 1회만 잡힌다) |
| `dormant_visit` | dormant_count | 잠든 별 목록 첫 도착, 방문당 1회 |
| `appearance_switch` | theme | **다른** 테마 칩 선택(같은 테마 재클릭·오브제 전환은 세지 않는다) |

**귀속(attribution) 가드**: 출처 경계 리셋(로그아웃·계정 전환·체험 전환)이 비동기 작업
도중 일어나면 그 작업의 이벤트는 보내지 않는다 — 이전 사용자의 행동이 다음 식별자에
귀속되면 안 된다. `record_memory`는 temp 별 생존(`tempAlive`), `reinforce_flush`는 세션
동일성(`get().session === s`)으로 가드한다. 계정 A→B 직접 전환 시에는 `identify` 전에
`posthog.reset()`으로 먼저 끊는다.

## 규칙 — 에러·성능 (Sentry FE)

- `release` = `VITE_APP_VERSION` ← CF Workers 빌드의 `WORKERS_CI_COMMIT_SHA`를 vite.config가
  주입(로컬 빌드는 release 태깅 생략). `environment` = `VITE_SENTRY_ENVIRONMENT`(없으면 MODE).
- `browserTracingIntegration`, `tracesSampleRate: 0.1`. `tracePropagationTargets`는 기본값
  유지 — 교차 출처 API에 sentry-trace 헤더를 붙이면 백엔드 CORS 프리플라이트가 깨진다.

## 규칙 — 백엔드 큐 가시성

- 임베딩 워커가 **5분 주기**(+기동 직후 1회)로 큐 스냅샷을 구조화 로그 1줄로 남긴다:
  `queue summary pending=N due_pending=N running=N failed=N oldest_pending=...` — 그라파나
  없이 `docker logs`로 백로그를 본다. `due_pending`은 지금 처리 가능한 것(`next_run_at <=
  now()`, ClaimJob과 동일 기준)이고 `pending`에는 backoff 대기 재시도가 섞여 있다. 통계
  조회 실패는 경고만 남기고 파이프라인을 막지 않는다.

## 구현 근거

- plan 18 (analytics-observability). 코드: `frontend/src/shared/lib/analytics/index.ts`(래퍼·
  이벤트 상수), `frontend/src/main.tsx`(PostHog·Sentry init), 계측 지점은 auth-store /
  HomePage·UniverseCanvas / use-record-memory / MemoryPanel / recall store / DormantPage /
  AppearanceSwitcher. BE: `backend/internal/job/worker.go`(`logQueueSummary`),
  `backend/internal/db/queries/job.sql`(`JobQueueStats`).
