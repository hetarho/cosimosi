# cosimosi

**내 일기는 기억의 우주.** 일기를 쓰면 AI가 그 기억을 **별(엔그램)** 로 띄우고, 의미가 닿는 기억끼리 **시냅스(빛의 선)** 로 잇는다. 함께 떠올린 기억은 연결이 굵어지고, 오래 안 떠올린 별은 어두워지되 **사라지지 않는다**(침묵 엔그램). 자신의 기억이 빚은 우주를 탐험하며 삶을 되돌아보는 감성 3D 일기 서비스.

> 신경과학 **엔그램 이론**(헵 가소성·재공고화·침묵 엔그램)을 데이터 구조와 인터랙션 전체에 매핑했다. 자세한 비전은 [spec/concept.md](spec/concept.md).

## 문서 (source of truth)

이 저장소는 **스펙 주도(spec-driven)** 로 개발한다. *무엇을·왜·어떻게·지금 무엇을* 짓는지가 전부 `spec/`에 있다.

| 문서 | 내용 |
|---|---|
| [spec/concept.md](spec/concept.md) | **무엇을 / 왜** — 엔그램 우주 비전(별·시냅스·망각·생성 오브젝트·소셜) |
| [spec/Architecture.md](spec/Architecture.md) | **어떻게** — FSD 프론트 / package-by-feature 백엔드 / 스택 결정·근거 |
| [spec/plan/](spec/plan/) | **지금 무엇을** — 번호별 작업 스펙(체크박스). [00.overview](spec/plan/00.overview.md)가 색인 |

## 상태

- **2026-06-01 피벗**: 기존 "태양계 / mood-as-art" → **엔그램 우주**로 전환. 기획·아키텍처·작업 스펙은 확정(`spec/`).
- **구현은 진행 예정**: MVP는 [spec/plan/](spec/plan/)의 `01`–`13` 스펙을 의존 순서대로 구현한다. 현재 코드베이스는 **피벗 이전 스캐폴딩**(Echo · `entries` 테이블 · placeholder 프론트)이며, 스펙을 따라 진화한다.

## 스택 (확정)

| 레이어 | 선택 | 비고 |
|---|---|---|
| 3D 프론트 | React Three Fiber 9 + three **WebGPURenderer + TSL** (WebGL2 폴백) | force-graph 생태계가 React 1차 + 모바일 재사용. Bloom은 three 노드 |
| 프론트 셸 | Vite 8 + React 19 + TS 6 + Tailwind 4 + Zustand 5 (**FSD**) | |
| API | **Connect RPC + Protobuf** (unary) | `.proto` 단일 계약 → Go·TS·(추후 Dart) 코드젠 |
| 백엔드 | Go 1.26 + connect-go + pgx/v5 + **sqlc** | package-by-feature + 헥사고날 규율 |
| DB | PostgreSQL + **pgvector** | 임베딩 유사도 + 가중치 그래프(`memory_links`) |
| AI | **공급자 추상화**(Embedder/Extractor 포트) | 어떤 LLM·임베딩도 교체 가능. 기본 OpenAI 임베딩 |
| 인증·호스팅 | **Supabase**(Auth+PG+pgvector) + **Hetzner**(Go) + **Cloudflare Pages**(웹) | |
| 모바일 | **React Native** (deferred) | 웹과 도메인·셰이더·API 공유. 렌더러 타깃 `react-native-webgpu`+TSL |

스택 선택 근거는 [spec/Architecture.md §0](spec/Architecture.md).

## 사전 요구

- Node ≥ 20, **pnpm 10** (`corepack enable`)
- **Docker Desktop** (로컬 인프라)
- ⚠️ **Windows**: 사용자 디렉터리 unsigned `.exe`가 Application Control로 차단됨 → `go`·`sqlc`·`buf`·`protoc`는 **Docker/WSL 안에서** 실행한다(Windows 호스트 직접 실행 금지).

## 빠른 시작 (개발)

```bash
cp .env.example .env        # Windows: copy .env.example .env
pnpm install                # 루트 + frontend 워크스페이스
pnpm dev                    # 프론트(vite :1214) + 백엔드(docker :8080) 동시
```

- 프론트엔드: <http://localhost:1214>
- 백엔드 헬스: <http://localhost:8080/health>

> 백엔드는 호스트 Go가 아니라 **Docker 컨테이너 안 air**로 hot-reload 한다(위 Windows 사유). 로컬 Postgres는 스펙 [03.data-schema](spec/plan/03.data-schema.md)에서 `pgvector/pgvector:pg16` 이미지로 전환된다.

## 일상 명령어

| 명령 | 동작 |
|---|---|
| `pnpm dev` | 프론트(Vite) + 백엔드(Docker) 동시 |
| `pnpm dev:web` / `pnpm dev:api` | 프론트만 / 백엔드 컨테이너만 |
| `pnpm infra:up` / `infra:down` | 로컬 인프라 on/off |
| `pnpm build:web` | 프론트 프로덕션 빌드 → `frontend/dist` |

> 코드젠(`buf generate`, `sqlc generate`)은 스펙 02·03에서 **Docker 명령**으로 추가된다.

## 디렉터리

```
cosimosi/
├── spec/            ← 기획·아키텍처·작업 스펙 (source of truth)
├── proto/           ← .proto 단일 계약 (스펙 02에서 신설)
├── frontend/src/    ← FSD: app · pages · widgets · features · entities · shared
└── backend/         ← Go: cmd/{api,worker} · internal/{memory,link,ai,job,platform,db}
```

상세 레이아웃·의존 방향은 [spec/Architecture.md §1](spec/Architecture.md).

## 개발 방식 (spec-driven)

1. [spec/plan/00.overview.md](spec/plan/00.overview.md)에서 **선행 의존이 끝난 스펙**을 고른다. (권장 순서: `03 → 02(+01) → 04 → 05 ‖ (06,07) → 08 → 09 → 10 → 11 → 12 → 13`)
2. 그 `NN.*.md`의 목적·범위·설계·영향 파일·수용 기준·태스크를 읽고 구현한다(cold-start로 완주 가능하게 작성됨).
3. 태스크를 끝낼 때마다 **체크박스(`- [ ]`→`- [x]`)** 를 갱신하고 커밋한다 — Conventional Commits(영문 제목 / 한글 본문).

## 환경 변수 (`.env`)

`.env.example`은 스펙 진행에 따라 갱신된다. 목표 키:

| 키 | 설명 |
|---|---|
| `DATABASE_URL` | Postgres(+pgvector) DSN |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Supabase Auth (프론트, 스펙 01) |
| `OPENAI_API_KEY` / `AI_EMBEDDER` | AI 공급자 (기본 OpenAI 임베딩, 스펙 05) |
| `CORS_ORIGIN` | 허용 오리진 (`http://localhost:1214`) |

## 배포 (계획)

웹 = **Cloudflare Pages**, 백엔드(api + worker) = **Hetzner VPS**(Docker Compose), DB·인증 = **Supabase**. 실제 프로비저닝은 MVP 안정화 후 — [spec/Architecture.md §6](spec/Architecture.md).

## 비-목표

공개 소셜 네트워크 ✕ · 감정 분석/조언 도구 ✕ · 차트/통계 대시보드 ✕ · 기억을 박제하는 도구 ✕. cosimosi는 **살아있는 기억의 우주(풍경)** 를 만든다. ([spec/concept.md](spec/concept.md) 비-목표)
