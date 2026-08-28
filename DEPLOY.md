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

**프론트** — Cloudflare Workers Builds(네이티브 Git 연동)가 push를 감지해 빌드한다. 빌드 커맨드는
**`pnpm build:site`** 하나다: 블로그 빌드 → 웹 빌드 → `scripts/stage-blog.mjs`가 `apps/blog/dist`를
`apps/web/dist/blog/`로 옮긴다. **순서가 중요하다** — Vite가 `outDir`를 비우므로 웹 빌드보다 먼저
스테이징하면 조용히 지워진다. 스테이징 스크립트가 그 실수와 산출물 누락을 둘 다 빌드 에러로 만든다
(`spec/tech/blog-site.md` §1). `main` → `npx wrangler deploy`(프로덕션 승격), 그 외 브랜치 →
`npx wrangler versions upload`(프리뷰 버전만). 빌드 변수는 **공용 1세트**라 develop 프리뷰도 prod 값으로 빌드된다(분기는 spec 32).
수동 재빌드: Worker → Deployments → 해당 빌드 → **Retry build**.

**프론트 배포 확인**: Worker `cosimosi` → Deployments → Version History에서 버전 클릭 →
Preview URL. 빌드 로그 맨 끝(Deploying 단계)에도 같은 URL이 찍힌다.

## 3. 키·시크릿 인벤토리 (값은 여기 없음 — 위치만)

| 이름                                                                                 | 어디에                                                                | 용도                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SSH_HOST`/`SSH_USER`/`SSH_KEY`                                                      | GitHub repo secrets                                                   | Actions→VPS 배포 접속 (43.203.82.239 / ubuntu / 배포 전용 ed25519 개인키)                                                                                                                                   |
| `DIRECT_DATABASE_URL`                                                                | GitHub repo secret                                                    | goose 마이그레이션용 Supabase 직접 연결(5432, session pooler)                                                                                                                                               |
| `DEPLOY_ENABLED=true`                                                                | GitHub repo **variable**                                              | 배포 스위치 — 지우면 rollout이 건너뛰어짐(빌드 검증만)                                                                                                                                                      |
| `API_ORIGIN`/`WEB_ORIGIN`                                                            | GitHub **Environment variables** (`production`/`staging`)             | 배포 후 health/CORS 검증의 독립 기대값. prod=`https://api.cosimosi.haeram.me`/`https://cosimosi.haeram.me`; staging은 staging API와 실제 허용할 프론트 origin                                               |
| `VITE_API_URL`/`VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`                   | Cloudflare Worker → Settings → Build → Variables and secrets          | 프론트 빌드 타임 주입(번들에 박히는 공개값)                                                                                                                                                                 |
| `VITE_SENTRY_DSN`/`VITE_SENTRY_ENVIRONMENT` · `VITE_POSTHOG_KEY`/`VITE_POSTHOG_HOST` | Cloudflare Worker → Settings → Build → Variables and secrets          | 프론트 관측(spec 18): Sentry 에러·트레이싱, PostHog 제품 지표. **비우면 전부 no-op.** release 태그(`VITE_APP_VERSION`)는 설정 불필요 — vite.config가 Workers Builds의 `WORKERS_CI_COMMIT_SHA`에서 자동 주입 |
| `cosimosi build token`                                                               | Cloudflare가 자동 관리 (Worker → Settings → Build → API token)        | Workers Builds의 배포 인증. **빌드가 10001 인증 에러로 죽으면 여기서 새 토큰 생성**                                                                                                                         |
| 스택 `.env`                                                                          | VPS `/srv/cosimosi-{staging,prod}/.env` (`chmod 600`, 비추적)         | 런타임 시크릿 — §4 키 목록                                                                                                                                                                                  |
| edge `.env`                                                                          | VPS `/srv/edge/.env`                                                  | `COSIMOSI_API_DOMAIN_PROD`/`COSIMOSI_API_DOMAIN_STAGING` (도메인뿐, 시크릿 아님 — **박스의 모든 프로젝트가 공유하는 파일**이라 접두사 필수, §4.1)                                                           |
| `~/.ssh/lightsail-cosimosi.pem`                                                      | 작업자 로컬 (`chmod 400`)                                             | **사람이** VPS에 SSH할 때만. 분실 시 Lightsail 콘솔 → Account → SSH keys에서 재다운로드                                                                                                                     |
| `~/.ssh/cosimosi-deploy`(+`.pub`)                                                    | 작업자 로컬                                                           | 배포 키 원본 — 개인키 사본이 GitHub `SSH_KEY`, 공개키가 VPS `authorized_keys`에 등록됨                                                                                                                      |
| `~/cosimosi-deploy-secrets.env`                                                      | 작업자 로컬                                                           | DB 연결 문자열 보관용 메모(리포 밖). VPS `.env` 작성 시 source해서 씀                                                                                                                                       |
| GHCR pull PAT (`read:packages`, classic)                                             | github.com/settings/tokens + VPS `ubuntu` 계정 docker 로그인에 저장됨 | VPS가 private 이미지를 pull. **sudo 없이** `docker login` 해야 함(배포가 ubuntu로 실행)                                                                                                                     |

