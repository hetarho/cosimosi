# cosimosi

**내 일기는 기억의 우주.** 일기를 쓰면 AI가 그 기억을 **별(엔그램)** 로 띄우고, 의미가 닿는 기억끼리 **시냅스(빛의 선)** 로 잇는다. 함께 떠올린 기억은 연결이 굵어지고, 오래 안 떠올린 별은 어두워지되 **사라지지 않는다**(침묵 엔그램). 자신의 기억이 빚은 우주를 탐험하며 삶을 되돌아보는 감성 3D 일기 서비스.

> 신경과학 **엔그램 이론**(헵 가소성·재공고화·침묵 엔그램)을 데이터 구조와 인터랙션 전체에 매핑했다. 자세한 비전은 [spec/concept.md](spec/concept.md).

## 문서 (source of truth)

이 저장소는 **스펙 주도(spec-driven)** 로 개발한다. *무엇을·왜·어떻게·지금 무엇을* 짓는지가 전부 `spec/`에 있다. 읽는 순서: **concept → ubiquitous-language → ARCHITECTURE → plan**.

| 문서 | 내용 |
|---|---|
| [spec/concept.md](spec/concept.md) | **무엇을 / 왜** — 엔그램 우주 비전과 신경과학 가드레일 |
| [spec/ubiquitous-language.md](spec/ubiquitous-language.md) | **용어** — 규범적 용어 목록 |
| [spec/ARCHITECTURE.md](spec/ARCHITECTURE.md) | **어떻게** — 레이어·경계·배치 규칙, 스택 결정 |
| [spec/plan/](spec/plan/) | **지금 무엇을 / 언제** — 번호별 작업 스펙. [00.overview](spec/plan/00.overview.md)가 색인·로드맵 |

## 상태

**플랫폼 재구축 — 토대 단계.** 깨끗한 `apps/{api,web,mobile}` 루트가 각각 "hello world"를 띄우는 빈 무대다. 아직 도메인·전송(RPC)·DB·렌더링은 없다 — [00.overview](spec/plan/00.overview.md)의 순서대로 유닛을 쌓아 올린다.

이전 MVP 코드·스펙은 **git 히스토리에 보존**돼 있다(현재 트리에는 없음 — 클린 재구축이 끝나 참조용 사본은 정리했다).

## 사전 요구

- Node ≥ 22.13, **pnpm 10** (`corepack enable`)
- **Docker Desktop** — 호스트에 Go가 없어도 api를 컨테이너로 돌린다
- (선택) **Go 1.26** — 호스트에서 직접 `go run` 하려면

## 빠른 시작 (개발)

```bash
pnpm install                # 워크스페이스 의존성 (web · mobile · blog · packages)
```

| 앱 | 실행 | 확인 |
|---|---|---|
| 웹 | `pnpm dev:web` | <http://localhost:1214> → `/` 우주 |
| API | `pnpm dev:api` (Docker :8080) <br> 또는 `cd apps/api && go run ./cmd/api` | `/health` → 200 |
| 모바일 | `pnpm dev:mobile` (Metro) 후 `pnpm ios` / `pnpm android` | 시뮬레이터/에뮬레이터에 Universe 화면 |

`pnpm dev` 는 웹 + api(Docker)를 동시에 띄운다.

**로컬 로그인 우회 (dev 전용).** `.env`에 `VITE_DEV_USER_ID`(웹) + `COSIMOSI_DEV_AUTH=1`(api)을
같은 값으로 두면 Supabase 로그인 없이 그 유저로 항상 인증된다 — 웹은 fake 세션을 부트스트랩하고
api의 dev verifier가 `fake-token-<id>` 베어러를 그 유저로 신뢰한다. 두 값을 비우면 실제 Supabase 인증.
프로덕션 빌드엔 절대 켜지 않는다. 그 유저의 우주를 채우려면(작문 플로우는 아직 없음):

```bash
psql "$DATABASE_URL" -f scripts/seed-dev-universe.sql   # dev-user 에 샘플 별/뉴런/시냅스 시드
# 또는 Docker: docker exec -i cosimosi-postgres psql -U cosimosi -d cosimosi < scripts/seed-dev-universe.sql
```

**빌드:** `pnpm build:web` → `apps/web/dist` · `pnpm build:blog` → `apps/blog/dist` ·
`pnpm build:api` → `go build ./...` in `apps/api` (host Go when present, otherwise Docker `golang:1.26`).

## Quality gates

Run the complete local merge gate with:

```bash
pnpm check
```

The root gate is split into composable commands:

| Command | Runs |
|---|---|
| `pnpm lint` | web oxlint + FSD/ESLint boundaries, mobile ESLint, api gofmt cleanliness, ubiquitous-language lint |
| `pnpm typecheck` | web TypeScript, mobile TypeScript, blog Astro build/type generation |
| `pnpm test` | web Vitest, api `go test ./...` |
| `pnpm check:gen` | `pnpm gen`, then fails if generated outputs are dirty |
| `pnpm check:api` | api gofmt, vet, test, and build together |

Backend gates run on host Go when available and fall back to Docker with the same commands. The vocabulary lint reads
`spec/ubiquitous-language.md` and scans only active source roots. Probe commands for deliberate failures:

```bash
pnpm --filter @cosimosi/web lint:boundaries:probe
node scripts/lint-ubiquitous-language.mjs --probe=visual
node scripts/lint-ubiquitous-language.mjs --probe=edge
```

## 디렉터리

```
cosimosi/
├── spec/            ← 기획·아키텍처·작업 스펙 (source of truth)
├── scripts/         ← DX 래퍼 — spec·gen·db (Docker 기반, 셸 무관)
├── proto/           ← .proto 단일 계약 (전송 유닛부터 사용)
├── apps/
│   ├── api/         ← Go — cmd/api (net/http hello world)
│   ├── web/         ← React 19 + Vite + TS (FSD: 현재 app/ 셸만)
│   ├── mobile/      ← React Native + TS (Metro, ios/ + android/)
│   └── blog/        ← Astro 정적 블로그 (콘텐츠: src/blog.md)
└── packages/        ← 공유 패키지 경계 (promote-on-reuse; 빈 패키지 선제 생성 금지)
```

배치 규칙·의존 방향은 [spec/ARCHITECTURE.md](spec/ARCHITECTURE.md).

## 개발 방식 (spec-driven)

1. [spec/plan/00.overview.md](spec/plan/00.overview.md)에서 **선행 의존이 끝난 유닛**을 고른다.
2. 그 `NN.*.md`의 목적·범위·설계·수용 기준을 읽고 job으로 옮겨 구현한다.
3. 작업을 끝낼 때마다 **Conventional Commits** 변형으로 커밋한다:
   `type(planNN - scope): English title`. 커밋 제목은 영어로 쓰고, 본문/코멘트는 한국어로 쓴다.

## 비-목표

공개 소셜 네트워크 ✕ · 감정 분석/조언 도구 ✕ · 차트/통계 대시보드 ✕ · 기억을 박제하는 도구 ✕. cosimosi는 **살아있는 기억의 우주(풍경)** 를 만든다. ([spec/concept.md](spec/concept.md) 비-목표)
