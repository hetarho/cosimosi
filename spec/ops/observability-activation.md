# 33. observability-activation — Sentry·PostHog 실계정 연결 (맨 마지막)

> spec 18이 배선해 둔 관측 장치에 실제 키를 꽂아 켠다 — 계정 가입·키 발급·CF 빌드 변수·검증. | 범위: Infra/수동 | 선행: 18 (+ 사실상 모든 plan — **베타 직전 맨 마지막에 수행**) | 차단: —

## 목적 (Why)

spec 18에서 Sentry(에러·트레이싱·release)와 PostHog(7개 제품 이벤트)는 코드 배선이 끝났지만, **키가 없으면 전부 no-op**으로 설계돼 있어 지금은 아무것도 보내지 않는다. 개발 중에는 그 상태가 오히려 옳다(노이즈·쿼터 낭비 없음). 베타 직전, 나머지 plan을 모두 끝낸 시점에 실계정을 연결해 측정을 시작한다.

이 spec의 절반은 **사람(계정 가입·키 발급)** 몫이고, 나머지 절반(검증)은 에이전트가 돕는다.

## 범위

**포함**
- PostHog 가입 + 프로젝트 생성 + API 키 발급
- Sentry FE DSN 확인/발급 (BE DSN은 spec 14에서 이미 운영 중)
- Cloudflare Worker 빌드 변수 입력 + 재빌드
- spec 18 DoD의 수동 검증 항목 전부 (이벤트 도착·본문 부재·release 태그·큐 요약 로그)
- (선택) Sentry 소스맵 수동 업로드 — spec 18 T008 백로그 회수

**비목표 (Out of scope)**
- 코드 변경 일절 없음 — 배선은 18에서 끝났다. 키를 꽂아도 코드가 바뀌면 안 된다.
- 소스맵 업로드 CI 자동화 (수동으로 시작, 필요해지면 별도 작업)
- PostHog 대시보드/퍼널 구성 (데이터가 쌓인 뒤 — 베타 운영 중 작업)

## 참고

- [18.analytics-observability](18.analytics-observability.md) — 배선 내역·이벤트 설계. 정전 규칙은 [policy/ux/analytics-privacy.md](../policy/ux/analytics-privacy.md)
- [DEPLOY.md](../../DEPLOY.md) §3 — CF Worker 빌드 변수 위치 (`Worker → Settings → Build → Variables and secrets`)
- `.env.example` 프론트 관측 블록 — 키 이름의 단일 출처

## 작업 (Tasks)

> 👤 = 사람이 직접, 🤖 = 에이전트가 수행/보조

- [ ] T001 👤 PostHog 가입(us.posthog.com, 프라이버시 우선이면 eu.posthog.com) → 프로젝트 생성 → Settings에서 **Project API Key(`phc_…`)** 복사
- [ ] T002 👤 Sentry에서 FE용 DSN 확보 — CF 빌드 변수에 `VITE_SENTRY_DSN`이 이미 있으면 그대로, 없으면 Sentry 프로젝트(React)에서 DSN 발급
- [ ] T003 👤 Cloudflare Worker → Settings → Build → Variables에 입력: `VITE_POSTHOG_KEY=phc_…` (+EU면 `VITE_POSTHOG_HOST=https://eu.i.posthog.com`) · `VITE_SENTRY_DSN` · `VITE_SENTRY_ENVIRONMENT=production`. release(`VITE_APP_VERSION`)는 설정 불필요(빌드가 커밋 SHA 자동 주입)
- [ ] T004 👤 재빌드 — push 또는 Worker → Deployments → Retry build
- [ ] T005 🤖 검증(spec 18 DoD 수동 항목): 로그인→일기 작성→회상 후 ① PostHog에 `sign_in`·`universe_loaded`·`record_memory` 도착 ② 네트워크 탭에서 record_memory 페이로드에 일기 본문 부재 ③ Sentry 테스트 에러(의도적 throw)에 release(커밋 SHA)·environment 태그 ④ 프로덕션 백엔드 로그에 `queue summary` 주기 출력
- [ ] T006 (선택) 👤🤖 Sentry 소스맵 수동 업로드(`sentry-cli sourcemaps upload`) → 스택트레이스가 원본 TS 라인으로 보이는지 확인

## 정책 영향(policy)

없음 — 규칙은 [policy/ux/analytics-privacy.md](../policy/ux/analytics-privacy.md)에 이미 정의돼 있고, 이 작업은 그 규칙대로 동작하는지 실환경에서 확인만 한다.

## 완료 정의 (DoD)

- PostHog Activity에 7개 이벤트 중 최소 `sign_in`·`universe_loaded`·`record_memory`가 실데이터로 도착, 모든 이벤트에 `demo` 속성 존재.
- record_memory 네트워크 페이로드에 일기 본문/원문 부재(브라우저 네트워크 탭 육안 확인).
- Sentry 이벤트에 release(커밋 SHA)·environment 태그가 붙어 도착.
- 프로덕션 `docker logs`에 `queue summary pending=… due_pending=…` 라인이 5분 주기로 보임.
