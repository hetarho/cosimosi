# 배포 (CI/CD) — cosimosi

`develop` / `main`에 머지하면 어떻게 프로덕션까지 가는지 정리한 문서다. 파이프라인 배관
(Dockerfile, `docker-compose.prod.yml`, `Caddyfile`, `.github/workflows/`)은 리포 안에 있고,
아래의 클라우드 계정/대시보드 클릭 작업은 **1회성 수동 작업**이다(spec 14). **시크릿은 절대
커밋하지 않는다** — 실제 값은 GitHub Actions Secrets, VPS의 비추적 `.env`, Cloudflare 환경변수에만 둔다.

## 브랜치 → 환경

| 브랜치 | 프론트 (Cloudflare Pages) | 백엔드 (Hetzner VPS) | DB (Supabase) |
|---|---|---|---|
| `develop` | 프로젝트 `cosimosi-staging` | 스택 `/srv/cosimosi-staging` (`api.staging.<도메인>`) | staging 프로젝트 |
| `main` | 프로젝트 `cosimosi-prod` | 스택 `/srv/cosimosi-prod` (`api.<도메인>`) | prod 프로젝트 |

머지 시: Cloudflare가 프론트를 **스스로** 빌드한다(네이티브 Git 연동, 병렬). GitHub Actions
(`deploy-backend.yml`)는 API 이미지를 빌드 → GHCR push → VPS에 SSH 접속 → **마이그레이션 먼저
(직접 연결 5432) → `IMAGE_TAG` 기록 → `compose pull && up -d`** 순서로 실행한다. 마이그레이션은
API 컨테이너 교체 **이전**에 돌고, 실패하면 기존 컨테이너가 그대로 유지된다.

## 1. Cloudflare 프론트 호스팅 — 프로젝트 2개 (네이티브 Git, T013/T014)

프론트는 순수 정적 Vite SPA라 **Cloudflare Pages** 또는 **Workers(정적 자산)** 둘 다 가능하다.
Cloudflare가 Pages를 Workers로 통합하는 중이라 계정에 따라 둘 중 하나만 보일 수 있다:

- **Workers import 화면만 보이면** ("Configure your **Worker** project", Deploy command
  `npx wrangler deploy`) → 그게 정상이다. 리포 루트의 **`wrangler.jsonc`**(이미 포함됨)가
  `frontend/dist`를 정적 자산으로 올리고 SPA 폴백을 처리한다. 아래 "Workers 경로" 참고.
- **별도 Pages 메뉴가 있으면** (Workers & Pages → Create → Pages → Connect to Git) → 폼에
  출력/루트 디렉터리 칸이 나온다. 아래 "Pages 경로" 참고.

어느 쪽이든 환경변수(아래 표)와 환경 2개(staging=`develop`, prod=`main`)는 동일하다.

### Pages 경로 (Pages 메뉴가 보일 때)

대시보드 → Workers & Pages → **Pages → Connect to Git** → 이 리포에 연결된 Pages 프로젝트 2개 생성:

- **`cosimosi-staging`** — 프로덕션 브랜치 `develop`
- **`cosimosi-prod`** — 프로덕션 브랜치 `main`

두 프로젝트 모두 동일한 빌드 설정(폼에 그대로 입력):

- Framework preset: **None**(또는 Vite)
- Build command: `pnpm --filter ./frontend build`
- Build output directory: `frontend/dist`
- Root directory: 비움(= 리포 루트). watch path는 모노레포라 `frontend/`로 둬 백엔드만 바뀐 변경은 빌드 스킵.

> SPA 딥링크: `/universe`·`/dormant`를 새로고침해도 200으로 `index.html`이 떠야 한다. Pages 프로젝트
> 설정의 "Single Page Application" 모드를 켜서 처리한다(`/* /index.html 200` `_redirects` 규칙은 새
> assets 검증기에서 무한 루프로 거부되므로 쓰지 않는다 — Workers와 동일하게 not_found 방식을 쓴다).

환경변수는 아래 "공통: 환경변수"를 참고해 프로젝트별로 입력한다.

### Workers 경로 (import 화면이 "Configure your Worker project"일 때)

리포 루트의 **`wrangler.jsonc`가 이미 정적 자산 + SPA 폴백을 설정**해 둔다(폼에 출력/루트 디렉터리 칸이
없는 이유 — Workers는 그 설정을 이 파일에서 읽는다). import 화면("Set up your application")에서:

- Project name: `cosimosi`(또는 `cosimosi-prod`) — `wrangler.jsonc`의 `name`과 맞춘다.
- Build command: `pnpm --filter ./frontend build`
- Deploy command: `npx wrangler deploy` (기본값 그대로)
- 환경변수: Advanced settings(또는 생성 후 Settings) → Variables에 환경별 `VITE_*`(아래 표) 입력.
  안 넣으면 배포는 되지만 앱이 API/Supabase에 연결되지 않는다.

`wrangler.jsonc`(리포 루트, 이미 포함):

```jsonc
{
  "name": "cosimosi",
  "compatibility_date": "2025-06-01",
  // 정적 자산만 배포(별도 Worker 스크립트 없음). SPA라 not_found_handling 필수 —
  // 매칭 안 되는 경로는 200으로 index.html을 돌려준다(/universe·/dormant 딥링크).
  "assets": { "directory": "./frontend/dist", "not_found_handling": "single-page-application" }
}
```

