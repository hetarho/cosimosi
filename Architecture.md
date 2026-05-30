# cosimosi Architecture

이 문서는 cosimosi 프로젝트의 코드 구조와 그 결정 근거를 정리한다.
`spec/concept.md`가 "무엇을 만드는가"라면, 이 문서는 **"어떻게 만드는가"**다.

요지는 두 줄이다.

- **프론트엔드**: [Feature-Sliced Design (FSD)](https://feature-sliced.design/) — 공식 사양 v2 그대로.
- **백엔드**: Go 커뮤니티에서 2025–2026년에 가장 권장되는 **package-by-feature + 헥사고날 규율** 패턴. 풀 Clean Architecture는 이 규모에 과하다는 합의를 따랐다.

---

## 1. 한눈에

```
cosimosi/
├── Architecture.md            ← 이 문서
├── spec/                      ← 기획/비전 문서
├── frontend/                  ← React 19 + Vite 8 + R3F + Zustand (FSD)
│   └── src/
│       ├── app/               ← 진입점·프로바이더·전역 스타일
│       ├── pages/             ← 라우트 단위 화면
│       ├── widgets/           ← 자족적인 큰 UI 블록 (예: 우주 캔버스)
│       ├── features/          ← 사용자 행동/상호작용 (예: 감정 기록)
│       ├── entities/          ← 도메인 객체 (예: 행성, 일기 항목)
│       └── shared/            ← 도메인 무관 공용 (UI 키트, 유틸, 클라이언트)
└── backend/                   ← Go 1.26 + Echo + pgx + sqlc (package-by-feature)
    ├── cmd/api/               ← 컴포지션 루트 (단 하나의 실행 파일)
    └── internal/
        ├── <feature>/         ← entry, (추후 user, share, …)
        ├── platform/          ← config, postgres, s3, httpserver (인프라)
        └── db/                ← sqlc 입력(queries, migrations) + 출력(gen)
```

**의존 방향은 양쪽 모두 한쪽으로만 흐른다.** 프론트는 `app → pages → widgets → features → entities → shared` 순으로 위에서 아래로만, 백엔드는 `handler → service → repository → 도메인`으로 안쪽으로만.

---

## 2. 프론트엔드: Feature-Sliced Design

### 2.1 왜 FSD인가

- **명시적 사양이 있다.** 공식 사이트([feature-sliced.design](https://feature-sliced.design/))가 레이어·임포트 규칙·세그먼트 이름을 못 박아둔다. "그냥 우리 컨벤션"이 아니라 검증 가능한 구조다.
- **R3F·Zustand·feature-rich 단일 페이지 앱과 잘 맞는다.** R3F는 자족적인 큰 UI 블록(`<Canvas>`)을 가지는데, FSD의 `widgets` 레이어가 정확히 그걸 위한 자리다.
- **확장이 선형적이다.** 감정 종류·상호작용·뷰가 늘어나도 새 슬라이스/세그먼트를 더하는 식으로 평탄하게 자란다.

### 2.2 6 레이어 (위 → 아래)

공식 사양의 캐논 레이어다 ([Layers ref](https://feature-sliced.design/docs/reference/layers)).

| 레이어 | 한 줄 정의 | cosimosi 예시 |
|---|---|---|
| **`app`** | 앱을 돌게 하는 모든 것 — 라우팅·진입점·프로바이더·전역 스타일 | `App.tsx`, `styles/index.css` |
| **`pages`** | 라우트 단위의 큰 화면 | `home`, `diary`, `settings` (예정) |
| **`widgets`** | 자족적인 큰 UI 블록, 하나의 use case를 통째로 전달 | `mood-canvas` (R3F `<Canvas>` + 씬 셸) |
| **`features`** | 사용자에게 비즈니스 가치를 주는 행동의 구현 | `record-mood`, `transform-orbit` |
| **`entities`** | 프로젝트가 다루는 도메인 객체 | `planet`, `diary-entry`, `solar-system` |
| **`shared`** | 도메인과 무관한 재사용 | `ui` 키트, `lib`, `api` 클라이언트, `config` |

> **`processes`는 deprecated다.** 공식 사양이 명시적으로 "사용하지 말고 features와 app으로 옮기라"고 말한다 ([Layers ref](https://feature-sliced.design/docs/reference/layers)). 이 프로젝트에서도 쓰지 않는다.

> **모든 레이어를 다 쓸 필요는 없다.** "필요할 때만 추가하라"는 게 공식 가이드. 현재 cosimosi는 `app`·`pages`·`shared`만 채워져 있고, 나머지는 디렉터리만 잡혀 있다 (`.gitkeep`).

### 2.3 임포트 방향 규칙 (가장 중요)

> "A module (file) in a slice can only import other slices when they are located on layers **strictly below**."
> — [공식 Layers 문서](https://feature-sliced.design/docs/reference/layers)

```
app  ──►  pages  ──►  widgets  ──►  features  ──►  entities  ──►  shared
```

- 화살표는 임포트 방향이다. 위에서 아래로만 흐른다.
- 같은 레이어의 다른 슬라이스끼리는 **원칙적으로 임포트 금지** (예외: `entities` 슬라이스 간 `@x` 표기 — 상세는 공식 문서 [Public API](https://feature-sliced.design/docs/reference/public-api) 참고).
- `app`과 `shared`는 슬라이스가 없고 어디서든 참조 가능하다.
- 이 규칙은 ESLint `eslint-plugin-boundaries`나 `@feature-sliced/steiger`로 강제할 수 있다 — 추후 추가 고려.

### 2.4 슬라이스 + 세그먼트

레이어 안은 두 단계로 쪼개진다.

- **슬라이스(slice)** = 프로젝트의 *의미* 단위로 묶은 폴더. cosimosi 도메인 어휘로 이름 짓는다: `planet`, `mood-canvas`, `record-mood`.
- **세그먼트(segment)** = 그 안에서 *기술적 성격*으로 묶은 폴더. 이름은 정해진 것을 쓴다 ([Slices and segments ref](https://feature-sliced.design/docs/reference/slices-segments)):

| 세그먼트 | 용도 |
|---|---|
| `ui` | UI 컴포넌트·포맷터·스타일 |
| `model` | 데이터 모델·스토어·비즈니스 로직 (**Zustand 스토어가 여기**) |
| `api` | 백엔드 호출·요청 타입·매퍼 |
| `lib` | 슬라이스 내부에서만 쓰는 라이브러리 코드 |
| `config` | 설정·피처 플래그 |

**`components/`, `hooks/`, `types/` 같은 일반 이름을 쓰지 말 것** — 공식 가이드가 명시적 안티패턴으로 둔다. 의도가 드러나는 이름만 사용한다.

`app`과 `shared`는 슬라이스가 없고 곧바로 세그먼트로 들어간다.

```
features/
  record-mood/                ← 슬라이스
    ui/MoodForm.tsx           ← 세그먼트
    model/use-record-mood.ts
    api/create-entry.ts
    index.ts                  ← Public API
```

### 2.5 Public API 규칙

슬라이스는 반드시 자신의 `index.ts` 배럴 파일을 통해서만 외부에 노출된다.

- **슬라이스 외부에서**: 무조건 `import { Foo } from '@/features/record-mood'`.
- **슬라이스 내부 파일끼리**: 상대 경로 (`./ui/MoodForm`).
- **슬라이스 내부 파일을 외부에서 직접 임포트하지 않는다** (`@/features/record-mood/ui/MoodForm` 같은 임포트는 금지).
- **와일드카드 배럴 금지**: `export * from './ui/MoodForm'`은 공식 안티패턴 ([Public API ref](https://feature-sliced.design/docs/reference/public-api)). 노출할 심볼만 명시적으로 적는다.

```ts
// features/record-mood/index.ts ✅
export { MoodForm } from './ui/MoodForm'
export { useRecordMood } from './model/use-record-mood'

// 와일드카드 ❌
export * from './ui/MoodForm'
```

### 2.6 파일·폴더 네이밍

공식 사양은 **레이어/세그먼트 어휘만 강제**한다. 슬라이스·파일 이름 자체는 강제하지 않지만, 공식 튜토리얼·블로그가 일관되게 **kebab-case**를 쓴다.

- 슬라이스/폴더: `kebab-case`, **단수**가 기본 (`planet`, not `planets`).
- 파일: `kebab-case` (`mood-form.tsx`, `use-record-mood.ts`).
- React 컴포넌트의 export 이름: `PascalCase` (`MoodForm`). 가능한 한 **named export** 사용.

### 2.7 cosimosi 특화: R3F 컴포넌트는 어디에?

공식 사양에 R3F 가이드는 없다. 다음은 FSD 원칙에서 자연스럽게 도출되는 배치다.

| 무엇 | 어디 | 이유 |
|---|---|---|
| `<Canvas>` 마운트 + 글로벌 씬 셸 (조명·카메라·환경맵·포스트프로세싱) | **widgets**. 예: `widgets/solar-system-canvas/ui/SolarSystemCanvas.tsx` | "자족적인 큰 UI 블록"의 정의에 정확히 부합 |
| 도메인 객체 3D 컴포넌트 (`Planet`, `Sun`, `Orbit`) | **entities**. 예: `entities/planet/ui/Planet.tsx` | 도메인의 시각화. 여러 씬에서 재사용 |
| 3D 상호작용 (행성 가까이 끌어오기, 강도 조절 드래그) | **features**. 예: `features/inspect-planet/` | 사용자가 가치 있는 행동을 한다 |
| R3F 헬퍼 (`useFrameThrottled`, 셰이더 유틸, 수학 함수) | **shared/lib/r3f/** | 도메인 무관 |

cosimosi의 페이지는 보통 widget canvas + 2D HUD widgets로 조립된다:

```
pages/
  home/
    ui/HomePage.tsx           ← <SolarSystemCanvas /> + <ModePicker /> 같은 widget만 배치
    index.ts
widgets/
  solar-system-canvas/
    ui/SolarSystemCanvas.tsx  ← <Canvas> + Lights + EffectComposer
    model/use-camera-mode.ts  ← 태양 view ↔ 3D 자유 view 전환
entities/
  planet/
    ui/Planet.tsx             ← MeshDistortMaterial 단일 행성
    model/planet-types.ts     ← Planet 타입, 강도 → 크기 매핑
    index.ts
features/
  record-mood/
    ui/RecordButton.tsx
    model/use-record-mood.ts
    api/create-entry.ts
    index.ts
```

### 2.8 Zustand 스토어 위치

공식 가이드가 명시적으로 `model` 세그먼트로 못 박는다 ([Slices and segments ref](https://feature-sliced.design/docs/reference/slices-segments) — "stores" 항목).

- 비즈니스 객체에 묶인 상태 (현재 행성 목록, 선택된 행성) → `entities/<entity>/model/<entity>-store.ts`
- 사용자 행동에 묶인 상태 (드래프트 상태, 현재 도구) → `features/<feature>/model/`
- 화면 전용 ephemeral 상태 (다이얼로그 open 플래그) → 컴포넌트 내부 또는 widget의 `model`
- 진짜 글로벌 (테마, 세션) → `app/`

**스토어를 `lib`이나 `api`에 넣지 말 것.** 흔한 안티패턴이다.

### 2.9 쿡북: 새 기능 추가하기

예시로 "감정 기록 기능"을 어떻게 추가할지.

1. 도메인 객체부터 점검: `entities/planet/`에 `Planet` 타입·시각화가 있는지. 없으면 entity 먼저 만든다.
2. 사용자 행동: `features/record-mood/` 슬라이스를 만든다.
   - `ui/MoodForm.tsx` — 입력 폼
   - `model/use-record-mood.ts` — Zustand 또는 로컬 훅
   - `api/create-entry.ts` — 백엔드 `POST /api/entries` 호출
   - `index.ts` — 위 세 가지를 명시적으로 re-export
3. 페이지에서 조립: `pages/home/ui/HomePage.tsx`가 `<MoodForm />`을 마운트.
4. 임포트 방향 점검: `features/record-mood`가 `entities/planet`을 임포트하는 건 OK, 그 반대는 금지.

---

## 3. 백엔드: Package-by-Feature + 헥사고날 규율

### 3.1 왜 풀 Clean Architecture가 아닌가

Go 커뮤니티의 2025–2026년 사실상 합의:

- **Russ Cox(Go 테크리드)** 본인이 `golang-standards/project-layout`을 "Go의 표준이 아니다"라고 [공식적으로 부정](https://github.com/golang-standards/project-layout/issues/117)한다. 공식 [Go 레이아웃 문서](https://go.dev/doc/modules/layout)는 `cmd/`와 `internal/`만 권한다.
- **Three Dots Labs**의 ["Introducing Clean Architecture"](https://threedots.tech/post/introducing-clean-architecture/) — 업계에서 가장 많이 인용되는 Go 아키텍처 글. "우리는 순수 Clean이나 순수 Hex이 아닌 하이브리드를 쓴다"고 명시.
- **Lucas de Ataides (2025)** ["Why Clean Architecture Struggles in Golang"](https://dev.to/lucasdeataides/why-clean-architecture-struggles-in-golang-and-what-works-better-m4g): Uncle Bob식 4-레이어를 Go에 적용하면 보일러플레이트·간접화·테스트 마찰만 늘어난다고 주장.
- **Mews engineering** ["Clean Architecture vs Pragmatic"](https://developers.mews.com/clean-architecture-vs-pragmatic-architecture/): 같은 결론. 작은 서비스에 풀 Clean은 과하다.
- **sqlc 본가 이슈 [#2467](https://github.com/sqlc-dev/sqlc/issues/2467)**: "sqlc가 이미 repository다. 그 위에 또 repository 인터페이스를 손으로 까는 건 안티패턴." 풀 Clean Architecture 적용 시 가장 흔히 비판받는 부분.

**현재 cosimosi 컨텍스트**:
- 단일 개발자, 소~중규모 서비스
- sqlc + Echo + pgx + S3
- AWS App Runner / ECS Fargate에 단일 바이너리 배포
- 기능이 점진적으로 늘어날 예정

이 조건에서 **package-by-feature**가 가장 잘 맞는다. 기능 하나당 패키지 하나(`internal/entry/`, 추후 `internal/share/`, `internal/auth/` …). 헥사고날의 핵심 규율 — **인터페이스는 소비자 측에 선언, 인프라는 가장 바깥**만 가져온다. ardanlabs/service의 축소판이라고 봐도 된다.

### 3.2 디렉터리 레이아웃

```
backend/
├── cmd/
│   └── api/
│       └── main.go            ← 컴포지션 루트. 와이어링은 여기에서만.
├── internal/
│   ├── entry/                 ← 기능 패키지: 일기 항목
│   │   ├── entry.go           ← 도메인 타입 (Entry, Mood, ArtworkSpec)
│   │   ├── repository.go      ← Repository 인터페이스 (소비자 측 선언)
│   │   ├── service.go         ← 비즈니스 로직
│   │   ├── repository_pg.go   ← Postgres 구현 (sqlc gen 사용 예정)
│   │   ├── handler.go         ← Echo HTTP 핸들러
│   │   └── dto.go             ← HTTP 요청/응답 타입
│   ├── platform/              ← 도메인 무관 인프라
│   │   ├── config/            ← env 로딩
│   │   ├── postgres/          ← pgxpool 생성
│   │   ├── s3/                ← S3 클라이언트 생성
│   │   └── httpserver/        ← Echo 인스턴스 + 미들웨어 스택
│   └── db/                    ← sqlc 입출력
│       ├── migrations/        ← 스키마 (.up.sql / .down.sql)
│       ├── queries/           ← sqlc 입력 (.sql 파일)
│       └── gen/               ← sqlc 출력 (생성 코드, 손대지 않음)
├── sqlc.yaml
├── Dockerfile.dev
├── .air.toml
├── go.mod
└── go.sum
```

> `pkg/`는 의도적으로 없다. cosimosi는 외부 임포터가 없는 단일 서비스다. Russ Cox·공식 레이아웃 모두 `pkg/`를 권하지 않는다.

### 3.3 의존 방향 (가장 중요)

```
handler ──► service ──► Repository (interface) ──► repository_pg ──► internal/db/gen (sqlc)
              │
              └─► 도메인 타입 (Entry, Mood) — 무엇도 의존하지 않음
```

- **안쪽으로만**: `handler.go`는 `service.go`를 알지만, 그 반대는 모른다.
- **인터페이스는 소비자 측에 선언**: `Repository`가 `repository.go`(서비스가 쓰는 곳)에 있고, 구현부 `repository_pg.go`에 있지 않다. 이게 [관용적 Go](https://go.dev/wiki/CodeReviewComments#interfaces)다.
- **기능 간 호출은 service ↔ service**: `artwork` 기능이 `entry` 데이터를 필요로 하면, `entry.Service` 인터페이스에 의존한다 — handler ↔ handler, repo ↔ repo 직접 호출 금지.
- **sqlc 생성 코드는 인프라**: 도메인이 `internal/db/gen`을 모른다. `repository_pg.go`만 그걸 임포트해서 row → 도메인 매핑을 한다.

### 3.4 각 관심사는 어디에

| 관심사 | 위치 | 비고 |
|---|---|---|
| HTTP 핸들러 (Echo) | `internal/<feature>/handler.go` | bind → validate → service 호출 → 응답 매핑. ~15–30줄. |
| 도메인 엔티티 | `internal/<feature>/entry.go` | 순수 Go 구조체. JSON 태그·DB 태그 금지. |
| 비즈니스 로직 (use case) | `internal/<feature>/service.go` | `type Service struct { repo Repository }`. |
| Repository 인터페이스 | `internal/<feature>/repository.go` | 소비자(서비스) 측 선언. |
| Repository 구현 (Postgres) | `internal/<feature>/repository_pg.go` | sqlc-gen 호출 + row → 도메인 매핑. |
| sqlc 생성 코드 | `internal/db/gen/` | 사람 손 금지. `repository_pg.go`만 임포트. |
| Postgres 풀 생성 | `internal/platform/postgres/` | `pgxpool.Pool` 반환. |
| S3 클라이언트 생성 | `internal/platform/s3/` | `*s3.Client` 반환. |
| Echo 인스턴스 + 미들웨어 | `internal/platform/httpserver/` | 라우트는 등록하지 않는다. |
| Config 로딩 | `internal/platform/config/` | 한 번, `main.go`에서만 호출. |
| HTTP DTO (요청/응답) | `internal/<feature>/dto.go` | JSON·validator 태그는 여기에만. 도메인 ↔ DTO 매퍼 함수도 여기. |
| 컴포지션 루트 | `cmd/api/main.go` | 설정 로딩 → 인프라 → 각 기능 와이어링 → 서버 시작. 모든 것을 임포트하는 유일한 파일. |

### 3.5 sqlc 통합

sqlc의 역할은 **SQL → 타입 안전한 Go 함수 생성**이다. ORM이 아니다.

흐름:

1. `internal/db/migrations/0001_init.up.sql`이 스키마 정의.
2. `internal/db/queries/entries.sql`이 쿼리 정의 (`-- name: CreateEntry :one`).
3. `sqlc generate`가 실행되면 `internal/db/gen/`에 Go 함수가 생성된다.
4. `internal/entry/repository_pg.go`가 그 함수를 호출해 `gen.Entry` row → `entry.Entry` 도메인 객체로 매핑.

**중요한 분리**: `gen.Entry`는 DB row(`time.Time`, `pgtype.Text` 등)이고 `entry.Entry`는 도메인이다. 둘이 같아 보여도 결합하지 않는다. 도메인이 DB 형태를 모르게 유지하는 게 핵심이다.

**현재 상태**: `sqlc generate`를 아직 한 번도 실행하지 않아서 `internal/db/gen/`이 없다. 그래서 `repository_pg.go`의 메서드들은 모두 `errNotImplemented`를 반환한다. 빌드는 통과한다. 다음 단계에서 sqlc 코드젠을 돌리고 매핑을 채운다.

### 3.6 DTO vs 도메인 — 왜 두 개로 나누는가

도메인 `Entry`:

```go
type Entry struct {
    ID        string
    Date      time.Time
    Mood      Mood
    Note      string
    Artwork   ArtworkSpec
    ThumbKey  string
    CreatedAt time.Time
    UpdatedAt time.Time
}
```

DTO (HTTP shape):

```go
type entryResponse struct {
    ID        string          `json:"id"`
    Date      string          `json:"date"`      // YYYY-MM-DD 문자열
    Mood      Mood            `json:"mood"`
    Note      string          `json:"note"`
    Artwork   json.RawMessage `json:"artwork"`
    ThumbKey  string          `json:"thumbKey,omitempty"`
    CreatedAt time.Time       `json:"createdAt"`
    UpdatedAt time.Time       `json:"updatedAt"`
}
```

차이: JSON 태그·camelCase 키·날짜를 문자열로. 도메인은 이런 걸 모른다. **하나의 인프라(JSON) 형태를 도메인에 새기지 않는다** — DB도, gRPC도, 메시지 큐도 마찬가지 원리.

매퍼는 핸들러에서 호출한다:

```go
func (h *handler) list(c echo.Context) error {
    entries, _ := h.svc.List(c.Request().Context(), 50, 0)
    out := make([]entryResponse, 0, len(entries))
    for _, e := range entries {
        out = append(out, toResponse(e))  // 도메인 → DTO
    }
    return c.JSON(http.StatusOK, out)
}
```

### 3.7 컴포지션 루트 — `cmd/api/main.go`

이 파일은 cosimosi에서 **유일하게** 다른 모든 패키지를 임포트할 자격이 있는 곳이다. 흐름:

```go
config.Load()                     // 1. 설정
postgres.New(ctx, dsn)            // 2. DB 풀
s3.New(ctx, opts)                 // 3. S3 클라이언트
httpserver.New(corsOrigin)        // 4. Echo + 미들웨어
                                  // 5. 기능 와이어링:
entryRepo := entry.NewPgRepository(db)
entrySvc  := entry.NewService(entryRepo)
entry.RegisterRoutes(api, entrySvc)
                                  // 6. 서버 시작 + graceful shutdown
```

새 기능을 추가하면 `main.go`에 세 줄 — repo / service / RegisterRoutes — 만 더 들어간다.

### 3.8 쿡북: 새 기능 추가하기

예를 들어 "감정 공유" 기능을 추가한다고 치자.

1. `internal/share/` 디렉터리 생성.
2. `share/share.go` — 도메인 (`type Share struct { ... }`).
3. `share/repository.go` — 인터페이스 (`type Repository interface { ... }`).
4. `share/service.go` — `type Service struct { repo Repository; entries entry.Service }` (다른 기능에 의존하면 그 *서비스 인터페이스*를 받는다).
5. `share/repository_pg.go` — pgx/sqlc 구현.
6. `share/dto.go` — HTTP request/response.
7. `share/handler.go` — `RegisterRoutes(g *echo.Group, svc *Service)`.
8. SQL이 필요하면 `internal/db/queries/share.sql` 추가 → `sqlc generate`.
9. `cmd/api/main.go`에 세 줄 추가:
   ```go
   shareRepo := share.NewPgRepository(db)
   shareSvc  := share.NewService(shareRepo, entrySvc)
   share.RegisterRoutes(api, shareSvc)
   ```

기존 코드를 건드리지 않는다는 게 핵심이다.

### 3.9 테스트 조직

- **유닛 테스트**: 각 패키지의 `*_test.go`에 동거 (Go 표준). `internal/entry/service_test.go`는 페이크 Repository로 서비스 로직만 검증.
- **통합 테스트**: `repository_pg_test.go`는 [testcontainers-go](https://golang.testcontainers.org/)로 실제 Postgres를 띄워서 검증.
- **E2E**: `e2e/` 또는 `internal/api_test.go`에서 전체 앱을 메모리에 띄워 `httptest`로 호출.
- **목(mock)은 `Repository` 인터페이스 경계에만**. 단일 개발자라면 손으로 쓴 fake가 mockery보다 가볍다.

### 3.10 흔한 함정 (피해야 할 것)

1. **sqlc 위에 또 손으로 Repository 패턴을 까는 것.** sqlc 자체가 이미 repository다. 우리의 `Repository` 인터페이스는 *서비스가 모킹할 수 있도록* 한 겹 두는 것이고, 두 겹의 매핑 코드가 아니다.
2. **인터페이스를 구현부에 선언하는 것.** Go에서는 *소비자*가 인터페이스를 정의한다. cosimosi에서는 `service.go`(소비자)가 있는 폴더의 `repository.go`에 인터페이스를 둔다.
3. **도메인 타입에 `json:` 또는 `db:` 태그.** 인프라 결정이 도메인에 새겨진다. DTO·row 타입은 별도.
4. **`pkg/` 도입.** 외부 임포터가 없으면 필요 없다.
5. **`main.go` 외부에서 글로벌 변수로 의존성을 들고 있는 것.** 모든 의존성은 생성자로 주입한다.
6. **핸들러에 비즈니스 로직.** 핸들러는 ~20줄, 분기·정책은 서비스로.
7. **`artwork_spec`을 `interface{}`로 두는 것.** 3D 씬 계약이 잡히면 도메인에 강타입으로 정의하고 `repository_pg.go`에서 JSON 직렬화만.

### 3.11 언제 이걸 넘어 진화하는가

기능 패키지가 ~10개를 넘거나 두 번째 개발자가 합류하면, 자연스러운 다음 단계는 ardanlabs/service의 3-티어 구조다:

- `app/` — HTTP 어댑터 + DTO
- `business/` — 도메인 + 서비스 + repository 인터페이스
- `foundation/` — 우리의 `internal/platform`에 해당

지금의 패키지들이 그대로 옮겨가는 형태라, 미리 4-레이어 Clean을 깔아두는 것보다 진화 비용이 낮다.

---

## 4. 공통 컨벤션

- **언어**: 한국어 (UI 카피·문서), 영어 (코드·식별자).
- **Git 커밋**: 의미 단위로 작게. 메시지는 한국어/영어 모두 허용.
- **포맷팅**: 프론트는 ESLint, 백엔드는 `gofmt`.
- **시간**: UTC 저장, 표시 시점에 사용자 로컬로 변환.
- **ID**: 백엔드에서 `TEXT` PK (UUID 또는 nanoid). 클라이언트는 ID를 만들지 않는다.

---

## 5. 의도적으로 *지금* 도입하지 않은 것

이 절은 "왜 X가 없냐"는 질문을 미연에 답한다.

| 항목 | 이유 |
|---|---|
| React Router | 현재 단일 페이지. 라우트가 둘 이상 되는 순간 도입. |
| 마이그레이션 도구 (goose/atlas) | 현재는 Postgres 컨테이너 첫 기동 시 `0001_init.up.sql` 마운트. 두 번째 마이그레이션이 필요해지는 시점에 도구 선택. |
| `Repository` 인터페이스 자동 mockery | 현재 기능 한 개. 손으로 쓴 fake가 더 가볍다. |
| OpenAPI 스펙 | 클라이언트가 같은 레포 안이라 SDK 자동생성 이득 작음. 외부 소비자가 생기면 도입. |
| eslint-plugin-boundaries | 단일 개발자 단계에서는 컨벤션으로 충분. CI/팀이 생기면 도입. |
| 인증 | 단일 사용자 MVP. 다중 사용자 단계에서 도입. |

---

## 6. 참고 자료

### FSD
- [Feature-Sliced Design — Overview](https://feature-sliced.design/docs/get-started/overview)
- [Layers reference](https://feature-sliced.design/docs/reference/layers)
- [Slices and segments](https://feature-sliced.design/docs/reference/slices-segments)
- [Public API](https://feature-sliced.design/docs/reference/public-api)
- [Tutorial](https://feature-sliced.design/docs/get-started/tutorial)
- [Naming conventions blog](https://feature-sliced.design/blog/frontend-naming-conventions)

### Go 백엔드 아키텍처
- [Official Go layout doc](https://go.dev/doc/modules/layout)
- [golang-standards/project-layout (and the disclaimer)](https://github.com/golang-standards/project-layout)
- [Russ Cox issue #117 — "this is not a standard Go project layout"](https://github.com/golang-standards/project-layout/issues/117)
- [Three Dots Labs — Introducing Clean Architecture](https://threedots.tech/post/introducing-clean-architecture/)
- [ardanlabs/service (Bill Kennedy)](https://github.com/ardanlabs/service)
- [Lucas de Ataides — Why Clean Architecture Struggles in Golang (2025)](https://dev.to/lucasdeataides/why-clean-architecture-struggles-in-golang-and-what-works-better-m4g)
- [Mews — Clean vs Pragmatic Architecture](https://developers.mews.com/clean-architecture-vs-pragmatic-architecture/)
- [bxcodec/go-clean-arch v4](https://github.com/bxcodec/go-clean-arch)
- [sqlc issue #2467 — sqlc as repository pattern](https://github.com/sqlc-dev/sqlc/issues/2467)
- [Go Code Review Comments — Interfaces](https://go.dev/wiki/CodeReviewComments#interfaces)
