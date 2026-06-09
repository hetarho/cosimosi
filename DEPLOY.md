# 배포 (CI/CD) — cosimosi

`develop` / `main`에 머지하면 어떻게 프로덕션까지 가는지 정리한 문서다. 파이프라인 배관
(Dockerfile, `docker-compose.prod.yml`, `Caddyfile`, `.github/workflows/`)은 리포 안에 있고,
아래의 클라우드 계정/대시보드 클릭 작업은 **1회성 수동 작업**이다(spec 14). **시크릿은 절대
커밋하지 않는다** — 실제 값은 GitHub Actions Secrets, VPS의 비추적 `.env`, Cloudflare 환경변수에만 둔다.

## 브랜치 → 환경

| 브랜치 | 프론트 (Cloudflare Pages) | 백엔드 (AWS Lightsail VPS · 서울) | DB (Supabase) |
|---|---|---|---|
| `develop` | 프로젝트 `cosimosi-staging` | 스택 `/srv/cosimosi-staging` (`api.staging.<도메인>`) | staging 프로젝트 |
| `main` | 프로젝트 `cosimosi-prod` | 스택 `/srv/cosimosi-prod` (`api.<도메인>`) | prod 프로젝트 |

머지 시: Cloudflare가 프론트를 **스스로** 빌드한다(네이티브 Git 연동, 병렬). GitHub Actions
(`deploy-backend.yml`)는 API 이미지를 빌드 → GHCR push → VPS에 SSH 접속 → **마이그레이션 먼저
(직접 연결 5432) → `IMAGE_TAG` 기록 → `compose pull && up -d`** 순서로 실행한다. 마이그레이션은
API 컨테이너 교체 **이전**에 돌고, 실패하면 기존 컨테이너가 그대로 유지된다.

## 1. Cloudflare 프론트 호스팅 — 프로젝트 1개로 환경 2개 (네이티브 Git, T013/T014)

프론트는 순수 정적 Vite SPA라 **Cloudflare Pages** 또는 **Workers(정적 자산)** 둘 다 가능하다.
Cloudflare가 Pages를 Workers로 통합하는 중이라 계정에 따라 둘 중 하나만 보일 수 있다:

- **Workers import 화면만 보이면** ("Configure your **Worker** project", Deploy command
  `npx wrangler deploy`) → 그게 정상이다. 리포 루트의 **`wrangler.jsonc`**(이미 포함됨)가
  `frontend/dist`를 정적 자산으로 올리고 SPA 폴백을 처리한다. 아래 "Workers 경로" 참고.
- **별도 Pages 메뉴가 있으면** (Workers & Pages → Create → Pages → Connect to Git) → 폼에
  출력/루트 디렉터리 칸이 나온다. 아래 "Pages 경로" 참고.

> **환경 2개는 프로젝트 1개로 처리한다 — staging용 프로젝트를 따로 만들 필요 없다.** `VITE_*`는
> 빌드 타임에 박히므로 환경마다 다른 값이 필요한데, Cloudflare는 한 프로젝트 안에서 **Production**
> (production 브랜치 = `main`)과 **Preview**(그 외 모든 브랜치, `develop` 포함)에 **각각 다른
> 빌드 환경변수**를 줄 수 있다. 그래서 `develop` push → Preview(staging 값) 미리보기 URL,
> `main` push → Production(prod 값) URL로 자연히 갈린다.

### Pages 경로 (Pages 메뉴가 보일 때)

대시보드 → Workers & Pages → **Pages → Connect to Git** → 리포에 연결된 Pages 프로젝트 **1개** 생성
(`cosimosi`). Production branch = `main`. 빌드 설정(폼에 그대로 입력):

- Framework preset: **None**(또는 Vite)
- Build command: `pnpm --filter ./frontend build`
- Build output directory: `frontend/dist`
- Root directory: 비움(= 리포 루트). watch path는 모노레포라 `frontend/`로 둬 백엔드만 바뀐 변경은 빌드 스킵.

환경변수는 Settings → Environment variables에서 **Production**과 **Preview** 두 탭에 각각 입력한다
(아래 "공통: 환경변수" 표 — prod 열 = Production, staging 열 = Preview). `develop` 등 비프로덕션
브랜치는 Preview 배포로 staging 값이 박힌다.

