# cosimosi MVP 프로토타입 — 구현 플랜

> 이 문서는 **작업 상태 그 자체**다. 다른 컴퓨터에서 `git pull` 후 이 파일을 열어
> 체크박스를 보고 어디까지 됐는지 파악하고 이어서 작업할 수 있도록 작성한다.
>
> **규칙:** 작업 단위를 끝낼 때마다 해당 체크박스를 `- [x]`로 바꾸고 커밋한다.
> 커밋 메시지는 Conventional Commits(영문 제목 / 한글 본문). 체크박스 = 진실의 원천.

- **기획**: [spec/concept.md](spec/concept.md) — "내 마음은 태양계, 감정은 행성"
- **아키텍처**: [Architecture.md](Architecture.md) — 프론트 FSD / 백엔드 package-by-feature
- **시작 커밋**: `5294e30 refactor: adopt FSD frontend and package-by-feature backend`

---

## 0. MVP 범위 (확정)

### 🎯 한 문장
**"감정을 기록하면 → 내 태양계에 행성으로 뜨고 → 태양 View와 3D 자유 View로 둘러본다."** 이 한 바퀴만 완성.

### 포함 / 제외
| ✅ 포함 (MVP) | ❌ 제외 (v1 이후) |
|---|---|
| 감정 기록 (종류·강도·설명·시점) | 시간 변형 / "요즘 상태" 재정렬 |
| 행성으로 시각화 (정적 배치) | 합체·위성·소행성대·충돌 |
| 태양 View ↔ 3D 자유 View 토글 | S3 썸네일 업로드 |
| 기록 목록 fetch & 렌더 | 인증 / 다중 사용자 |
| 하루 여러 감정 허용 | 감정 종류 추가 UI |

### 확정된 설계 결정 (질문 답변 반영)
1. **View 모드**: 태양 View + 3D 자유 View **둘 다**, 버튼 토글. (drei `OrbitControls` 설정만 다르게)
2. **변형 로직**: **미루기**. 행성은 기록값으로 결정되는 **정적 배치**. 시간에 따른 재정렬 없음.
3. **artwork_spec 계산 위치**: **프론트에서 렌더 시 결정론적 계산**. 백엔드 `artwork_spec`은 `{}` 유지, `entries`만 저장.
4. **하루 여러 감정**: 허용. → `entries_entry_date_uniq` 유니크 인덱스 **제거**. (concept "언제든 여러 감정" 근거)

### 핵심 매핑 원칙 (concept §가중치)
- **강도 높음** → 큰 행성 + 가까운 궤도 + 강한 존재감
- **강도 낮음** → 작은 행성 + 먼 궤도 + 희미함
- **감정 종류** → 색·재질·궤도 성격
- > 들인 마음의 무게 = 행성의 질량.

---

## 현재 코드베이스 상태 (작업 시작 전 스냅샷)

**백엔드** (`backend/`)
- 아키텍처 스캐폴딩 완성. 그러나:
- ⚠️ `internal/entry/repository_pg.go` — 모든 메서드가 `errNotImplemented` 반환.
- ⚠️ `internal/db/gen/` 없음 — `sqlc generate` 미실행.
- ⚠️ 라우트는 `GET /entries`만 등록됨 (POST 없음).
- ⚠️ 스키마에 `intensity` 컬럼 없음.

**프론트** (`frontend/`)
- 의존성 설치 완료: `@react-three/fiber@9`, `@react-three/drei@10`, `@react-three/postprocessing@3`, `three@0.184`, `zustand@5`, `tailwindcss@4`, `leva`(dev).
- 화면은 placeholder `HomePage` 하나뿐. `entities/`, `features/`, `widgets/`, `shared/*`는 `.gitkeep`만.
- `@` alias → `frontend/src`. 개발 포트 1214, `/api`·`/health`는 `:8080`으로 프록시.

**인프라** (`docker-compose.yml`)
- postgres(5432, 첫 기동 시 `0001_init.up.sql` 마운트) + minio(9000/9001) + backend(dev 프로파일, air 핫리로드).
- `pnpm dev` = 프론트(vite) + 백엔드(docker) 동시 실행.

---

## 환경 / 사전 준비 체크