## 4. VPS 내부 구조

```
/srv/
├── edge/                          # 공유 Caddy — 80/443의 유일한 소유자. **박스 소유**, 수동 관리
│   ├── docker-compose.yml         # 박스 것 — 프로젝트가 늘어도 안 고친다
│   ├── Caddyfile                  # 라우터뿐: `import conf.d/*.caddy` (site 블록 없음)
│   ├── conf.d/                    # 프로젝트당 파일 하나 — 각 리포가 자기 것만 소유
│   │   ├── cosimosi.caddy         #   ← 이 리포 (deploy/edge/conf.d/에서 복사)
│   │   ├── cosimosi.staging.caddy #   ← 이 리포
│   │   └── <남의프로젝트>.caddy   #   ← 그 리포가 자기 파일을 들고 온다
│   └── .env                       # 모든 프로젝트의 도메인 변수 (접두사 필수, 도메인만)
├── cosimosi-staging/              # develop이 배포되는 스택
│   ├── docker-compose.prod.yml    # 리포에서 복사 (파일이 바뀌면 재복사 — 워크플로는 migrations만 동기화)
│   ├── .env                       # 아래 키들, chmod 600
│   └── migrations/                # 배포 워크플로가 scp로 동기화
└── cosimosi-prod/                 # main이 배포되는 스택 (구성 동일)
```

- 스택 `.env` 키: `IMAGE_TAG`(배포가 갱신) · `DATABASE_URL`(**5432 세션 풀러 +
  `?default_query_exec_mode=describe_exec`** — 상주 API는 트랜잭션 풀러(6543)에 붙이지 않는다. §7의
  함정 참고) · `DIRECT_DATABASE_URL`(5432) · `PORT=8080` ·
  `API_UPSTREAM`(`cosimosi-api-staging`|`cosimosi-api-prod` — edge 네트워크에서의 DNS 별칭) ·
  `COSIMOSI_CORS_ORIGINS`(해당 환경 프론트 origin, 쉼표로 여러 개) · `SUPABASE_PROJECT_URL` ·
  `SUPABASE_SERVICE_ROLE_KEY`(**서버 전용**, Auth Admin API와 withdrawal credential purge에 필수; `VITE_*`로
  노출 금지) · `INVITE_TOKEN_SIGNING_KEY`(표준 base64 32바이트 이상, 초대 링크 HMAC 및 가입 시 초대 바인딩에
  필수; `openssl rand -base64 32`) · `COSIMOSI_LLM_*`/`COSIMOSI_EMBEDDING_*` (관리자 콘솔 미선택 시
  provider별 env fallback) · `SENTRY_DSN`/`SENTRY_ENVIRONMENT` ·
  `COSIMOSI_ERROR_DETAIL`. `SUPABASE_PROJECT_URL`·`SUPABASE_SERVICE_ROLE_KEY`·`INVITE_TOKEN_SIGNING_KEY`·
  `COSIMOSI_CORS_ORIGINS` 중 하나라도 비거나 초대 키가 올바른 base64 32바이트 미만이면 배포가
  pull/quiesce 전에 중단된다. Use the exact value `verbose` only temporarily for staging diagnostics;
  **production must keep it empty**. Empty, misspelled, and unknown values all keep the cause masked. 키 문서화는
  `.env.production.example`.
- 도커 외부 네트워크 `edge`(`docker network create edge`)로 Caddy↔api가 통신한다.
  Caddy는 스택마다 띄우지 않는다 — 80/443 충돌.
- 서버 점검 한 줄: `ssh -i ~/.ssh/lightsail-cosimosi.pem ubuntu@43.203.82.239 'docker ps'`

### 4.1 edge — 한 박스를 여러 프로젝트가 나눠 쓰는 규칙

`/srv/edge/Caddyfile`은 site 블록을 담지 않고 `import conf.d/*.caddy` 한 줄만 있다. 프로젝트를 하나
얹는 일은 **파일 하나 놓기 + `.env` 한 줄**이고, 남의 파일은 건드리지 않는다.

| 파일                              | 주인                                                                   |
| --------------------------------- | ---------------------------------------------------------------------- |
| `Caddyfile`, `docker-compose.yml` | **박스**. 프로젝트별로 고치지 않는다 (전역 옵션 추가만 예외)           |
| `conf.d/<프로젝트>*.caddy`        | 그 프로젝트 리포. 자기 파일만 자유롭게 만들고 지운다                   |
| `.env`                            | 공유. **자기 접두사 변수만 append** — 남의 줄은 읽지도 고치지도 않는다 |

- **`.env`는 도메인만.** compose가 `env_file: .env`로 이 파일을 **통째로** caddy 컨테이너에 주입한다
  (그래야 새 프로젝트가 공유 compose를 안 고치고 자기 변수를 Caddy까지 보낼 수 있다). 런타임 시크릿은
  스택 `.env`(`/srv/cosimosi-<env>/.env`, `chmod 600`)에만 둔다. 전환·추가 전에 `/srv/edge/.env`에
  도메인 아닌 값이 섞여 있지 않은지 한 번 눈으로 확인한다.

- **변수 규칙 두 개.** Caddy 설정은 all-or-nothing이라, 둘 중 하나만 어겨도 **박스 전체**가 내려간다 —
  자기 프로젝트만 안 뜨는 게 아니라 모든 프로젝트가 TLS를 잃는다.
  1. **접두사 필수**(`COSIMOSI_API_DOMAIN_PROD`). `.env`가 공유라 bare `API_DOMAIN_PROD`는 형제
     프로젝트의 같은 이름과 충돌해 두 site 블록이 같은 주소로 전개되고, Caddy가
     `ambiguous site definition: <도메인>`으로 **설정 전체를 거부**한다.
  2. **활성 프래그먼트의 변수는 반드시 설정.** 미설정 변수는 빈 site 주소로 전개돼
     `server block without any key is global configuration, and if used, it must be first`로 역시
     전체가 거부된다. 그래서 환경을 끄는 건 파일 삭제가 아니라 `<프로젝트>.staging.caddy.disabled`로
     **rename**이다 — `import`가 `*.caddy`만 glob하므로 `.disabled`는 불활성이고, 켜는 건 `.disabled`를
     떼는 rename이다(순서: `.env`에 변수 먼저 → rename → validate → `up -d`). conf.d가 아예 비어
     있는 것도 안전하다: glob 미스는 경고만 남기고 통과한다.
  - cosimosi는 **두 프래그먼트가 모두 활성**이고, `.env`에 두 변수가 다 있어야 한다. staging api 스택은
    지금 떠 있지 않아서 `api.staging.cosimosi.haeram.me`는 **인증서는 정상이고 502**를 낸다 — 프래그먼트를
    활성으로 두는 이유가 그것이다. `.disabled`로 내리면 그 도메인은 502가 아니라 TLS 자체가 끊긴다.
    정말로 접는다면 변수 삭제와 `.disabled` rename을 **같은 단계에서** 한다.

### 4.2 운영 중인 VPS를 conf.d 구조로 전환 (1회성)

> **이 박스(43.203.82.239)는 전환 완료 상태다** — 아래는 edge가 아직 옛 모양인 박스를 위한 절차다.

`/srv/edge/Caddyfile`이 site 블록을 직접 담고 변수가 bare `API_DOMAIN_*`인 옛 모양이라면, 같은 박스에
두 번째 프로젝트가 올라오기 **전에** 이 전환을 끝내야 한다(남이 같은 이름으로 블록을 덧붙이는 순간
규칙 1에 걸려 cosimosi TLS까지 같이 죽는다). `/srv/edge`의 주인이 cosimosi이므로 전환도 이 리포가 한다.
`IP=43.203.82.239`, 로컬 리포 루트에서:

1. **디렉터리 + 파일 배치.** Caddy는 설정을 reload/recreate 때만 읽으므로, 여기까지는 **도는
   컨테이너에 아무 영향이 없다**.

   ```bash
   ssh -i ~/.ssh/lightsail-cosimosi.pem ubuntu@$IP 'mkdir -p /srv/edge/conf.d'
   scp -i ~/.ssh/lightsail-cosimosi.pem deploy/edge/conf.d/*.caddy ubuntu@$IP:/srv/edge/conf.d/
   scp -i ~/.ssh/lightsail-cosimosi.pem deploy/edge/Caddyfile deploy/edge/docker-compose.yml ubuntu@$IP:/srv/edge/
   ```

2. **`.env` 변수명 rename.** Caddyfile(프래그먼트)과 `.env`를 **반드시 같이** 바꾼다 — 한쪽만 바꾸면
   §4.1의 규칙 1·2에 그대로 걸린다.

   ```bash
   ssh -i ~/.ssh/lightsail-cosimosi.pem ubuntu@$IP \
     'cp /srv/edge/.env /srv/edge/.env.bak \
      && sed -i "s/^API_DOMAIN_/COSIMOSI_API_DOMAIN_/" /srv/edge/.env && cat /srv/edge/.env'
   ```

   출력에서 `COSIMOSI_API_DOMAIN_PROD`·`COSIMOSI_API_DOMAIN_STAGING` 두 줄과, **도메인 아닌 값이 없는
   것**을 확인한다(§4.1 — 이 파일은 통째로 컨테이너에 들어간다).

3. **반영 전 검증.** 컨테이너를 건드리지 않고 조립 결과만 본다. 박스 전체의 TLS를 지키는 유일한 장치다.

   ```bash
   docker run --rm -v /srv/edge/Caddyfile:/etc/caddy/Caddyfile:ro \
     -v /srv/edge/conf.d:/etc/caddy/conf.d:ro --env-file /srv/edge/.env \
     caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
   ```

   `Valid configuration`이 안 나오면 **거기서 멈춘다** — 아직 도는 설정은 옛것 그대로다. 되돌리기는
   `.env.bak` 복구 + 옛 Caddyfile 재배치가 전부다.

4. **반영.** `.env`가 바뀌었으니 **컨테이너 재생성**이 필요하다 — `caddy reload`는 기존 프로세스의 env를
   그대로 보므로 새 변수명을 절대 못 읽는다.

   ```bash
   cd /srv/edge && docker compose up -d
   ```

   **`caddy_data` 볼륨은 절대 지우지 마라**(`docker compose down -v` 금지). 발급된 인증서가 거기 있어서
   재생성해도 ACME 재발급이 없다 — 지우면 Let's Encrypt rate limit을 그대로 맞는다. compose 프로젝트명은
   디렉터리명(`edge`)에서 나오므로 볼륨 이름은 전환 뒤에도 `edge_caddy_data`/`edge_caddy_config`로 같다.

5. **확인.** 두 API 도메인에 `/health`.

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' https://api.cosimosi.haeram.me/health
   curl -sS -o /dev/null -w '%{http_code}\n' https://api.staging.cosimosi.haeram.me/health
   ```

   둘 다 `200`. 4번이 reload가 아니라 재생성이라 수 초 끊긴다 — 이 전환 딱 한 번뿐이다.

전환이 끝나면 **`conf.d/`만 바뀌는 변경은 무중단**이다:

```bash
docker compose -f /srv/edge/docker-compose.yml exec caddy \
  caddy reload --config /etc/caddy/Caddyfile
```

`.env`가 함께 바뀔 때만 다시 `up -d`다. 다른 프로젝트가 자기 프래그먼트를 얹을 때도 절차는 같다 —
파일 놓기 → `.env`에 자기 접두사 줄 append → validate → reload.

## 5. 처음부터 재구성 (재해 복구 / 새 환경)

전제: 리포 클론, Cloudflare에 도메인, Supabase 프로젝트(서울 — **리전은 생성 후 변경 불가**,
Data API 불필요하면 끔), GHCR PAT(`read:packages`, classic).

> **origin 루트 파일**: `apps/web/public/robots.txt`·`sitemap.xml`은 앱 소유다(랜딩이 오너 —
> `spec/tech/landing-page.md` §7). 블로그는 그 아래 `/blog/` 서브패스로 올라가므로, 블로그 산출물을
> 스테이징에 복사할 때 **루트의 두 파일을 덮어쓰지 않도록** 한다. 블로그는 자기 `/blog/sitemap.xml`만 낸다.

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
   sudo mkdir -p /srv/edge/conf.d /srv/cosimosi-staging/migrations /srv/cosimosi-prod/migrations
   sudo chown -R ubuntu:ubuntu /srv'
   ```
4. **파일 배치 + .env**: 리포 루트에서
   ```bash
   scp -i ~/.ssh/lightsail-cosimosi.pem docker-compose.prod.yml ubuntu@$IP:/srv/cosimosi-staging/
   scp -i ~/.ssh/lightsail-cosimosi.pem docker-compose.prod.yml ubuntu@$IP:/srv/cosimosi-prod/
   scp -i ~/.ssh/lightsail-cosimosi.pem deploy/edge/docker-compose.yml deploy/edge/Caddyfile ubuntu@$IP:/srv/edge/
   scp -i ~/.ssh/lightsail-cosimosi.pem deploy/edge/conf.d/*.caddy ubuntu@$IP:/srv/edge/conf.d/
   ```
   - `/srv/edge/.env`: `deploy/edge/.env.example` 그대로 —
     `COSIMOSI_API_DOMAIN_PROD=api.cosimosi.haeram.me`, `COSIMOSI_API_DOMAIN_STAGING=api.staging.cosimosi.haeram.me`.
     박스에 다른 프로젝트가 이미 있으면 **덮어쓰지 말고 append**하고, 반영 전에 §4.2의 `caddy validate`를 돌린다.
   - 스택별 `/srv/cosimosi-<env>/.env`: `.env.production.example`을 채워서(§4 키 목록, `chmod 600`).
     DB 문자열은 `~/cosimosi-deploy-secrets.env`에 보관해 두고 source해서 넣는다.
5. **GHCR 로그인**(VPS에서, **sudo 없이**): `echo '<PAT>' | docker login ghcr.io -u hetarho --password-stdin`
6. **배포 키**: `ssh-keygen -t ed25519 -f ~/.ssh/cosimosi-deploy -N "" -C cosimosi-github-actions-deploy`
   → 공개키를 VPS `~/.ssh/authorized_keys`에 추가.
7. **GitHub** (Settings → Secrets and variables → Actions): secrets `SSH_HOST`(Static IP),
   `SSH_USER`(`ubuntu`), `SSH_KEY`(`~/.ssh/cosimosi-deploy` 내용), `DIRECT_DATABASE_URL`(5432), Environment variables
   `API_ORIGIN`/`WEB_ORIGIN`(각각 `production`/`staging`의 기대 origin) → 전부 끝난 뒤 variable
   `DEPLOY_ENABLED=true`.
8. **기동**: 각 스택에서 `docker compose -f docker-compose.prod.yml up -d`, `/srv/edge`에서
   `docker compose up -d`. 이후는 머지가 알아서 배포한다(§2).
9. **Cloudflare Worker**(프론트): 리포 import(이름 `cosimosi` = `wrangler.jsonc`의 name),
   production 브랜치 `main`, build `pnpm build:site`, deploy `npx wrangler deploy`,
   version `npx wrangler versions upload`, 변수 3종(§3) 입력, 커스텀 도메인 `cosimosi.haeram.me` 연결.
10. **Supabase Auth**: Google provider(Client ID/Secret — GCP 리디렉션 URI에
    `https://<ref>.supabase.co/auth/v1/callback`), URL Configuration의 Site URL
    `https://cosimosi.haeram.me` + Redirect URLs 4종 — 콜백은 **origin 루트**로 돌아온다. `/`는 이제
    공개 랜딩이고, 인증된 도착은 랜딩 게이트가 `/universe`로 넘긴다. 즉 URL은 그대로 두고 이유만 바뀐 것:
    `https://cosimosi.haeram.me/` · `http://localhost:1214/` · 프리뷰 와일드카드
    (`https://*-cosimosi.sunlikeperson.workers.dev/`) · 모바일 딥링크 `cosimosi://auth-callback`
    (허용목록에 없는 origin은 Site URL로 폴백해 prod로 떨어진다). OTP 쓰면 이메일 템플릿에 `{{ .Token }}`.

## 6. 롤백

- **백엔드**: VPS `/srv/cosimosi-<env>/.env`의 `IMAGE_TAG=<이전 SHA>`로 바꾸고
  `docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`.
  (GHCR 이미지는 커밋 SHA로 태깅돼 있다.)
- **프론트**: Worker → Deployments → 이전 버전으로 rollback/promote.

## 7. 함정 모음 (한 번씩 실제로 밟은 것들)

- **상주 API는 세션 풀러(5432)로 붙는다 — 트랜잭션 풀러(6543)는 pgx와 함께 쓸 수 없다.**
  풀러 모드별로 pgx가 갈 수 있는 길이 없다:
  - 기본 `cache_statement`는 named prepared statement가 공유 연결에서 충돌해 42P05.
  - `simple_protocol`/`exec`는 타입 정보를 버려 JSONB `[]byte` 파라미터를 bytea로 인코딩 →
    jsonb insert가 22P02(`invalid input syntax for type json`)로 실패.
  - `describe_exec`는 unnamed prepared statement로 **왕복을 두 번** 한다. 트랜잭션 모드 풀러는
    그 사이에 서버 연결을 바꿔치기하므로, 동시 요청이 몰릴 때 한 쿼리의 bind가 다른 쿼리의 parse
    위에 떨어진다 — `unnamed prepared statement does not exist`(26000),
    `bind message has N result formats but query has M columns`(08P01),
    `number of field descriptions must equal number of values`. pgx가 문서에 직접 적어둔 제약이다
    (`QueryExecModeDescribeExec`: _"may cause problems with connection poolers that switch the
    underlying connection between round trips"_).
    2026-07-30 prod에서 RPC의 46%가 이걸로 500이 났다 — 재시도하면 통과하니 로그를 봐야 보인다.

  세션 풀러(5432)는 클라이언트 연결에 서버 연결을 붙여두므로 두 왕복이 같은 연결에 남고,
  `describe_exec`의 타입 인식도 그대로다. 호스트·유저명은 6543과 동일하고 **포트만** 다르다.
  DDL/마이그레이션도 같은 5432(`DIRECT_DATABASE_URL`).

- **Caddy는 한 마리** — 스택마다 띄우면 두 번째가 `Bind for 0.0.0.0:80 failed`.
- **`/srv/edge`는 cosimosi 전용이 아니라 박스 공유물이다** — 설정이 all-or-nothing이라 프래그먼트 하나가
  깨지면 박스의 **모든 프로젝트**가 TLS를 잃는다. 반영 전 `caddy validate`는 선택이 아니다(§4.1·§4.2).
- **`.env`를 바꾼 뒤 `caddy reload`는 안 먹는다** — reload는 기존 프로세스의 env를 그대로 보므로 새 변수가
  안 들어간다. `docker compose up -d`로 재생성해야 한다. 반대로 `conf.d/`만 바뀌면 reload로 무중단(§4.2).
- **GHCR 로그인은 ubuntu 계정으로**(sudo ✕) — 배포가 ubuntu로 pull한다.
- **DNS 회색 구름** — 주황(프록시)이면 Let's Encrypt 발급 실패.
- **goose 공식 Docker 이미지는 없다** — `ghcr.io/kukymbr/goose-docker:3.27.1` 사용(로컬 `scripts/db.mjs`와 동일).
- **Workers Builds 10001 인증 에러** — 빌드 토큰이 죽은 것. Worker → Settings → Build → API token에서 새로 생성.
- **Supabase 무료 티어는 7일 무활동 시 일시정지** — 출시 전 keep-alive(주기적 `SELECT 1`) 필요.
- **Supabase redirect 허용목록에 없는 origin은 Site URL로 폴백** — 프리뷰/로컬에서 로그인하면
  prod로 떨어지는 증상의 원인.
- **백엔드 배포 검증은 staging/prod 공통** — 롤아웃 뒤 Environment variable `API_ORIGIN`의 `/health`와
  독립 기대값 `WEB_ORIGIN`을 사용한 preflight를 검사한다. 런타임 CORS 설정 자체를 기대값으로 재사용하지
  않으므로 잘못된 환경 origin도 실패한다.
- **`view_semantic` 영수증 fingerprint 전환** — stage를 클라이언트 입력에서 제거한 버전을 올릴 때, 배포 전에
  `SELECT count(*) FROM memory_paid_action_receipts WHERE action_kind = 'view_semantic';`로 기존 영수증을 확인한다.
  롤아웃 전에 만들어진 행은 stage 포함 fingerprint라 같은 operation id 재시도 시 `ErrOperationConflict`가 난다.
  조회 결과와 무관하게 먼저 기존 응답에 든 stage로 legacy fingerprint를 검증하고 추가 결제 없이 원래 응답을
  replay하는 호환 릴리스를 **기존 request 계약 그대로** 테스트·배포한다. 모든 구버전 instance를 drain한 뒤 다시
  count하고, 호환 경로가 legacy 행을 처리하는 상태에서만 stage 제거/fingerprint 전환 릴리스를 배포한다. 첫 count가
  0이어도 구버전이 조회 직후 새 영수증을 만들 수 있으므로 이 2단계를 생략하지 않는다. 행을 수정하면 불변 영수증
  계약이 깨지고, 일부든 전체든 삭제하면 idempotency가 사라져 재결제가 생길 수 있으므로 정합화/sweep으로
  우회하지 않는다.
