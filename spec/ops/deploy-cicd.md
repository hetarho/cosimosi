# 14. deploy-cicd - 배포 파이프라인 (as-built)

> 현재 구현 기준 문서. develop→staging·main→production 자동 배포의 SSOT(빌드 산출물·Actions 워크플로·마이그레이션 게이트·시크릿·롤백). | 범위: Infra/CI-CD | 상태: 구현 완료, 반영: 18 관측 강화, 32 환경 분리(예정)

## 목적

13까지는 `pnpm dev`로 로컬에서 한 바퀴가 돈다. 이 스펙은 그 산출물을 실제 인터넷에 올리고, `develop`/`main` 머지만으로 손대지 않고 배포되게 만든다. 세 배포 다리는 서로 독립이다: 프론트(Cloudflare Workers, 네이티브 Git 연동)·백엔드(Lightsail VPS의 GHCR 이미지)·DB(Supabase 마이그레이션). 가장 위험한 다리(마이그레이션)는 항상 백엔드 교체 직전에 게이트로 돈다.

운영 실값(도메인·VPS IP·Supabase 프로젝트·재구성 절차·롤백)의 SSOT는 리포 루트 `DEPLOY.md`다. 본 스펙은 빌드 산출물과 워크플로의 구조를 기술한다.

## 현재 구현

### 백엔드 프로덕션 이미지 — `backend/Dockerfile`

- 멀티스테이지. builder는 `golang:1.26-alpine`에서 `go mod download` 후 `CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /api ./cmd/api`로 정적·stripped 바이너리를 만든다.
- runtime은 `gcr.io/distroless/static-debian12:nonroot` — 셸 없음, `USER nonroot:nonroot`(uid 65532), ca-certificates 번들(Supabase TLS용). 바이너리만 복사하고 `EXPOSE 8080`, `ENTRYPOINT ["/api"]`.
- dev의 air 핫리로드(`backend/Dockerfile.dev`)와 완전히 분리된다.
- MVP 워커는 같은 바이너리의 고루틴이므로(Architecture §4.6) 한 이미지가 API + 워커를 모두 서비스한다.
- `backend/.dockerignore`는 `bin/`, `tmp/`, `*.exe`, `.env`, `.air.toml`, `Dockerfile`, `Dockerfile.dev`를 빌드 컨텍스트에서 제외한다.

### 프로덕션 런타임 — `docker-compose.prod.yml`

- 서비스는 `api` 하나뿐이다. TLS/리버스 프록시는 이 컴포즈에 없다.
  - `image: ghcr.io/hetarho/cosimosi-api:${IMAGE_TAG:-latest}`
  - `env_file: .env`, `restart: unless-stopped`, `expose: ["8080"]`
  - 외부 `edge` 도커 네트워크에 붙고, alias로 `${API_UPSTREAM}`(= `cosimosi-api-prod` | `cosimosi-api-staging`)을 등록한다.
- `networks.edge.external: true` — VPS에서 한 번 `docker network create edge`.
- 로컬 postgres가 없다. `DATABASE_URL`은 Supabase를 가리킨다.
- VPS에는 환경별로 한 스택씩 둔다: `/srv/cosimosi-staging`, `/srv/cosimosi-prod`. 각자 비추적 `.env`를 가진다.
- `IMAGE_TAG`는 인라인이 아니라 `.env`에서 읽는다 — `pull`과 `up -d`가 같은 SHA를 보간하도록(인라인 할당은 첫 명령에만 적용된다).

### 공유 edge 프록시 — `deploy/edge/{docker-compose.yml,Caddyfile}`

- VPS 전체에서 80/443을 점유하는 유일한 컨테이너. `/srv/edge`에 수동 배치하고 수동 관리한다(배포 워크플로의 대상이 아니다). api 스택은 그 아래에서 독립적으로 롤한다.
- `docker-compose.yml`: `caddy:2-alpine`, `ports: 80:80, 443:443`, 외부 `edge` 네트워크, named volume `caddy_data`/`caddy_config`. `API_DOMAIN_PROD`/`API_DOMAIN_STAGING`을 환경변수로 받는다(`/srv/edge/.env`).
- `Caddyfile`: 두 도메인 블록이 각각 `cosimosi-api-prod:8080`, `cosimosi-api-staging:8080`으로 `reverse_proxy` + `transport http { versions h2c 2 }`. Connect는 평문 HTTP/2(h2c)로 받는다. TLS는 Caddy가 도메인별 자동 발급한다.
- CORS는 여기가 아니라 api가 처리한다(`connectrpc.com/cors`, 허용 origin = 각 스택의 `CORS_ORIGIN`).
- 한 환경 api가 죽으면 그 도메인만 502, 다른 도메인은 계속 응답한다.
- 스택마다 Caddy를 두면 80/443이 충돌하므로 per-stack Caddy는 금지다.