- [ ] `pnpm install` (루트) — concurrently 등 설치
- [ ] `cd frontend && pnpm install` — 프론트 의존성
- [ ] Docker Desktop 실행 중인지 확인 (`docker ps`)
- [ ] `.env` 존재 확인 (없으면 `cp .env.example .env`)
- [ ] ⚠️ **Windows 주의**: 사용자 디렉터리 .exe 실행이 Application Control로 차단됨. `sqlc`·`go` 네이티브 바이너리는 **Docker/WSL 안에서** 실행할 것. Windows 호스트에서 직접 실행 금지.

---

## 1단계 — 백엔드: 데이터 경로 살리기 ⬅️ 가장 먼저 (막힌 곳)

> 데이터가 흐르지 않으면 프론트가 mock에 묶인다. 막힌 곳부터 뚫는다.
> 완료 기준: `curl POST /api/entries` → `GET /api/entries` 왕복이 실제 DB로 동작.

### 1.1 스키마: intensity 추가 + 유니크 인덱스 제거
- [ ] [backend/internal/db/migrations/0001_init.up.sql](backend/internal/db/migrations/0001_init.up.sql) 수정:
  - `entries` 테이블에 추가: `intensity INT NOT NULL DEFAULT 5 CHECK (intensity BETWEEN 1 AND 10)`
  - `CREATE UNIQUE INDEX entries_entry_date_uniq ...` 라인 **삭제** (하루 여러 감정 허용)
  - `entries_mood_idx`는 유지, `entries_entry_date_idx` (비유니크) 추가 권장
- [ ] [backend/internal/db/migrations/0001_init.down.sql](backend/internal/db/migrations/0001_init.down.sql)도 일관되게 정리
- [ ] DB 볼륨 재생성 (프로토타입이라 데이터 버려도 됨, 마이그레이션 도구 미도입):
  ```powershell
  docker compose down -v        # postgres_data 볼륨 삭제
  docker compose up -d postgres # 새 스키마로 재기동
  ```
- [ ] 스키마 적용 확인:
  ```powershell
  docker exec -it cosimosi-postgres psql -U cosimosi -d cosimosi -c "\d entries"
  ```

### 1.2 도메인 + 쿼리에 intensity 반영
- [ ] [backend/internal/entry/entry.go](backend/internal/entry/entry.go) `Entry` 구조체에 `Intensity int` 추가 (Date 다음 권장)
- [ ] [backend/internal/db/queries/entries.sql](backend/internal/db/queries/entries.sql):
  - `CreateEntry`: 컬럼 목록·VALUES에 `intensity` 추가 (`$7`)
  - `UpdateEntry`: `intensity = $N` 추가
  - 나머지(`SELECT *`)는 자동 반영됨

### 1.3 sqlc 코드젠 (Docker로 실행)
- [ ] sqlc generate 실행 (Windows 호스트 .exe 금지 → 컨테이너로):
  ```powershell
  docker run --rm -v "${PWD}/backend:/src" -w /src sqlc/sqlc:latest generate
  ```
  (bash이면 `-v "$(pwd)/backend:/src"`)
- [ ] `backend/internal/db/gen/` 생성 확인 (`models.go`, `entries.sql.go`, `querier.go`, `db.go`)
- [ ] ⚠️ `internal/db/gen/`는 **사람 손대지 않음** (Architecture §3.5)

### 1.4 repository_pg.go 실제 구현
- [ ] `go.mod`에 `github.com/google/uuid` 추가 (ID 생성용):
  ```powershell
  docker run --rm -v "${PWD}/backend:/src" -w /src golang:1.26 go get github.com/google/uuid
  ```
- [ ] [backend/internal/entry/repository_pg.go](backend/internal/entry/repository_pg.go) 전면 구현:
  - `errNotImplemented` 제거
  - `gen.New(r.pool)` querier 보관 또는 메서드마다 생성
  - `Create`: `uuid.NewString()`로 ID 생성 → `gen.CreateEntry` 호출 → row→도메인 매핑
  - `GetByDate`/`List`/`Update`/`Delete` 구현
  - `pgx.ErrNoRows` → `ErrNotFound` 변환
  - **매핑 헬퍼** `toDomain(gen.Entry) entry.Entry` 작성 (`pgtype`·`time.Time` → 도메인)
  - `artwork_spec`은 빈 객체(`[]byte("{}")`)로 처리 — 프론트 계산 정책

