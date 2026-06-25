# 통합 검증 게이트 (quality-gates)

> cosimosi의 **코어 루프 한 바퀴와 그것을 지키는 정적·통합 게이트**의 단일 출처(SSOT)다 — 빌드·린트·FSD 임포트 방향·postprocessing 부재·불변/비삭제 grep, 그리고 사인인→작성→별→연결→회상 강화→감쇠→재점화 사슬. 새 코드는 이 게이트를 통과해야 한다(브라우저 시각 E2E는 수동·사용자 몫).

## 목적

개별 스펙은 자기 영역만 검증한다. 13은 사인인 → 작성 → 별 등장 → 연결 → 회상 강화 → 감쇠 → 잠든 별 재점화가 한 시스템에서 실제로 이어지는지를 확인하는 통합 기준이며, 8개 헌법 원칙이 통합 상태에서도 깨지지 않도록 자동으로 검사하는 정적 게이트를 정의한다. 코드 변경이 본질이 아니라 "한 바퀴 완성"을 선언 가능하게 하는 검증 기준이 본질이다.

로컬 한 바퀴까지가 13의 끝이다. 배포(Cloudflare Workers·Lightsail·Supabase·GHCR·goose CD)는 14가, 자동화 E2E는 본 문서 범위 밖이다.

## 단일 명령 기동

- `pnpm dev`는 `concurrently`로 두 프로세스를 동시에 띄운다(`package.json` `scripts.dev`).
  - `web`: `pnpm --filter @cosimosi/web dev` — Vite 개발 서버, `:1214`(`apps/web/vite.config.ts` `server.port`).
  - `api`: `pnpm run dev:api` = `docker compose --profile dev up backend`.
- backend 컨테이너는 `depends_on: postgres (condition: service_healthy)`이므로 postgres가 healthy가 되기 전에는 기동하지 않는다(연결 실패로 죽지 않음). healthcheck는 `pg_isready -U cosimosi -d cosimosi`.
- postgres 이미지는 `pgvector/pgvector:pg16`이라 별도 확장 설치 없이 임베딩 KNN(05)이 같은 컨테이너에서 동작한다. `docker-compose.yml`에 minio·S3·다른 의존 서비스는 없다.
- backend는 `Dockerfile.dev`(golang:1.26-alpine + `air` 핫리로드)로 빌드되고, `./apps/api`를 볼륨 마운트해 소스 변경을 즉시 반영한다.
- 따라서 단일 명령으로 pgvector postgres(:5432) + Connect API(:8080) + Vite 프론트(:1214)가 함께 뜬다.

## 환경 변수 표면

`.env.example`이 로컬 한 바퀴에 필요한 키의 SSOT다. 값 의미는 각 키 주석에 인라인되어 있다.

- Backend
  - `PORT` (기본 8080), `DATABASE_URL`.
  - `SUPABASE_PROJECT_URL`, `SUPABASE_JWT_SECRET` — RPC 인증 인터셉터가 JWKS(ES256/RS256) 또는 HS256으로 access token을 검증한다. 둘 다 비면 보호 RPC는 fail-closed(`Unauthenticated`).
  - `AI_EMBEDDER` (기본 `mock`) — 임베딩 공급자 선택. `mock`은 keyless 결정론 벡터로 keyless E2E를 가능케 하고, `openai`는 `OPENAI_API_KEY`를 요구한다(`apps/api/internal/ai/factory.go`).
  - `OPENAI_API_KEY` — `AI_EMBEDDER=openai`일 때만 필요.
  - `ADMIN_USER_IDS`, `LLM_KEY_ENCRYPTION_KEY` — admin 콘솔(34) 소관.
- Frontend (Vite-prefixed, 브라우저 노출)
  - `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
  - `VITE_SENTRY_*`, `VITE_POSTHOG_*`, `VITE_APP_VERSION` — 관측성(18), 전부 비우면 no-op.
- `CORS_ORIGIN`은 `.env.example`에 없다. compose env로만 주입한다(`docker-compose.yml` backend `CORS_ORIGIN: http://localhost:1214`). config 기본값도 같다(`apps/api/internal/platform/config/config.go`).
- S3/MinIO/버킷 키는 어디에도 없다. 별 형태는 클라가 seed로 결정론 생성하므로 이미지 스토리지가 불필요하다.
- 추출 LLM에는 env 노브가 없다(34): admin 콘솔의 ACTIVE 선택이 있으면 실 LLM, 없으면 keyless mock으로 동작한다. 공급자 키는 콘솔(`/admin`)에서 입력해 DB에 AES-256-GCM 봉투 암호로 저장한다.

