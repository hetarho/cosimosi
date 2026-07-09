# 배포 — cosimosi 운영 문서

현재 배포가 **어떻게 되어 있는지**와, 같은 환경을 **처음부터 재구성하는 절차**를 기록한다.
시크릿 값은 절대 커밋하지 않는다 — 이 문서는 시크릿의 **이름과 위치**만 적는다(§3).

## 1. 한눈에 — 현재 구조

```
브라우저
 ├─ cosimosi.haeram.me ───────────────▶ Cloudflare Worker `cosimosi` (정적 자산, main 빌드)
 └─ https://api.cosimosi.haeram.me ──▶ Lightsail VPS 43.203.82.239 (서울)
                                        └─ edge Caddy(80/443, TLS 자동 발급)
                                            ├─ api.cosimosi.haeram.me         → cosimosi-api-prod:8080
                                            └─ api.staging.cosimosi.haeram.me → cosimosi-api-staging:8080
DB/Auth: Supabase 프로젝트 behdksjirevqcqbfajqc (서울 ap-northeast-2)
이미지: ghcr.io/hetarho/cosimosi-api:<커밋 SHA>
```

| 항목          | 값                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| 도메인        | `haeram.me` (가비아 구매, Cloudflare DNS)                                                                   |
| 프론트 prod   | `cosimosi.haeram.me` = Worker `cosimosi` (계정 서브도메인 `sunlikeperson`)                                  |
| 프론트 프리뷰 | `<버전8자리>-cosimosi.sunlikeperson.workers.dev` (main 외 모든 브랜치 push마다)                             |
| 백엔드 VPS    | Lightsail `cosimosi`, 서울 `ap-northeast-2a`, $7/1GB, Static IP **43.203.82.239**                           |
| API 도메인    | prod `api.cosimosi.haeram.me` / staging `api.staging.cosimosi.haeram.me` — DNS **회색 구름(DNS only)** 필수 |
| DB/Auth       | Supabase `behdksjirevqcqbfajqc` (서울). staging·prod가 **같은 DB 공유** — 분리는 베타 직전 spec 32          |
| 브랜치 매핑   | `develop` → staging 스택 + 프리뷰 빌드 / `main` → prod 스택 + 프로덕션 빌드                                 |

## 2. 일상 배포 (자동 — 키 없이 동작)

**백엔드** — `develop`/`main`에 백엔드 경로(`apps/api/**`, `docker-compose.prod.yml`, 워크플로)가
바뀐 push가 가면 `deploy-backend.yml`이: 이미지 빌드 → GHCR push → VPS에 SSH(repo secret
`SSH_KEY` 사용 — 로컬 pem 불필요) → **goose 마이그레이션(5432 직접 연결) 먼저** → 스택 `.env`에
`IMAGE_TAG=<sha>` 기록 → `compose pull && up -d --remove-orphans`. 마이그레이션이 실패하면 api는
교체되지 않는다. 수동 재배포: GitHub Actions 탭 → Deploy backend → **Run workflow**(브랜치 선택).

**프론트** — Cloudflare Workers Builds(네이티브 Git 연동)가 push를 감지해 빌드한다.
`main` → `npx wrangler deploy`(프로덕션 승격), 그 외 브랜치 → `npx wrangler versions upload`
(프리뷰 버전만). 빌드 변수는 **공용 1세트**라 develop 프리뷰도 prod 값으로 빌드된다(분기는 spec 32).
수동 재빌드: Worker → Deployments → 해당 빌드 → **Retry build**.

**프론트 배포 확인**: Worker `cosimosi` → Deployments → Version History에서 버전 클릭 →
Preview URL. 빌드 로그 맨 끝(Deploying 단계)에도 같은 URL이 찍힌다.

## 3. 키·시크릿 인벤토리 (값은 여기 없음 — 위치만)