### 1.5 POST /entries 핸들러
- [ ] [backend/internal/entry/dto.go](backend/internal/entry/dto.go) `createRequest`에 `Intensity int json:"intensity" validate:"required,min=1,max=10"` 추가
- [ ] `entryResponse`에 `Intensity int json:"intensity"` 추가 + `toResponse`에 반영
- [ ] DTO→도메인 매퍼 `(r createRequest) toDomain() (entry.Entry, error)` 작성 (date 파싱: `time.Parse("2006-01-02", r.Date)`)
- [ ] [backend/internal/entry/handler.go](backend/internal/entry/handler.go):
  - `RegisterRoutes`에 `g.POST("/entries", h.create)` 추가
  - `create` 핸들러: bind → validate → `svc.Create` → 201 + `toResponse`
  - (validator가 echo에 안 붙어 있으면 [backend/internal/platform/httpserver/server.go](backend/internal/platform/httpserver/server.go)에 `e.Validator` 설정 — 확인 필요)

### 1.6 빌드 & 왕복 검증
- [ ] 백엔드 빌드 (Docker):
  ```powershell
  docker run --rm -v "${PWD}/backend:/src" -w /src golang:1.26 go build ./...
  ```
- [ ] `pnpm dev:api` (또는 `docker compose --profile dev up backend`)로 기동
- [ ] `/health`가 `db: up` 반환 확인:
  ```powershell
  curl http://localhost:8080/health
  ```
- [ ] 생성 왕복:
  ```powershell
  curl -X POST http://localhost:8080/api/entries -H "Content-Type: application/json" -d '{\"date\":\"2026-05-30\",\"mood\":\"joy\",\"intensity\":8,\"note\":\"test\"}'
  curl http://localhost:8080/api/entries
  ```
- [ ] **커밋**: `feat(backend): persist entries with intensity and POST endpoint`

---

## 2단계 — 프론트: 도메인 & 매핑 (shared + entities)

> FSD 임포트 방향: `shared → entities`. 각 슬라이스는 `index.ts` public API로만 노출.
> 와일드카드 배럴 금지. 파일명 kebab-case, 컴포넌트 export PascalCase + named export.

### 2.1 shared/api — HTTP 클라이언트
- [ ] `frontend/src/shared/api/http.ts` — fetch 래퍼: base URL(`/api` 프록시 사용 → 상대경로 OK), JSON 직렬화, 에러 throw
- [ ] `frontend/src/shared/api/index.ts` — `export { http } from './http'`
- [ ] `.gitkeep` 제거

### 2.2 shared/config — mood 팔레트
> concept §가중치가 가리킨 `store/mood.ts`의 역할. FSD에선 도메인 무관 설정이므로 shared/config.
- [ ] `frontend/src/shared/config/mood.ts` — 5종 감정 팔레트:
  - `calm`(평온), `joy`(기쁨), `storm`(폭풍), `melancholy`(쓸쓸함), `wonder`(경이)
  - 각각: `color`(hex), `emissive`, 재질 성격(예: roughness/metalness), 궤도 성격(예: 공전 속도 계수)
  - `MOODS` 배열 (폼 셀렉트용), `MoodKey` 타입, `MOOD_PALETTE` 레코드
- [ ] `frontend/src/shared/config/index.ts` — 명시적 re-export
- [ ] `.gitkeep` 제거

### 2.3 entities/diary-entry — 도메인 타입 + 스토어 + API
- [ ] `frontend/src/entities/diary-entry/model/types.ts` — `DiaryEntry` 타입(id, date, mood, intensity, note)
- [ ] `frontend/src/entities/diary-entry/model/store.ts` — zustand 스토어: `entries[]`, `setEntries`, `addEntry` (Architecture §2.8: 도메인 상태는 entities/model)
- [ ] `frontend/src/entities/diary-entry/api/entry-api.ts` — `listEntries()`, `createEntry(input)` (shared/api 사용), 응답↔도메인 매퍼
- [ ] `frontend/src/entities/diary-entry/index.ts` — public API (타입·스토어 훅·api 함수)
- [ ] `.gitkeep` 제거