> SPA 딥링크: `/universe`·`/dormant`를 새로고침해도 200으로 `index.html`이 떠야 한다. Pages 프로젝트
> 설정의 "Single Page Application" 모드를 켜서 처리한다(`/* /index.html 200` `_redirects` 규칙은 새
> assets 검증기에서 무한 루프로 거부되므로 쓰지 않는다 — Workers와 동일하게 not_found 방식).

### Workers 경로 (import 화면이 "Configure your Worker project"일 때)

리포 루트의 **`wrangler.jsonc`가 이미 정적 자산 + SPA 폴백을 설정**해 둔다(폼에 출력/루트 디렉터리 칸이
없는 이유 — Workers는 그 설정을 이 파일에서 읽는다). import 화면("Set up your application")에서:

- Project name: `cosimosi` — `wrangler.jsonc`의 `name`과 맞춘다.
- Build command: `pnpm --filter ./frontend build`
- Deploy command: `npx wrangler deploy` (기본값 그대로)
- 환경변수: 아래 트리거 설명대로 Production/Preview에 각각 `VITE_*`(공통 표) 입력. 안 넣으면 배포는
  되지만 앱이 API/Supabase에 연결되지 않는다.

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

**환경 2개는 이 Worker 1개로 처리한다(트리거 2개).** Settings → Builds에 트리거가 둘이다:

- **Production** — production 브랜치 `main`. Deploy command `npx wrangler deploy`. Build variables = prod `VITE_*`.
- **Preview / Non-production branches** — `main` 외 전부(`develop` 포함). Deploy command는 기본
  `npx wrangler versions upload`(승격 없이 미리보기 버전 생성). Build variables = staging `VITE_*`.

각 트리거의 Build variables가 다르므로 `develop` push는 staging 값으로 빌드되어 미리보기 URL
(`*-cosimosi.<sub>.workers.dev`, 이미 켬)에, `main` push는 prod 값으로 Production URL에 뜬다.
별도 Worker/프로젝트를 만들 필요가 없다.

### 공통: 환경변수

빌드 타임 변수 — `VITE_*`는 번들에 박히므로 환경마다 별도 빌드가 되어 staging URL이 prod 번들에
섞이지 않는다(5.1). **staging 열 = Preview 트리거/환경, prod 열 = Production 트리거/환경**에 입력한다
(Pages도 Settings → Environment variables의 Preview/Production 탭, Workers도 Builds의 두 트리거):

| 변수 | staging (Preview) | prod (Production) |
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
- ⚠️ **리전 코로케이션**: Supabase 프로젝트를 Lightsail과 같은 **서울(ap-northeast-2)** 리전에
  만들어 API↔DB 지연을 낮춘다(같은 AWS 리전 내 ~1-5ms, Architecture §7). 프로젝트 생성 시 리전
  선택을 놓치지 말 것 — 생성 후 변경 불가다.
- ⚠️ **Free 티어 일시정지**: 무료 프로젝트는 DB 무활동 **7일 후 자동 일시정지**된다(재개 ~30초-2분,
  데이터는 90일까지 보존). 출시 전엔 트래픽이 없어 멈출 수 있으니 GitHub Actions cron으로 주기적
  `SELECT 1`을 날려 깨워 둔다. Free엔 PITR이 없으므로 자체 `pg_dump` 백업도 둘 것. (Pro $25/월은
  ₩2만 한도 초과 — 출시 전엔 Free 유지.)

## 3. AWS Lightsail VPS — 1회성 부트스트랩 (T016)

VPS 한 대가 두 스택을 모두 호스팅한다(디렉터리·서브도메인 분리, Caddy가 각각 TLS 발급). Lightsail을
쓰는 이유: **정액 요금**이라 ₩2만 한도가 사고로 깨지지 않고(EC2는 종량제), 콘솔이 단순하며, **x86**
이라 GHCR의 `linux/amd64` 이미지를 리빌드 없이 그대로 받는다. 규모가 커지면 같은 Docker 스택을
EC2/ECS로 옮기면 된다(provider 무관).

