# cosimosi

**내 일기는 기억의 우주.** 일기를 쓰면 AI가 그 기억을 **별(엔그램)** 로 띄우고, 의미가 닿는 기억끼리 **시냅스(빛의 선)** 로 잇는다. 함께 떠올린 기억은 연결이 굵어지고, 오래 안 떠올린 별은 어두워지되 **사라지지 않는다**(침묵 엔그램). 자신의 기억이 빚은 우주를 탐험하며 삶을 되돌아보는 감성 3D 일기 서비스.

> 신경과학 **엔그램 이론**(헵 가소성·재공고화·침묵 엔그램)을 데이터 구조와 인터랙션 전체에 매핑했다. 제품 정의는 [spec/ssot/PROD.md](spec/ssot/PROD.md), 신경과학 근거는 [spec/ssot/SCI.md](spec/ssot/SCI.md).

## 문서 (source of truth)

이 저장소는 **스펙 주도(spec-driven)** 로 개발한다. 스펙은 [haeram-spec-creator](https://github.com/hetarho/haeram-spec-creator) 구조를 따르고, _지금 유효한 규칙_ 은 전부 `spec/ssot/`에 도메인별 결정으로 있다. 읽는 순서: **PROD → INV → UL → ARCH → 필요한 도메인**.

| 문서                             | 내용                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [spec/STATE.md](spec/STATE.md)   | **지금 어디까지** — 도메인별 SSOT 개정(rev) 현황, 남은 태스크, 다음 할 일                             |
| [spec/FORMAT.md](spec/FORMAT.md) | **표기 규칙** — 결정 ID(`TWINK-4`), 문서 골격, 상태 규칙. 코드의 `[G4]` 같은 옛 규칙 ID 대응표도 여기 |
| [spec/ssot/](spec/ssot/)         | **무엇을 / 왜 / 어떻게** — 도메인별 SSOT. 제품 `PROD`, 불변식 `INV`, 용어 `UL`, 아키텍처 `ARCH` 등    |
| [spec/tasks/](spec/tasks/)       | **남은 일** — 태스크. `tasks/done/`은 완료 이력(옛 plan·job·change 원문 포함, 현재 규칙의 근거 아님)  |
| [spec/review/](spec/review/)     | **코드 리뷰** — 우선순위가 붙은 finding과 채택 여부                                                   |

## 상태

진행 상황·남은 태스크·다음 할 일은 [spec/STATE.md](spec/STATE.md)에 있다.

이전 MVP 코드·스펙은 **git 히스토리에 보존**돼 있다(현재 트리에는 없음 — 클린 재구축이 끝나 참조용 사본은 정리했다).

## 사전 요구

- Node ≥ 22.13, **pnpm 10** (`corepack enable`)
- **Docker Desktop** — 호스트에 Go가 없어도 api를 컨테이너로 돌린다
- (선택) **Go 1.26** — 호스트에서 직접 `go run` 하려면

## 빠른 시작 (개발)

```bash
pnpm install                # 워크스페이스 의존성 (web · mobile · blog · packages)
```

| 앱     | 실행                                                                      | 확인                                  |
| ------ | ------------------------------------------------------------------------- | ------------------------------------- |
| 웹     | `pnpm dev:web`                                                            | <http://localhost:1214> → `/` 우주    |
| API    | `pnpm dev:api` (Docker :8080) <br> 또는 `cd apps/api && go run ./cmd/api` | `/health` → 200                       |
| 모바일 | `pnpm dev:mobile` (Metro) 후 `pnpm ios` / `pnpm android`                  | 시뮬레이터/에뮬레이터에 Universe 화면 |

`pnpm dev` 는 웹 + api(Docker)를 동시에 띄운다.

**로컬 로그인 우회 (dev 전용).** `.env`에 세 값을 두면 Supabase 로그인 없이 한 명의 dev 유저로 항상
인증된다: `COSIMOSI_DEV_AUTH=1`(api 켜기), `COSIMOSI_DEV_USER_ID`(api가 신뢰할 유저), `VITE_DEV_USER_ID`(웹).
뒤 두 값은 **같은 id**여야 한다 — 웹은 그 id로 fake 세션을 부트스트랩해 `fake-token-<id>`를 보내고,
api의 dev verifier는 **오직 그 id의** 베어러만 신뢰한다(임의 유저 사칭 방지). 모바일도 같은
`COSIMOSI_DEV_USER_ID`를 따른다 — 모바일 dev 시작 때 `dev-user.gen.ts`로 자동 생성되므로(기본 `dev-user`)
세 클라이언트가 손수 맞출 필요 없이 한 id로 묶인다. 셋 다 비우면 실제 Supabase 인증.
CI 빌드는 `VITE_DEV_USER_ID`가 있으면 **빌드 타임에** 에러로 막는다(dev-auth 번들은 배포 불가) — 로컬은 `pnpm dev`용으로 그대로 두고 런타임 assert가 백스톱이다.
그 유저의 우주를 채우려면:

```bash
psql "$DATABASE_URL" -f scripts/seed-dev-universe.sql   # dev-user 에 샘플 우주 시드
# 또는 Docker: docker exec -i cosimosi-postgres psql -U cosimosi -d cosimosi < scripts/seed-dev-universe.sql
```

시드는 **우주 시계를 오늘−30일에** 심고 모든 날짜를 `CURRENT_DATE` 기준 상대값으로 넣으므로 시간이
지나도 낡지 않는다. 망각 단계 1–4 · 요지 단계 1–4 · 회고 이력 · 놓아주기 봉인 · 복구 대기 중인 삭제
일기 · 별가루 원장이 모두 들어 있어, 별을 클릭하면 각 상태를 바로 볼 수 있다. **오늘 날짜로 일기 한
편을 쓰면** 시계가 +30 우주일 전진하면서 요지 별 10개가 새로 뜨고, 일부 별의 단어가 한 단계 더
`xxxx`로 지워지고, 전체가 조금 어두워진다(파일 헤더에 무엇이 어떻게 바뀌는지 표로 적혀 있다).
teardown은 `dev-` 접두사 행만 지우므로, **dev 앱에서 손으로 쓴 일기는 재시드해도 보존된다.**

**빌드:** `pnpm build:web` → `apps/web/dist` · `pnpm build:blog` → `apps/blog/dist` ·
`pnpm build:api` → `go build ./...` in `apps/api` (host Go when present, otherwise Docker `golang:1.26`).

## Quality gates

Run the complete local merge gate with:

```bash
pnpm check
```

For task checks, run `pnpm typecheck:affected` and `pnpm test:affected`. They select tracked
changes since `HAERAM_DIFF_BASE` (default `HEAD`) and every dependent workspace package. Override
that base with `--base <commit-or-ref>`; add `--list` to print the JSON selection without running
package checks, for example `pnpm typecheck:affected --base HEAD~1 --list`.

The diff includes committed, staged and unstaged tracked changes; stage new files before relying
on their selection. Shared configuration, generator inputs, proto changes and uncertain ownership
conservatively select every child project. Known documentation, backend-only and guard-only
changes may report an intentional empty TypeScript selection. Their separate Go, generation and
guard checks still apply, and `pnpm check` remains the final gate.

These entrypoints use Git's actual root in ordinary and linked worktrees. The installed pnpm
Git-diff selector can miss linked-worktree changes; direct `pnpm --filter "...[<base>]"` commands
do not receive this project wrapper's correction.

The root gate is split into composable commands:

| Command          | Runs                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm lint`      | web oxlint + FSD/ESLint boundaries, mobile ESLint, api gofmt cleanliness, ubiquitous-language lint |
| `pnpm typecheck` | web TypeScript, mobile TypeScript, blog Astro build/type generation                                |
| `pnpm test`      | web Vitest, api `go test ./...`                                                                    |
| `pnpm check:gen` | `pnpm gen`, then fails if generated outputs are dirty                                              |
| `pnpm check:api` | api gofmt, vet, test, and build together                                                           |

Backend gates run on host Go when available and fall back to Docker with the same commands. The vocabulary lint reads
`spec/ssot/UL.md` (UL-25) and scans only active source roots. Probe commands for deliberate failures:

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

배치 규칙·의존 방향은 [spec/ssot/ARCH.md](spec/ssot/ARCH.md).

## 개발 방식 (spec-driven)

1. **`/start-vibe`** 로 시작한다 — STATE를 읽고 기획(`create-ssot`·`update-ssot`·`create-task`)과 구현(`implement-task`)을 골라 진행한다. 아이디어는 `/ideation`, 화면을 보며 다듬는 일은 `/start-design`.
2. 기획 변경은 SSOT 개정(rev+1, `## chg` 기록)으로 먼저 남기고, 태스크(`spec/tasks/T###`)로 쪼갠 뒤 구현한다.
3. 작업을 끝낼 때마다 **Conventional Commits** 변형으로 커밋한다:
   `type(scope): English title`. 커밋 제목은 영어로 쓰고, 본문/코멘트는 한국어로 쓴다.

## 비-목표

공개 소셜 네트워크 ✕ · 감정 분석/조언 도구 ✕ · 차트/통계 대시보드 ✕ · 기억을 박제하는 도구 ✕. cosimosi는 **살아있는 기억의 우주(풍경)** 를 만든다. ([spec/ssot/PROD.md](spec/ssot/PROD.md) 범위·비-목표)