### 2.4 entities/planet — 매핑 함수 + 3D 컴포넌트
- [ ] `frontend/src/entities/planet/model/planet.ts`:
  - `Planet` 타입 (size, orbitRadius, orbitSpeed, phase, color, ...)
  - `entryToPlanet(entry: DiaryEntry): Planet` — **결정론적 매핑**:
    - `size` = f(intensity) (예: 0.3 + intensity*0.12)
    - `orbitRadius` = f(intensity) **역상관** (강할수록 가까이) + mood별 기본 반지름
    - `color`/`emissive` = MOOD_PALETTE[mood]
    - `orbitSpeed` = mood 성격 계수
    - `phase`(초기 각도) = date 해시 → 결정론적 분산 (재현 가능, 랜덤 금지)
- [ ] `frontend/src/entities/planet/ui/Planet.tsx`:
  - R3F mesh (sphere) + `meshStandardMaterial` (color/emissive)
  - `useFrame`으로 공전(궤도 위 각도 진행) + 자전
  - props: `planet: Planet`, `onClick?` (자유 View 상세용)
- [ ] `frontend/src/entities/planet/index.ts` — public API
- [ ] `.gitkeep` 제거 (해당 시)

### 2.5 entities/sun — 중심 태양
- [ ] `frontend/src/entities/sun/ui/Sun.tsx` — 중심 emissive sphere + `pointLight`
- [ ] `frontend/src/entities/sun/index.ts`
- [ ] **커밋**: `feat(frontend): add mood palette, planet mapping and 3D entities`

---

## 3단계 — 프론트: 씬 조립 (widgets)

### 3.1 widgets/solar-system-canvas — R3F Canvas 셸
- [ ] `frontend/src/widgets/solar-system-canvas/model/use-camera-mode.ts`:
  - zustand 또는 로컬: `mode: 'sun' | 'free'`, `toggle()`
- [ ] `frontend/src/widgets/solar-system-canvas/ui/SolarSystemCanvas.tsx`:
  - `<Canvas>` + 배경(검정/짙은 남색) + drei `<Stars>`
  - 조명: ambient(약) + Sun의 pointLight
  - `<Sun />` + diary-entry 스토어 구독 → `entries.map(entryToPlanet)` → `<Planet />` 렌더
  - `<OrbitControls>`:
    - **태양 View**: `enableZoom={false} enablePan={false}` (회전·올려/내려보기만), 카메라 중심 고정
    - **3D 자유 View**: 전체 활성
  - (선택) `@react-three/postprocessing` `<Bloom>` 가볍게 — 성능 보고 결정
- [ ] `frontend/src/widgets/solar-system-canvas/index.ts`
- [ ] `.gitkeep` 제거

### 3.2 widgets/view-mode-toggle — View 전환 HUD
- [ ] `frontend/src/widgets/view-mode-toggle/ui/ViewModeToggle.tsx` — 태양/자유 버튼 (use-camera-mode 공유)
  - ※ camera-mode 상태를 두 widget이 공유해야 하므로 **zustand 스토어로** 두는 게 깔끔 (`widgets/solar-system-canvas/model` 또는 공유 위치). 구현 시 한 곳에 두고 둘이 구독.
- [ ] `index.ts`
- [ ] `.gitkeep` 제거 (해당 시)
- [ ] **커밋**: `feat(frontend): assemble solar-system canvas with dual view modes`

---

## 4단계 — 프론트: 사용자 행동 (features) & 페이지

### 4.1 features/record-mood — 감정 기록
- [ ] `frontend/src/features/record-mood/ui/MoodForm.tsx`:
  - 감정 종류 셀렉트(5종, 팔레트 색 미리보기), 강도 슬라이더(1~10), 설명 textarea(선택), 날짜 input(기본 오늘)
  - 제출 버튼
- [ ] `frontend/src/features/record-mood/api/create-entry.ts` — entities/diary-entry의 createEntry 호출 래핑 (또는 직접 사용)
- [ ] `frontend/src/features/record-mood/model/use-record-mood.ts`:
  - 폼 상태 + 제출 핸들러: `createEntry` → 성공 시 diary-entry 스토어 `addEntry`(낙관적/응답 반영) → 행성 즉시 등장