## 마이그레이션

- 깨끗한 pgvector DB에 goose `up`을 적용하는 경로는 `scripts/db.mjs`다.
  - `pnpm db:migrate` = `goose up`, `pnpm db:status` / `pnpm db:down` / `pnpm db:reset`.
  - goose는 공식 이미지가 없어 `ghcr.io/kukymbr/goose-docker:3.27.1` 래퍼를 compose 네트워크(`cosimosi_default`) 위 one-shot 컨테이너로 돌린다.
  - `apps/api/internal/db/migrations`를 `/migrations`로 마운트하고 `GOOSE_DRIVER=postgres`, `GOOSE_DBSTRING`(compose 내부 호스트 `postgres:5432`)을 넘긴다.
  - `hasDbSchema()`가 거짓이면(스키마 없음) 건너뛴다.
- 현재 마이그레이션 파일은 `00001_engram_schema` ~ `00008_star_gifts`다(번호순). 깨끗한 DB에 전부 up 적용되는 것이 통합 기준이다.

## 정적 게이트

`pnpm dev`로 한 바퀴 돌기 전, 자동으로 검사되는 통합 게이트다. 모두 현재 0건/통과 상태다.

### 빌드·린트

- 프론트 빌드: `pnpm --filter @cosimosi/web build` = `tsc -b && vite build`, 0-error.
- 프론트 린트: `pnpm --filter @cosimosi/web lint` = `eslint .`.
- FSD 구조(세그먼트명·public API·슬라이스 경계)는 `pnpm --filter @cosimosi/web lint:fsd` = `steiger ./src`가 별도로 강제한다(`apps/web/steiger.config.ts`).

### 임포트 방향 / 순수성 (원칙4)

- ESLint `eslint-plugin-boundaries`가 강제한다(`apps/web/eslint.config.js`). 별도 grep이 아니라 `eslint .` 안에서 깨진다.
- `pure` 레이어 = `src/entities/*/model/**`, `src/shared/lib/**`, `src/shared/api/**`, `src/shared/config/**`. 이들은 `three`·`three/*`·`@react-three/*`·`react`·`react-dom` import 시 error다.
- 예외 = `renderer` 포트 `src/shared/lib/r3f/**`(매칭 우선순위가 pure보다 앞). three 의존은 여기와 `*/ui`·플랫폼 레이어에만 산다. 현재 pure 레이어의 three/React 위반은 0건이고, 유일한 `three` 임포트(`shared/lib/r3f/renderer.ts`)는 renderer 포트라 정당하다.
- `src/shared/api/gen`(protoc-gen-es 산출)은 lint에서 제외한다(생성 코드, 원칙5).

### postprocessing 부재 (원칙8)

- `@react-three/postprocessing`은 `apps/web/package.json` 의존성에도, `apps/web/src/**`에도 0건이다. Bloom 등 발광은 TSL 셰이더 경로로만 처리한다(원칙8 "셰이더는 TSL"): Bloom은 `widgets/universe-canvas/ui/BloomPass.tsx`(`three/webgpu` RenderPipeline + `three/addons/tsl/display/BloomNode.js`), emissive TSL 노드는 `entities/star/ui/forms.ts|single.ts`·`entities/synapse/ui`·`widgets/universe-canvas/ui`에 산다. `shared/lib/r3f`는 렌더러 포트(구성)일 뿐 발광 처리 위치가 아니다.

### 불변·비삭제 (원칙1·2)

- 원본 일기 본문(`records`) row `UPDATE`/`DELETE`, 별·시냅스(`memories`/`memory_links`) row `DELETE`가 sqlc 쿼리·마이그레이션 Up 본문에 0건이어야 한다. 감쇠는 클라 밝기 계산일 뿐 서버가 행을 지우지 않는다.
- 검사 대상: `apps/api/internal/db/queries`, `apps/api/internal/db/migrations`.
- 권장 패턴(주석 줄 제외 — SQL 자기-문서화 주석에 "no UPDATE records" 같은 문구가 패턴에 걸리므로):
  ```sh
  grep -rniE '\b(delete[[:space:]]+from[[:space:]]+(records|memories|memory_links)|update[[:space:]]+records)\b' \
    apps/api/internal/db/queries apps/api/internal/db/migrations | grep -vE ':[0-9]+:[[:space:]]*--'
  ```
  현재 결과 0건.