| 이름                                                                                 | 어디에                                                                | 용도                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SSH_HOST`/`SSH_USER`/`SSH_KEY`                                                      | GitHub repo secrets                                                   | Actions→VPS 배포 접속 (43.203.82.239 / ubuntu / 배포 전용 ed25519 개인키)                                                                                                                                   |
| `DIRECT_DATABASE_URL`                                                                | GitHub repo secret                                                    | goose 마이그레이션용 Supabase 직접 연결(5432, session pooler)                                                                                                                                               |
| `DEPLOY_ENABLED=true`                                                                | GitHub repo **variable**                                              | 배포 스위치 — 지우면 rollout이 건너뛰어짐(빌드 검증만)                                                                                                                                                      |
| `VITE_API_URL`/`VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`                   | Cloudflare Worker → Settings → Build → Variables and secrets          | 프론트 빌드 타임 주입(번들에 박히는 공개값)                                                                                                                                                                 |
| `VITE_SENTRY_DSN`/`VITE_SENTRY_ENVIRONMENT` · `VITE_POSTHOG_KEY`/`VITE_POSTHOG_HOST` | Cloudflare Worker → Settings → Build → Variables and secrets          | 프론트 관측(spec 18): Sentry 에러·트레이싱, PostHog 제품 지표. **비우면 전부 no-op.** release 태그(`VITE_APP_VERSION`)는 설정 불필요 — vite.config가 Workers Builds의 `WORKERS_CI_COMMIT_SHA`에서 자동 주입 |
| `cosimosi build token`                                                               | Cloudflare가 자동 관리 (Worker → Settings → Build → API token)        | Workers Builds의 배포 인증. **빌드가 10001 인증 에러로 죽으면 여기서 새 토큰 생성**                                                                                                                         |
| 스택 `.env`                                                                          | VPS `/srv/cosimosi-{staging,prod}/.env` (`chmod 600`, 비추적)         | 런타임 시크릿 — §4 키 목록                                                                                                                                                                                  |
| edge `.env`                                                                          | VPS `/srv/edge/.env`                                                  | `API_DOMAIN_PROD`/`API_DOMAIN_STAGING` (도메인뿐, 시크릿 아님)                                                                                                                                              |
| `~/.ssh/lightsail-cosimosi.pem`                                                      | 작업자 로컬 (`chmod 400`)                                             | **사람이** VPS에 SSH할 때만. 분실 시 Lightsail 콘솔 → Account → SSH keys에서 재다운로드                                                                                                                     |
| `~/.ssh/cosimosi-deploy`(+`.pub`)                                                    | 작업자 로컬                                                           | 배포 키 원본 — 개인키 사본이 GitHub `SSH_KEY`, 공개키가 VPS `authorized_keys`에 등록됨                                                                                                                      |
| `~/cosimosi-deploy-secrets.env`                                                      | 작업자 로컬                                                           | DB 연결 문자열 보관용 메모(리포 밖). VPS `.env` 작성 시 source해서 씀                                                                                                                                       |
| GHCR pull PAT (`read:packages`, classic)                                             | github.com/settings/tokens + VPS `ubuntu` 계정 docker 로그인에 저장됨 | VPS가 private 이미지를 pull. **sudo 없이** `docker login` 해야 함(배포가 ubuntu로 실행)                                                                                                                     |

## 4. VPS 내부 구조

```
/srv/
├── edge/                      # 공유 Caddy — 80/443의 유일한 소유자 (수동 관리)
│   ├── docker-compose.yml     # 리포 deploy/edge/에서 복사
│   ├── Caddyfile              # 두 api 도메인 TLS + h2c 프록시
│   └── .env                   # API_DOMAIN_PROD / API_DOMAIN_STAGING
├── cosimosi-staging/          # develop이 배포되는 스택
│   ├── docker-compose.prod.yml  # 리포에서 복사 (파일이 바뀌면 재복사 — 워크플로는 migrations만 동기화)
│   ├── .env                     # 아래 키들, chmod 600
│   └── migrations/              # 배포 워크플로가 scp로 동기화
└── cosimosi-prod/             # main이 배포되는 스택 (구성 동일)
```

- 스택 `.env` 키: `IMAGE_TAG`(배포가 갱신) · `DATABASE_URL`(**6543 트랜잭션 풀러 +
  `?default_query_exec_mode=simple_protocol` 필수** — 풀러가 백엔드 연결을 공유해 pgx prepared
  statement가 충돌(42P05)·api 재시작 루프) · `DIRECT_DATABASE_URL`(5432) · `PORT=8080` ·
  `API_UPSTREAM`(`cosimosi-api-staging`|`cosimosi-api-prod` — edge 네트워크에서의 DNS 별칭) ·
  `CORS_ORIGIN`(해당 환경 프론트 origin) · `SUPABASE_PROJECT_URL` · `AI_EMBEDDER`/`OPENAI_API_KEY` ·
  `SENTRY_DSN`/`SENTRY_ENVIRONMENT`. 키 문서화는 `.env.production.example`.
- 도커 외부 네트워크 `edge`(`docker network create edge`)로 Caddy↔api가 통신한다.
  Caddy는 스택마다 띄우지 않는다 — 80/443 충돌.
- 서버 점검 한 줄: `ssh -i ~/.ssh/lightsail-cosimosi.pem ubuntu@43.203.82.239 'docker ps'`

## 5. 처음부터 재구성 (재해 복구 / 새 환경)

전제: 리포 클론, Cloudflare에 도메인, Supabase 프로젝트(서울 — **리전은 생성 후 변경 불가**,
Data API 불필요하면 끔), GHCR PAT(`read:packages`, classic).

1. **Lightsail**: 서울 → Ubuntu 24.04 LTS → $7 Dual-stack 플랜 → Static IP 부착 →
   방화벽 22/80/443(Any IPv4) → Account → SSH keys에서 기본 키 다운로드 →
   `mv ~/Downloads/*.pem ~/.ssh/lightsail-cosimosi.pem && chmod 400 ~/.ssh/lightsail-cosimosi.pem`
2. **DNS**(Cloudflare): `api.cosimosi`·`api.staging.cosimosi` A 레코드 → Static IP,
   둘 다 **DNS only(회색)** — 주황 구름이면 Caddy 인증서 발급 실패.
3. **서버 부트스트랩** (`IP=<Static IP>`로 치환):
   ```bash
   ssh -i ~/.ssh/lightsail-cosimosi.pem ubuntu@$IP 'set -e
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
   echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab > /dev/null
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker ubuntu
   docker network create edge || true
   sudo mkdir -p /srv/edge /srv/cosimosi-staging/migrations /srv/cosimosi-prod/migrations
   sudo chown -R ubuntu:ubuntu /srv'
   ```
4. **파일 배치 + .env**: 리포 루트에서
   ```bash
   scp -i ~/.ssh/lightsail-cosimosi.pem docker-compose.prod.yml ubuntu@$IP:/srv/cosimosi-staging/
   scp -i ~/.ssh/lightsail-cosimosi.pem docker-compose.prod.yml ubuntu@$IP:/srv/cosimosi-prod/
   scp -i ~/.ssh/lightsail-cosimosi.pem deploy/edge/docker-compose.yml deploy/edge/Caddyfile ubuntu@$IP:/srv/edge/
   ```
   - `/srv/edge/.env`: `API_DOMAIN_PROD=api.cosimosi.haeram.me`, `API_DOMAIN_STAGING=api.staging.cosimosi.haeram.me`
   - 스택별 `/srv/cosimosi-<env>/.env`: `.env.production.example`을 채워서(§4 키 목록, `chmod 600`).
     DB 문자열은 `~/cosimosi-deploy-secrets.env`에 보관해 두고 source해서 넣는다.
5. **GHCR 로그인**(VPS에서, **sudo 없이**): `echo '<PAT>' | docker login ghcr.io -u hetarho --password-stdin`
6. **배포 키**: `ssh-keygen -t ed25519 -f ~/.ssh/cosimosi-deploy -N "" -C cosimosi-github-actions-deploy`
   → 공개키를 VPS `~/.ssh/authorized_keys`에 추가.
7. **GitHub** (Settings → Secrets and variables → Actions): secrets `SSH_HOST`(Static IP),
   `SSH_USER`(`ubuntu`), `SSH_KEY`(`~/.ssh/cosimosi-deploy` 내용), `DIRECT_DATABASE_URL`(5432) →
   전부 끝난 뒤 variable `DEPLOY_ENABLED=true`.
8. **기동**: 각 스택에서 `docker compose -f docker-compose.prod.yml up -d`, `/srv/edge`에서
   `docker compose up -d`. 이후는 머지가 알아서 배포한다(§2).
9. **Cloudflare Worker**(프론트): 리포 import(이름 `cosimosi` = `wrangler.jsonc`의 name),
   production 브랜치 `main`, build `pnpm --filter @cosimosi/web build`, deploy `npx wrangler deploy`,
   version `npx wrangler versions upload`, 변수 3종(§3) 입력, 커스텀 도메인 `cosimosi.haeram.me` 연결.
10. **Supabase Auth**: Google provider(Client ID/Secret — GCP 리디렉션 URI에
    `https://<ref>.supabase.co/auth/v1/callback`), URL Configuration의 Site URL
    `https://cosimosi.haeram.me` + Redirect URLs(`…/universe` 3종: prod·localhost:1214·프리뷰 와일드카드),
    OTP 쓰면 이메일 템플릿에 `{{ .Token }}`.

## 6. 롤백

- **백엔드**: VPS `/srv/cosimosi-<env>/.env`의 `IMAGE_TAG=<이전 SHA>`로 바꾸고
  `docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`.
  (GHCR 이미지는 커밋 SHA로 태깅돼 있다.)
- **프론트**: Worker → Deployments → 이전 버전으로 rollback/promote.

## 7. 함정 모음 (한 번씩 실제로 밟은 것들)

- **트랜잭션 풀러(6543) + pgx** → `DATABASE_URL`에 `?default_query_exec_mode=simple_protocol`
  없으면 42P05 재시작 루프. DDL/마이그레이션은 풀러 금지 — 5432 직접 연결(`DIRECT_DATABASE_URL`).
- **Caddy는 한 마리** — 스택마다 띄우면 두 번째가 `Bind for 0.0.0.0:80 failed`.
- **GHCR 로그인은 ubuntu 계정으로**(sudo ✕) — 배포가 ubuntu로 pull한다.
- **DNS 회색 구름** — 주황(프록시)이면 Let's Encrypt 발급 실패.
- **goose 공식 Docker 이미지는 없다** — `ghcr.io/kukymbr/goose-docker:3.27.1` 사용(로컬 `scripts/db.mjs`와 동일).
- **Workers Builds 10001 인증 에러** — 빌드 토큰이 죽은 것. Worker → Settings → Build → API token에서 새로 생성.
- **Supabase 무료 티어는 7일 무활동 시 일시정지** — 출시 전 keep-alive(주기적 `SELECT 1`) 필요.
- **Supabase redirect 허용목록에 없는 origin은 Site URL로 폴백** — 프리뷰/로컬에서 로그인하면
  prod로 떨어지는 증상의 원인.