- [ ] `frontend/src/features/record-mood/index.ts`
- [ ] `.gitkeep` 제거

### 4.2 pages/home — 최종 조립
- [ ] [frontend/src/pages/home/ui/HomePage.tsx](frontend/src/pages/home/ui/HomePage.tsx) 교체:
  - 전체화면 `<SolarSystemCanvas />` (배경)
  - 오버레이 HUD: `<MoodForm />` 패널(접기/펼치기 또는 사이드) + `<ViewModeToggle />`
  - 마운트 시 `listEntries()` → `setEntries` (useEffect)
- [ ] (자유 View) 행성 클릭 → 상세(날짜·강도·설명) 작은 패널 표시 — 시간 남으면. 없으면 v1로.
- [ ] **커밋**: `feat(frontend): record-mood form and home page assembly`

---

## 5단계 — 마무리 & 검증

- [ ] `pnpm dev`로 프론트+백엔드 동시 기동
- [ ] **수동 E2E 시나리오**:
  - [ ] 폼에서 감정 기록 → 행성이 태양계에 즉시 등장
  - [ ] 강도 높은 기록 = 크고 가까운 행성 / 낮은 기록 = 작고 먼 행성 (매핑 체감)
  - [ ] 감정 종류별 색 구분됨
  - [ ] 브라우저 새로고침 → 행성 유지 (DB 영속 확인)
  - [ ] 태양 View: 줌/팬 잠김, 회전만 됨
  - [ ] 자유 View 토글: 자유 이동 됨
  - [ ] 하루에 2개 이상 기록 가능 (유니크 인덱스 제거 확인)
- [ ] `/check-errors` 스킬 실행 (frontend build + ESLint + 백엔드 마이그레이션 검증) 통과
- [ ] FSD 임포트 방향 위반 없는지 점검 (entities가 widgets/features를 import하지 않는지)
- [ ] **커밋**: `chore: MVP prototype manual verification pass`

---

## 의도적으로 미룬 것 (질문 받으면 여기 가리키기)
- 시간 변형 / "요즘 상태" 재정렬 (concept §시간에 따른 변형) — 핵심 아이디어지만 v1.
- 합체·위성·소행성대 — v1.
- S3/MinIO 썸네일 업로드 — 인프라는 떠 있으나 MVP 미사용.
- 인증·다중 사용자 — 단일 사용자 MVP.
- 마이그레이션 도구(goose/atlas) — 2번째 마이그레이션 필요 시점에 도입 (Architecture §5).

---

## 🔄 다른 컴퓨터에서 이어서 작업하는 법 (Resume)

1. `git pull`
2. **이 `plan.md`를 연다.** 마지막 `- [x]` 체크박스가 진행 지점이다.
3. 환경 복구:
   ```powershell
   pnpm install
   cd frontend; pnpm install; cd ..
   docker compose up -d postgres minio   # 인프라
   ```
   - ⚠️ `internal/db/gen/`이 git에 커밋돼 있으면 그대로 사용. **없으면** 1.3의 sqlc generate를 다시 실행.
   - ⚠️ DB는 로컬 볼륨이라 컴퓨터마다 비어 있을 수 있음. 스키마는 첫 기동 시 자동 적용되지만, 1.1에서 스키마를 바꿨다면 `docker compose down -v` 후 재기동 필요.
4. `git log --oneline`으로 마지막 커밋 확인 → 체크박스와 대조.
5. 빌드가 깨지면 1단계 백엔드 / 2단계 프론트 순으로 점검.
6. 작업 재개. 단위 완료 시 체크박스 갱신 + 커밋.

### 상태 확인 빠른 명령
```powershell
git log --oneline -10                          # 최근 커밋
git status                                     # 미커밋 변경
docker ps                                      # 떠 있는 컨테이너
curl http://localhost:8080/health              # 백엔드 살아있는지
```

### 진행도 한눈에
- [ ] 1단계 — 백엔드 데이터 경로
- [ ] 2단계 — 프론트 도메인 & 매핑
- [ ] 3단계 — 씬 조립 (widgets)
- [ ] 4단계 — features & 페이지
- [ ] 5단계 — 마무리 & 검증