- 위반이 아닌 것(패턴에 잡히지 않거나 정당함):
  - goose `Down`의 `DROP TABLE`(스키마 드롭은 정당).
  - `memories`의 `last_recalled_at` 갱신(11 회상), `memory_links`의 `weight`/`last_activated_at` 갱신(11 강화), `memories` 재성형 4컬럼 갱신(`ApplyReshape`, 23) — 모두 `UPDATE memories`/`UPDATE memory_links`이며 패턴(`UPDATE records`만 잡음)에 걸리지 않고 정당한 회상·강화·재성형이다.
  - `DELETE FROM jobs`(00004) — jobs는 불변 대상이 아닌 ephemeral 큐.

## 코어 루프 한 바퀴

통합이 성립한다는 것은 아래 RPC·동작 사슬이 한 시스템에서 이어진다는 뜻이다. 각 단계의 데이터·API 계층은 해당 스펙의 테스트로 자동 검증되며, 남은 것은 브라우저 시각 확인뿐이다(사용자 몫).

1. 사인인 — Supabase 세션 수립 후 access token이 보호 RPC의 `Authorization: Bearer`로 주입된다(01).
2. 작성 — `SegmentMemory` 미리보기 → 사용자 확정 → `RecordMemory`가 불변 `records`를 저장하고 조각 별 `memories`로 fan-out한다(04·21·10).
3. 임베딩·연결 — worker가 조각을 임베딩하고 τ=0.75 이상 의미 이웃에 시냅스를 만든다(05). 후보는 `knnK=8` 기준 후보풀 16에서 뽑고, 22의 흥분성 경쟁 재랭크로 최종 `biasedK=5`만 남긴다(`top-8`은 개념적 이웃 수이지 최종 fan-out 개수가 아니다). 임계 SSOT는 `spec/policy/domain/synapse.md`, 쿼리는 `apps/api/internal/db/queries/embedding.sql`.
4. 등장 — `GetUniverse`가 좌표 없는 별/시냅스 렌더 입력을 반환하고, 클라 force-sim이 위치를 창발시킨다(06·07·08·09, 원칙3).
5. 회상 강화 — 한 화면에서 함께 본 별 쌍의 시냅스 weight를 클라 로컬에서 누적해 `ReinforceLinks` unary 배치로 보낸다(11, 원칙6). 회상 flush 상태관리는 39의 `features/recall` `recall-flush.machine.ts`(XState)가 소유한다.
6. 감쇠 — 오래 안 본 별은 클라가 `last_recalled_at` 경과로 밝기를 낮추되 A_MIN 바닥에서 잔존한다(12·26, 원칙2). 별 row는 절대 지워지지 않는다.
7. 재점화 — 잠든 별은 풀페이지가 아니라 우주 셸 위 망원경 탐색기 별 탭에서 탐색·재점화한다. 레거시 `?panel=dormant`는 루트 진입 시 별 탭을 한 번 열고 제거된다. 별 탭은 `features/star-explorer`가 렌더하고, 재점화는 다시 회상 강화 경로로 합류한다.

수동 브라우저 E2E(로그인·작성·시각 확인)는 자동화하지 않는다. 데이터·API 계층 등가물은 각 스펙 테스트(memory·ai·job·link·activation)로 검증됨이 전제다.

## Public Interfaces

- `package.json`
  - `scripts.dev` (`concurrently` web + api), `scripts.dev:api` (`docker compose --profile dev up backend`)
  - `scripts.db:migrate` / `db:status` / `db:down` / `db:reset` / `infra:up` / `infra:down`
  - `scripts.build:web` / `build:api`
- `docker-compose.yml`
  - 서비스: `postgres`(`pgvector/pgvector:pg16`, healthcheck), `backend`(profile `dev`, `depends_on: postgres healthy`)
  - 볼륨: `postgres_data`, `backend_go_mod`, `backend_tmp`
- `apps/api/Dockerfile.dev` — golang:1.26-alpine + air
- `scripts/db.mjs` — goose 마이그레이션 러너(up/status/down/reset)
- `scripts/lib.mjs`
  - `COMPOSE_NETWORK = 'cosimosi_default'`
  - `hasDbSchema()`
