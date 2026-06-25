# cosimosi

**내 일기는 기억의 우주.** 일기를 쓰면 AI가 그 기억을 **별(엔그램)** 로 띄우고, 의미가 닿는 기억끼리 **시냅스(빛의 선)** 로 잇는다. 함께 떠올린 기억은 연결이 굵어지고, 오래 안 떠올린 별은 어두워지되 **사라지지 않는다**(침묵 엔그램). 자신의 기억이 빚은 우주를 탐험하며 삶을 되돌아보는 감성 3D 일기 서비스.

> 신경과학 **엔그램 이론**(헵 가소성·재공고화·침묵 엔그램)을 데이터 구조와 인터랙션 전체에 매핑했다. 자세한 비전은 [spec/concept.md](spec/concept.md).

## 문서 (source of truth)

이 저장소는 **스펙 주도(spec-driven)** 로 개발한다. *무엇을·왜·어떻게·지금 무엇을* 짓는지가 전부 `spec/`에 있다.

| 문서 | 내용 |
|---|---|
| [spec/concept.md](spec/concept.md) | **무엇을 / 왜** — 엔그램 우주 비전(별·시냅스·망각·생성 오브젝트·소셜) |
| [spec/tech/architecture.md](spec/tech/architecture.md) | **어떻게** — FSD 프론트 / package-by-feature 백엔드 / 스택 결정·근거 |
| [spec/plan/](spec/plan/) | **지금 무엇을** — 번호별 작업 스펙(체크박스). [00.overview](spec/plan/00.overview.md)가 색인 |

## 상태

- **스펙 확정 · 구현 착수 단계.** 기획·아키텍처·작업 스펙이 `spec/`에 확정돼 있고, 이를 따라 코드 구현을 시작한다.
- MVP는 [spec/plan/](spec/plan/)의 `01`–`13` 스펙을 의존 순서대로 구현한다. 현재 코드베이스는 **초기 스캐폴딩**(최소 `/health` 서버 · placeholder 프론트)이며, 스펙을 따라 진화한다.

## 스택 (확정)

| 레이어 | 선택 | 비고 |
|---|---|---|
| 3D 프론트 | React Three Fiber 9 + three **WebGPURenderer + TSL** (WebGL2 폴백) | force-graph 생태계가 React 1차 + 모바일 재사용. Bloom은 three 노드 |
| 프론트 셸 | Vite 8 + React 19 + TS 6 + Tailwind 4 + Zustand 5 (**FSD**) | |
| API | **Connect RPC + Protobuf** (unary) | `.proto` 단일 계약 → Go·TS·(추후 Dart) 코드젠 |
| 백엔드 | Go 1.26 + connect-go + pgx/v5 + **sqlc** | package-by-feature + 헥사고날 규율 |
| DB | PostgreSQL + **pgvector** | 임베딩 유사도 + 가중치 그래프(`memory_links`) |
| AI | **공급자 추상화**(Embedder/Extractor 포트) | 어떤 LLM·임베딩도 교체 가능. OpenAI 임베딩(키 없이 개발 시 `mock`) |
| 인증·호스팅 | **Supabase**(Auth+PG+pgvector) + **AWS Lightsail**(Go) + **Cloudflare Workers**(웹 정적 자산) | |
| 모바일 | **React Native** (deferred) | 웹과 도메인·셰이더·API 공유. 렌더러 타깃 `react-native-webgpu`+TSL |

스택 선택 근거는 [spec/tech/architecture.md](spec/tech/architecture.md)의 각 절(§2 FSD · §3 렌더링 · §4 백엔드).

## 사전 요구

- Node ≥ 20, **pnpm 10** (`corepack enable`)
- **Docker Desktop** (로컬 인프라)
- ⚠️ **Windows**: 사용자 디렉터리 unsigned `.exe`가 Application Control로 차단됨 → `go`·`sqlc`·`buf`·`protoc`는 **Docker/WSL 안에서** 실행한다(Windows 호스트 직접 실행 금지).

## 빠른 시작 (개발)

```bash
pnpm setup                  # .env 생성 · 의존성 · postgres · 마이그레이션 · 코드젠 (한 번)
pnpm dev                    # 프론트(vite :1214) + 백엔드(docker :8080) 동시
```

- 프론트엔드: <http://localhost:1214>
- 백엔드 헬스: <http://localhost:8080/health>

> `pnpm setup`은 멱등하다 — 계약(`proto`)·스키마 변경을 pull한 뒤 다시 돌리거나, 부분만 필요하면 `pnpm gen`·`pnpm db:migrate`만 따로 돌려도 된다. 안쪽 개발 루프인 `pnpm dev`는 일부러 재생성/마이그레이션을 **안 한다**(빠른 리로드 유지).
> 백엔드는 호스트 Go가 아니라 **Docker 컨테이너 안 air**로 hot-reload 한다(위 Windows 사유). 코드젠(`buf`/`sqlc`)·마이그레이션(`goose`)도 전부 **Docker 일회성 컨테이너**로 돈다 — Node 래퍼([scripts/](scripts/))가 셸(PowerShell/bash) 차이를 흡수한다. 로컬 Postgres는 스펙 [03.data-schema](spec/plan/03.data-schema.md)에서 `pgvector/pgvector:pg16` 이미지로 전환된다.