### CI 게이트 — `.github/workflows/ci.yml`

- `on: pull_request: [develop, main]` **및** `push: [develop, main]`(PR 머지 게이트 + 솔로 직푸시 검증). 시크릿 불필요.
- `frontend` 잡: `pnpm/action-setup@v4`(package.json의 packageManager 사용) + node 22 + pnpm 캐시 → `pnpm install --frozen-lockfile` → `pnpm --filter ./frontend lint` → `pnpm --filter ./frontend build`.
- `backend` 잡(`working-directory: backend`): `setup-go@v5`(`go-version-file: backend/go.mod`) → `go vet ./...` → `go build ./...`. Linux 러너라 §8 Windows .exe 제약과 무관.

### 백엔드 배포 — `.github/workflows/deploy-backend.yml`

- 트리거: `on: push: branches: [develop, main]` + `paths: ['backend/**', 'docker-compose.prod.yml', '.github/workflows/deploy-backend.yml']` + `workflow_dispatch`(수동 재배포). edge Caddyfile은 트리거 경로가 아니다(별도 수동 관리).
- `concurrency.group: deploy-backend-${{ github.ref_name }}`, `cancel-in-progress: false` — 환경별 직렬화(두 이미지 동시 롤 방지).
- 환경 분기는 `github.ref_name`: `main`→`prod`(`ENV_NAME`)/`production`(`environment`), 그 외→`staging`/`staging`.
- **`build` 잡** (`permissions: packages: write`):
  - `docker/build-push-action@v6`로 `./backend/Dockerfile`을 항상 빌드해 Dockerfile을 CI에서 검증한다.
  - GHCR push는 `push: ${{ vars.DEPLOY_ENABLED == 'true' }}` — repo variable `DEPLOY_ENABLED`가 켜졌을 때만. VPS 준비 전엔 빌드만 하고 push/롤아웃을 skip(실패 아님)해 워크플로를 그린으로 유지한다.
  - 태그 둘: `ghcr.io/hetarho/cosimosi-api:${{ github.sha }}`와 `:${{ ENV_NAME }}`(prod|staging). GHCR 인증은 `docker/login-action@v3` + `GITHUB_TOKEN`(자동), push할 때만 로그인.
- **`rollout` 잡** (`needs: build`, `if: vars.DEPLOY_ENABLED == 'true'`, `environment:`로 per-env 시크릿 + prod 수동 승인 옵션):
  1. `appleboy/scp-action@v0.1.7`로 마이그레이션 동기화: `source: backend/internal/db/migrations/*` → `target: /srv/cosimosi-${ENV_NAME}/migrations`, `strip_components: 4`(경로 평탄화). goose 실행 이전에 둔다(goose가 마운트하므로 파일이 먼저 있어야 한다).
  2. `appleboy/ssh-action@v1.2.0`로 VPS 접속(`envs: IMAGE_TAG,DIRECT_DATABASE_URL,ENV_NAME`), 스택 디렉터리에서 `set -e` 스크립트:
     - **goose up (5432 직접)**: `docker run --rm -v "$PWD/migrations:/migrations" -e GOOSE_DRIVER=postgres -e GOOSE_DBSTRING="$DIRECT_DATABASE_URL" -e GOOSE_COMMAND=up ghcr.io/kukymbr/goose-docker:3.27.1`. goose 공식 Docker 이미지가 없어 kukymbr 래퍼를 쓴다(로컬 `scripts/db.mjs`와 동일 이미지·동일 인터페이스). 실패하면 non-zero로 종료 → api는 교체되지 않는다.
     - **IMAGE_TAG 기록**: `.env`에 `^IMAGE_TAG=` 줄이 있으면 `sed -i`로 치환, 없으면 append. compose가 `.env`를 자동 로드해 `pull`/`up`이 같은 SHA를 본다.
     - **롤아웃**: `docker compose -f docker-compose.prod.yml pull` → `docker compose -f docker-compose.prod.yml up -d --remove-orphans`(`--remove-orphans`로 컴포즈에서 빠진 옛 per-stack Caddy 같은 컨테이너 정리) → `docker image prune -f`.

### 마이그레이션 게이트와 Supabase 풀러 분리