1. **인스턴스 생성**: Lightsail 콘솔에서 리전을 **서울(ap-northeast-2)** 로 두고 Create instance →
   Linux/Unix → **OS Only → Ubuntu 24.04 LTS** → **$7/월 1GB 플랜**(공개 IPv4 포함). 공개 API라
   IPv4가 필요하므로 IPv6 전용 $5 번들은 쓰지 않는다. RAM 여유를 원하면 2GB($12)도 한도 내.
2. **고정 IP + 방화벽**: 인스턴스에 Lightsail **Static IP**를 붙인다(붙어 있는 동안 무료 — 재부팅해도
   주소 유지). Networking 탭에서 인바운드 TCP **22(SSH)·80(HTTP)·443(HTTPS)** 를 연다.
3. **Docker 설치**: SSH 접속 후 Docker Engine + compose 플러그인 설치(get.docker.com 스크립트 →
   `apt-get install docker-compose-plugin`), 사용자를 `docker` 그룹에 추가, **1~2GB swap 파일**을
   만든다(1GB 플랜 안전판). `docker compose version`으로 확인.
4. 각 환경 `e ∈ {staging, prod}`마다 `/srv/cosimosi-$e/` 디렉터리에 아래를 둔다:
   - `docker-compose.prod.yml`·`Caddyfile` (이 리포에서 복사)
   - `.env` — `.env.production.example`을 채운 것(비추적, `chmod 600`).
     `API_DOMAIN`(`api.staging.<도메인>` / `api.<도메인>`), `DATABASE_URL`(6543),
     `CORS_ORIGIN`(해당 환경 Pages 도메인), `SUPABASE_JWT_SECRET`, `AI_EMBEDDER`/
     `OPENAI_API_KEY`, `SENTRY_DSN`/`SENTRY_ENVIRONMENT` 설정. `IMAGE_TAG`는 배포 스텝이 덮어쓴다.
   - `migrations/` — goose 실행 전에 배포 워크플로(scp)가 생성/동기화한다.
5. 배포용 SSH **공개키**를 인스턴스 기본 사용자(`ubuntu`)의 `~/.ssh/authorized_keys`에 등록.
6. `docker login ghcr.io`를 패키지 **read** 권한 토큰으로 1회 실행(`compose pull`이 되도록 —
   push는 워크플로가 `GITHUB_TOKEN`으로 처리).
7. **DNS**: `api.<도메인>`·`api.staging.<도메인>`의 `A` 레코드를 Lightsail **고정 IP**로 향하게
   한다(IPv6를 켰으면 `AAAA`도). ⚠️ Cloudflare DNS를 쓰면 이 레코드는 **DNS-only(회색 구름)** 로
   두거나 SSL/TLS 모드를 **Full(strict)** 로 한다 — **Flexible**로 프록시하면 Caddy의 Let's Encrypt
   HTTP-01 챌린지가 실패해 인증서를 못 받는다.

## 4. GitHub 설정 (T017, T012)

**Secrets** (Settings → Secrets and variables → Actions). 환경별 값은 **Environments**
(`production`, `staging`) 아래에 둬서 각 배포가 알맞은 값을 읽게 한다:

- `SSH_HOST`(Lightsail **고정 IP**), `SSH_USER`(`ubuntu`), `SSH_KEY` (배포용 개인키)
- `DIRECT_DATABASE_URL` (환경별 — 해당 Supabase의 5432 직접 연결 URL)

GHCR는 별도 시크릿이 필요 없다(`GITHUB_TOKEN` 자동).

**배포 스위치 (Variables)**: `deploy-backend.yml`은 `build`(이미지 빌드·GHCR push — 항상 실행,
Dockerfile 검증 겸용)와 `rollout`(마이그레이션 → SSH로 API 교체)으로 나뉜다. `rollout`은 repo
variable **`DEPLOY_ENABLED=true`** 일 때만 실행된다. VPS·secrets가 준비되기 전엔 이 변수를 두지 않아
rollout이 **건너뛰어지고(실패 아님)** 빌드만 검증된다. VPS 부트스트랩(§3) + 위 Secrets 설정이 끝나면
Settings → Secrets and variables → Actions → **Variables**에 `DEPLOY_ENABLED=true`를 추가하면 그때부터
자동 배포된다.

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
