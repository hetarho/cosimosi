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

MVP 코드는 `apps/api-mvp` · `apps/web-mvp`로 보존돼 있다(**참조 전용** — 워크스페이스/CI에서 제외, 새 빌드에 영향 없음).

## 사전 요구

- Node ≥ 20, **pnpm 10** (`corepack enable`)
- **Docker Desktop** — 호스트에 Go가 없어도 api를 컨테이너로 돌린다
- (선택) **Go 1.26** — 호스트에서 직접 `go run` 하려면

## 빠른 시작 (개발)

```bash
pnpm install                # 워크스페이스 의존성 (web · mobile · blog · packages)
```

| 앱 | 실행 | 확인 |
|---|---|---|
| 웹 | `pnpm dev:web` | <http://localhost:5173> → "hello world" |
| API | `pnpm dev:api` (Docker :8080) <br> 또는 `cd apps/api && go run ./cmd/api` | `curl localhost:8080` → `hello world` · `/health` → 200 |
| 모바일 | `pnpm dev:mobile` (Metro) 후 `pnpm ios` / `pnpm android` | 시뮬레이터/에뮬레이터에 "hello world" |

`pnpm dev` 는 웹 + api(Docker)를 동시에 띄운다.

**빌드:** `pnpm build:web` → `apps/web/dist` · `pnpm build:api` → `apps/api/bin/api`(호스트 Go 필요).

## 디렉터리

```
cosimosi/
├── spec/            ← 기획·아키텍처·작업 스펙 (source of truth)
├── scripts/         ← DX 래퍼 — spec·gen·db (Docker 기반, 셸 무관)
├── proto/           ← .proto 단일 계약 (전송 유닛부터 사용)
├── proto-mvp/       ← 이전 MVP 계약 (참조 전용, codegen 제외)
├── apps/
│   ├── api/         ← Go — cmd/api (net/http hello world)
│   ├── web/         ← React 19 + Vite + TS (FSD: 현재 app/ 셸만)
│   ├── mobile/      ← React Native + TS (Metro, ios/ + android/)
│   ├── api-mvp/     ← 이전 MVP api (참조 전용, 빌드 제외)
│   ├── web-mvp/     ← 이전 MVP web (참조 전용, 빌드 제외)
│   └── blog/        ← Astro 정적 블로그 (콘텐츠: src/blog.md)
└── packages/        ← 공유 패키지 경계 (promote-on-reuse; 빈 패키지 선제 생성 금지)
```

배치 규칙·의존 방향은 [spec/ARCHITECTURE.md](spec/ARCHITECTURE.md).

## 개발 방식 (spec-driven)

1. [spec/plan/00.overview.md](spec/plan/00.overview.md)에서 **선행 의존이 끝난 유닛**을 고른다.
2. 그 `NN.*.md`의 목적·범위·설계·수용 기준을 읽고 job으로 옮겨 구현한다.
3. 작업을 끝낼 때마다 **Conventional Commits**(영문 제목 / 한글 본문)로 커밋한다.

## 비-목표

공개 소셜 네트워크 ✕ · 감정 분석/조언 도구 ✕ · 차트/통계 대시보드 ✕ · 기억을 박제하는 도구 ✕. cosimosi는 **살아있는 기억의 우주(풍경)** 를 만든다. ([spec/concept.md](spec/concept.md) 비-목표)