- `apps/web/package.json`
  - `scripts.build` (`tsc -b && vite build`), `scripts.lint` (`eslint .`), `scripts.lint:fsd` (`steiger ./src`), `scripts.test`
- `apps/web/eslint.config.js` — `boundaries` pure/renderer/platform 경계 규칙(원칙4)
- `.env.example` — env 키 SSOT: `PORT`, `DATABASE_URL`, `SUPABASE_PROJECT_URL`, `SUPABASE_JWT_SECRET`, `AI_EMBEDDER`, `OPENAI_API_KEY`, `ADMIN_USER_IDS`, `LLM_KEY_ENCRYPTION_KEY`, `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SENTRY_*`, `VITE_POSTHOG_*`, `VITE_APP_VERSION`
- `apps/api/internal/platform/config/config.go`
  - `Config` (`AIEmbedder` 기본 `mock`, `CORSOrigin` 기본 `http://localhost:1214`, `EmbedDim = 1536`)
- `apps/api/internal/ai/factory.go`
  - `NewEmbedder(cfg)` (mock|openai), `NewExtractor(cfg, client, src)` (admin-controlled, 34)

## Flutter 동등성 기준

13은 검증 게이트 문서라 Flutter가 재현할 "산출물"은 없다. 대신 Flutter 클라이언트는 같은 BE 계약과 같은 코어 루프 한 바퀴를 동일하게 충족해야 한다.

- 같은 `MemoryService` unary RPC 사슬(`SegmentMemory` → `RecordMemory` → `GetUniverse` → `ReinforceLinks`/`RecallMemory`/`ListDormant`)을 거쳐야 한다.
- 같은 8개 헌법 원칙을 지켜야 한다: 원본 일기 불변, 별·시냅스 비삭제(밝기만 감쇠), 좌표는 클라 창발, AI는 공급자 추상화 뒤, 회상 강화는 로컬 누적 + unary 배치.
- 키 의미는 같다: `AI_EMBEDDER=mock`로 keyless 한 바퀴, Supabase 세션 토큰을 보호 RPC에 Bearer로 주입, S3는 불필요.
- FSD 임포트 방향·postprocessing 부재 같은 웹 전용 정적 게이트는 Flutter에 해당하지 않는다.

## 수용 기준

1. `pnpm dev` 한 번으로 pgvector postgres(:5432) + Connect API(:8080) + Vite 프론트(:1214)가 모두 뜬다.
2. postgres가 healthy가 되기 전 backend 컨테이너는 대기하고, 연결 실패로 죽지 않는다.
3. `.env.example`은 `VITE_SUPABASE_URL`·`VITE_SUPABASE_PUBLISHABLE_KEY`·`AI_EMBEDDER`·`OPENAI_API_KEY`·`DATABASE_URL`을 포함하고 `S3_*`/MinIO 키를 포함하지 않는다.
4. `AI_EMBEDDER`가 비거나 `mock`이면 키 없이 결정론 벡터로 임베딩이 동작하고, `openai`인데 `OPENAI_API_KEY`가 비면 부팅이 명확히 실패한다.
5. `pnpm --filter @cosimosi/web build`와 `lint`가 0-error로 통과한다.
6. goose가 깨끗한 pgvector DB에 모든 up 마이그레이션(00001~00008)을 오류 없이 적용한다.
7. pure 레이어(`entities/*/model`·`shared/lib`·`shared/api`·`shared/config`)는 `three`·`@react-three/*`·`react`/`react-dom`을 import하지 않으며, 위반 시 `eslint .`가 깨진다.
8. 프론트 의존성·소스 어디에도 `@react-three/postprocessing`이 없다.
9. sqlc 쿼리·마이그레이션 Up 본문에 `UPDATE records`, `DELETE FROM records|memories|memory_links` row 연산이 없다(주석 줄 제외 grep 0건). goose `Down`의 `DROP TABLE`과 `memories`/`memory_links`의 회상·강화·재성형 `UPDATE`는 위반이 아니다.
10. 사인인 → 작성 → 별 등장 → 시냅스 연결 → 공동 회상 강화 → 감쇠 잔존 → 재점화가 한 시스템에서 끊김 없이 이어진다.