- DDL은 트랜잭션 풀러(6543)가 아니라 직접 연결(5432)로 실행해야 한다 → 마이그레이션용 `DIRECT_DATABASE_URL`(5432)과 앱 런타임용 `DATABASE_URL`(6543 풀러)을 분리한다.
- 앱 런타임의 `DATABASE_URL`은 `?default_query_exec_mode=simple_protocol`이 필수다. 트랜잭션 풀러가 백엔드 연결을 공유해 pgx의 named prepared statement 캐시가 클라이언트 간 충돌(`42P05`)하고 api 재시작 루프를 일으킨다 — simple protocol이 prepared statement를 끈다.
- `DIRECT_DATABASE_URL`은 GitHub Actions secret(env별, `rollout`의 `environment:`로 선택), 앱 `DATABASE_URL`은 VPS 스택 `.env`에 산다.

### 프론트 = Cloudflare Workers

- Cloudflare Pages가 아니라 Workers 정적 자산 배포다(`wrangler.jsonc`). 14 도입 당시 "Pages 프로젝트 2개" 계획은 Workers로 대체되었다. 운영 SSOT는 `DEPLOY.md`.
- `wrangler.jsonc`(리포 루트): `name: cosimosi`, `assets.directory: ./frontend/dist`, `assets.not_found_handling: single-page-application`(딥링크/새로고침을 200 index.html로). 별도 Worker 스크립트(`main`)는 없다 — 순수 정적 Vite SPA.
- 대시보드 Build command `pnpm --filter ./frontend build` → `frontend/dist`, deploy `npx wrangler deploy`(main 프로덕션 승격) / `npx wrangler versions upload`(그 외 브랜치 프리뷰).
- Cloudflare Workers Builds(네이티브 Git 연동)가 push를 감지해 빌드한다 — GitHub Actions와 무관, 병렬.
- `VITE_*`는 빌드 타임에 번들에 박히므로 대시보드 Build Variables에 넣는다. 현재 빌드 변수는 공용 1세트로 develop 프리뷰도 prod 값으로 빌드된다 — staging/prod 빌드·DB 분리는 32 소관.

### 관측가능성 — Sentry init

- **BE** (`backend/cmd/api/main.go`): `cfg.SentryDSN`이 있으면 `sentry.Init(ClientOptions{Dsn, Environment, Release: version})`. 성공 시 `defer sentry.Flush(2s)` + `defer sentry.Recover()`. DSN 없으면 전체를 건너뛴다(로컬/테스트 no-op).
  - 핸들러를 `sentryhttp.New(Options{Repanic: true})`로 감싸 request-scoped hub를 붙이고 non-RPC mux(/health) 패닉을 잡는다.
  - RPC 패닉은 connect recover 인터셉터(17) 안에서 회복되어 sentryhttp까지 가지 않으므로, `rpcserver.PanicCapture` 훅으로 hub에 `RecoverWithContext`해서 Sentry로 보낸다. Sentry는 composition root에 머무르고 rpcserver는 infra-only로 유지된다(nil 훅 = 로그만).
  - env: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`(기본 `development`). `Release`는 바이너리의 `version`.
- **FE** (`frontend/src/main.tsx`): `VITE_SENTRY_DSN`이 있으면 `@sentry/react` `Sentry.init`. 현재 18이 강화한 상태다 — `environment: VITE_SENTRY_ENVIRONMENT ?? MODE`, `release: VITE_APP_VERSION`(없으면 undefined), `integrations: [browserTracingIntegration()]`, `tracesSampleRate: 0.1`. DSN 없으면 init 스킵. PostHog `initAnalytics({key, host})`도 같은 엔트리에서 호출하지만 그 소관은 18이다.
  - `tracePropagationTargets`는 기본(동일 출처)이다 — 교차 출처 api에 sentry-trace 헤더를 붙이면 백엔드 CORS allow-headers에 없어 프리플라이트가 깨진다.
  - `VITE_APP_VERSION`은 `frontend/vite.config.ts`가 `WORKERS_CI_COMMIT_SHA`에서 주입한다(18 소관).

## Public Interfaces

- `backend/Dockerfile`
  - builder `golang:1.26-alpine` → runtime `gcr.io/distroless/static-debian12:nonroot`
  - 출력 바이너리 `/api`(= `./cmd/api`), `EXPOSE 8080`
- `docker-compose.prod.yml`
  - service `api`, image `ghcr.io/hetarho/cosimosi-api:${IMAGE_TAG:-latest}`
  - 외부 network `edge`, alias `${API_UPSTREAM}`
- `deploy/edge/docker-compose.yml`
  - service `caddy`(`caddy:2-alpine`, 80/443), env `API_DOMAIN_PROD`, `API_DOMAIN_STAGING`
- `deploy/edge/Caddyfile`
  - upstream `cosimosi-api-prod:8080`, `cosimosi-api-staging:8080`(h2c)
- `.github/workflows/ci.yml`
  - jobs `frontend`, `backend`
- `.github/workflows/deploy-backend.yml`
  - jobs `build`, `rollout`
  - repo variable `DEPLOY_ENABLED`
  - secrets `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `DIRECT_DATABASE_URL`
  - GHCR `ghcr.io/hetarho/cosimosi-api` 태그 `:<sha>`, `:<env>`