## 일상 명령어

| 명령 | 동작 |
|---|---|
| `pnpm setup` | 최초/리셋용 부트스트랩(.env·deps·postgres·migrate·gen) |
| `pnpm dev` | 프론트(Vite) + 백엔드(Docker) 동시 |
| `pnpm dev:web` / `pnpm dev:api` | 프론트만 / 백엔드 컨테이너만 |
| `pnpm gen` | 코드젠 전체 — `gen:proto`(buf) / `gen:sql`(sqlc) 개별 |
| `pnpm db:migrate` | goose up — `db:status` / `db:down` / `db:reset` |
| `pnpm infra:up` / `infra:down` | 로컬 인프라 on/off |
| `pnpm build:web` | 프론트 프로덕션 빌드 → `apps/web/dist` |

> 코드젠(`buf`/`sqlc`)·마이그레이션(`goose`)은 전부 Docker로 돌며([scripts/](scripts/) 래퍼), 각 툴 config가 생기기 전(`buf.gen.yaml`=02, `schema.sql`=03)에는 해당 단계를 **친절히 건너뛴다**. 생성 코드(`*/gen/`)는 리포에 커밋한다 — 계약/스키마 변경 시 `pnpm gen` 후 함께 커밋.

## 디렉터리

```
cosimosi/
├── spec/            ← 기획·아키텍처·작업 스펙 (source of truth)
├── scripts/         ← DX 부트스트랩 — setup·gen·db (Docker 래퍼, 셸 무관)
├── proto/           ← .proto 단일 계약 + buf.gen.yaml (모든 클라이언트 공유, 루트 유지)
├── apps/
│   ├── web/src/     ← FSD: app · pages · widgets · features · entities · shared
│   ├── api/         ← Go: cmd/{api,worker} · internal/{memory,link,ai,job,platform,db}
│   ├── blog/        ← Astro 정적 블로그 (spec/blog.md 콘텐츠 원천)
│   └── mobile/      ← 미래 모바일 자리 (placeholder)
└── packages/        ← 공유 패키지 경계 (promote-on-reuse; 빈 패키지 선제 생성 금지)
```

상세 레이아웃·의존 방향은 [spec/tech/architecture.md §1](spec/tech/architecture.md).

## 개발 방식 (spec-driven)

1. [spec/plan/00.overview.md](spec/plan/00.overview.md)에서 **선행 의존이 끝난 스펙**을 고른다. (권장 순서: `03 → 02(+01) → 04 → 05 ‖ (06,07) → 08 → 09 → 10 → 11 → 12 → 13`)
2. 그 `NN.*.md`의 목적·범위·설계·영향 파일·수용 기준·태스크를 읽고 구현한다(cold-start로 완주 가능하게 작성됨).
3. 태스크를 끝낼 때마다 **체크박스(`- [ ]`→`- [x]`)** 를 갱신하고 커밋한다 — Conventional Commits(영문 제목 / 한글 본문).

## 환경 변수 (`.env`)

`.env.example`은 스펙 진행에 따라 갱신된다. 목표 키:

| 키 | 설명 |
|---|---|
| `DATABASE_URL` | Postgres(+pgvector) DSN |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Auth (프론트, 스펙 01) |
| `OPENAI_API_KEY` / `AI_EMBEDDER` | AI 공급자 (`mock`=키 없이 개발 / `openai`=실 임베딩, 스펙 05) |
| `CORS_ORIGIN` | 허용 오리진 (`http://localhost:1214`) |

## 배포 (계획)

웹 = **Cloudflare Workers**(정적 자산), 백엔드(api + worker) = **AWS Lightsail VPS**(서울, Docker Compose), DB·인증 = **Supabase**(서울 — Lightsail과 리전 코로케이션). 실제 프로비저닝은 MVP 안정화 후 — [spec/tech/architecture.md §7](spec/tech/architecture.md), CI/CD는 [spec/ops/deploy-cicd.md](spec/ops/deploy-cicd.md), 운영 절차는 [DEPLOY.md](DEPLOY.md).

## 비-목표

공개 소셜 네트워크 ✕ · 감정 분석/조언 도구 ✕ · 차트/통계 대시보드 ✕ · 기억을 박제하는 도구 ✕. cosimosi는 **살아있는 기억의 우주(풍경)** 를 만든다. ([spec/concept.md](spec/concept.md) 비-목표)