> 환경 2개(staging/prod) 분리는 Workers에서도 Worker 2개로 만든다(각 브랜치 연결 + 각자 `VITE_*`).
> 두 번째(staging)는 `wrangler.jsonc`에 `env.staging`을 추가하고 Deploy command를
> `npx wrangler deploy --env staging`로 둔다. 우선 prod 하나만 띄워 동작을 확인한 뒤 추가해도 된다.

### 공통: 환경변수

빌드 타임 변수 — `VITE_*`는 번들에 박히므로 환경마다 별도 빌드가 되어 staging URL이 prod 번들에
섞이지 않는다(5.1). Pages는 프로젝트 설정, Workers는 Variables(빌드 환경)에 넣는다:

| 변수 | staging | prod |
|---|---|---|
| `VITE_API_URL` | `https://api.staging.<도메인>` | `https://api.<도메인>` |
| `VITE_SUPABASE_URL` | staging 프로젝트 URL | prod 프로젝트 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | staging 키 | prod 키 |
| `VITE_SENTRY_DSN` | (선택) staging DSN | (선택) prod DSN |
| `VITE_SENTRY_ENVIRONMENT` | `staging` | `production` |

프론트 롤백: Cloudflare 대시보드 → 해당 프로젝트 → Deployments → 이전 배포로 "Rollback" (6.2).

## 2. Supabase — 프로젝트 2개 (T018)

- staging·prod **별도 프로젝트**(최소한 별도 DB)를 만든다 → staging 마이그레이션이 prod
  데이터에 절대 닿지 않게.
- 프로젝트마다 연결 문자열 2개를 분리해서 쓴다 (spec 14 §6):
  - **앱 런타임** → 트랜잭션 풀러, 포트 **6543** → VPS `.env`의 `DATABASE_URL`.
  - **마이그레이션** → 직접 연결, 포트 **5432** → GitHub Secret `DIRECT_DATABASE_URL`
    (DDL은 풀러를 거치면 안 된다).
- ⚠️ **리전 코로케이션**: Supabase 프로젝트를 Hetzner VPS와 같은(또는 가장 가까운) 리전에 둬서
  API↔DB 지연을 낮춘다(Architecture §7). 실서비스 전에 확인할 것.

## 3. Hetzner VPS — 1회성 부트스트랩 (T016)

VPS 한 대가 두 스택을 모두 호스팅한다(디렉터리·서브도메인 분리, Caddy가 각각 TLS 발급).

1. Docker Engine + compose 플러그인 설치.
2. 각 환경 `e ∈ {staging, prod}`마다 `/srv/cosimosi-$e/` 디렉터리에 아래를 둔다:
   - `docker-compose.prod.yml`·`Caddyfile` (이 리포에서 복사)
   - `.env` — `.env.production.example`을 채운 것(비추적, `chmod 600`).
     `API_DOMAIN`(`api.staging.<도메인>` / `api.<도메인>`), `DATABASE_URL`(6543),
     `CORS_ORIGIN`(해당 환경 Pages 도메인), `SUPABASE_JWT_SECRET`, `AI_EMBEDDER`/
     `OPENAI_API_KEY`, `SENTRY_DSN`/`SENTRY_ENVIRONMENT` 설정. `IMAGE_TAG`는 배포 스텝이 덮어쓴다.
   - `migrations/` — goose 실행 전에 배포 워크플로(scp)가 생성/동기화한다.
3. 배포용 SSH **공개키**를 `~/.ssh/authorized_keys`에 등록.
4. `docker login ghcr.io`를 패키지 **read** 권한 토큰으로 1회 실행(`compose pull`이 되도록 —
   push는 워크플로가 `GITHUB_TOKEN`으로 처리).
5. `api.<도메인>`·`api.staging.<도메인>`의 DNS `A`/`AAAA` 레코드를 VPS로 향하게 설정.

## 4. GitHub 설정 (T017, T012)

**Secrets** (Settings → Secrets and variables → Actions). 환경별 값은 **Environments**
(`production`, `staging`) 아래에 둬서 각 배포가 알맞은 값을 읽게 한다:

- `SSH_HOST`, `SSH_USER`, `SSH_KEY` (배포용 개인키)
- `DIRECT_DATABASE_URL` (환경별 — 해당 Supabase의 5432 직접 연결 URL)

GHCR는 별도 시크릿이 필요 없다(`GITHUB_TOKEN` 자동).

**Environments**: `production`·`staging`를 만든다. `production`에는 **필수 리뷰어**를 추가해
prod 백엔드 배포 전 수동 승인 게이트를 둘 수 있다(T012).

## 5. 롤백 (6.2)

- **백엔드**: VPS의 `/srv/cosimosi-<env>/.env`에서 `IMAGE_TAG=<이전-sha>`로 바꾼 뒤
  `docker compose -f docker-compose.prod.yml pull && up -d`. (GHCR 이미지는 커밋 SHA로 태깅됨.)
- **프론트**: Cloudflare 대시보드 → 이전 배포로 Rollback.

## 시크릿 정책

커밋되는 것에 시크릿은 하나도 없다. `.env`는 gitignore되어 있고, `.env.production.example`은
**값 없는 키만** 문서화한다. SSH 키·DB URL·API 키는 GitHub Secrets / VPS `.env` / Cloudflare
환경변수에만 존재한다.