- `wrangler.jsonc`
  - `name: cosimosi`, `assets.directory: ./frontend/dist`, `not_found_handling: single-page-application`
- `backend/internal/platform/config/config.go`
  - `Config.SentryDSN`, `Config.SentryEnvironment`, `Config.CORSOrigin`, `Config.Port`, `Config.DatabaseURL`
- `backend/internal/platform/rpcserver`
  - `PanicCapture` 훅 타입
- `.env.production.example` 키
  - `IMAGE_TAG`, `DATABASE_URL`(6543 + simple_protocol), `DIRECT_DATABASE_URL`(5432), `PORT`, `API_UPSTREAM`, `CORS_ORIGIN`, `SUPABASE_PROJECT_URL`, `SUPABASE_JWT_SECRET`, `AI_EMBEDDER`, `OPENAI_API_KEY`, `ADMIN_USER_IDS`, `LLM_KEY_ENCRYPTION_KEY`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`

## Flutter 동등성 기준

- 이 스펙은 웹 프론트 배포(Cloudflare Workers)와 공유 백엔드 인프라를 다룬다. 백엔드 이미지·compose·edge·마이그레이션 게이트는 클라이언트 종류와 무관하게 동일하다.
- Flutter 클라이언트가 추가되면 백엔드는 그대로 재사용한다. 다리만 별도다: Flutter는 정적 자산 배포 대신 앱 스토어/번들 파이프라인을 가진다.
- 클라이언트는 환경별 API base URL(prod `api.<도메인>` / staging `api.staging.<도메인>`)을 빌드 타임 설정으로 주입하고, 해당 환경의 `CORS_ORIGIN`/허용 redirect와 일치해야 한다(브라우저 CORS는 Flutter 네이티브에는 해당 없음).
- Sentry/관측 키는 클라이언트별 빌드 변수로 주입하고, 없으면 no-op이어야 한다.

## 수용 기준

1. `develop`에 백엔드 경로 push가 가면 staging 스택(`/srv/cosimosi-staging`)에, `main`이면 prod 스택에 배포된다.
2. PR이 열리면 프론트 `lint`+`build`와 백엔드 `vet`+`build`가 실행되고 실패가 머지를 막는다.
3. 백엔드 변경 없이 프론트 파일만 바뀐 push는 `deploy-backend.yml`을 트리거하지 않는다(paths 필터).
4. `build` 잡은 항상 이미지를 빌드해 Dockerfile을 검증하고, GHCR push는 `DEPLOY_ENABLED=='true'`일 때만 일어난다.
5. `rollout`은 `goose up`을 백엔드 컨테이너 교체 이전에 실행하고, 마이그레이션 실패 시 api를 교체하지 않는다(`set -e`).
6. 마이그레이션은 직접 연결(5432, `DIRECT_DATABASE_URL`)을 쓰고, 앱 런타임은 풀러(6543, simple_protocol) `DATABASE_URL`을 쓴다.
7. `IMAGE_TAG`는 스택 `.env`에 기록되어 `pull`과 `up -d`가 같은 SHA를 본다(인라인 할당 아님).
8. edge Caddy 하나가 두 도메인 TLS를 자동 발급하고 각각 `cosimosi-api-prod|staging:8080`으로 h2c 프록시한다. per-stack Caddy는 없다.
9. 프론트는 Cloudflare Workers로 정적 자산을 배포하고, 매칭 없는 경로를 index.html(200)로 돌려 딥링크가 404가 되지 않는다.
10. BE/FE Sentry는 환경별 DSN으로 초기화되고, DSN 미설정 환경에서는 빌드/기동이 깨지지 않는다.
11. 리포에 시크릿이 없다(`.env.production.example`은 값 없는 키만). 실값은 GitHub Actions secrets/variables, VPS 비추적 `.env`, Cloudflare 빌드 변수에 산다.
12. 백엔드 롤백은 스택 `.env`의 `IMAGE_TAG`를 이전 SHA로 바꿔 재배포, 프론트는 Worker Deployments에서 이전 버전으로 되돌린다.
