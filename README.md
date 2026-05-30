# cosimosi

오늘의 기분과 있었던 일을 WebGL 아트워크로 표현해 일기로 모으는 풀스택 앱.

수많은 작은 인터랙티브 아트 컴포넌트들을 조합해 **셀 수 없는 조합**의 아트웍을 만들어 매일 한 장씩 다이어리에 저장한다.

## 스택

| 레이어 | 선택 | 이유 |
|---|---|---|
| WebGL 셸 | **React Three Fiber 9** + drei + postprocessing | "조합 가능한 아트 컴포넌트" 도메인에 정확히 부합. 순수 Three.js·Threlte·TresJS·Babylon 후보 중 생태계·컴포지션 모두 우위 |
| 프론트엔드 셸 | Vite 8 + React 19 + TypeScript 6 + Tailwind v4 + Zustand 5 | 개인 다이어리라 SSR 불필요, HMR/번들이 R3F와 잘 맞음 |
| 백엔드 | **Go 1.26** + Echo v4 + sqlc + pgx/v5 | AWS(App Runner·ECS Fargate)에서 cold start·메모리·이미지 크기 모두 Node 대비 우위. 타입 안전 SQL |
| 스토리지 | PostgreSQL 16 + S3 (로컬: MinIO) | 메타데이터는 PG, 아트워크 스냅샷은 오브젝트 스토어 |
| 인증 | (MVP 없음) | 단일 사용자 출시 후 확장 |

상세 의사결정은 첫 커밋 시점의 기술 검토 참고.

## 사전 요구

- Node ≥ 20, **pnpm 10** (`corepack enable` 또는 `npm i -g pnpm`)
- **Go 1.26+**
- **Docker Desktop** (로컬 인프라용)

OS는 Windows·macOS·Linux 모두 동일하게 동작 — 루트 npm 스크립트는 `concurrently`로 셸 차이를 흡수한다.

## 빠른 시작

```bash
# 1) 환경 변수
cp .env.example .env        # Windows: copy .env.example .env

# 2) 의존성
pnpm install                # 루트 + frontend 워크스페이스

# 3) 개발 서버 (postgres + minio + backend + frontend 한 방에)
pnpm dev
```

열 곳:
- 프론트엔드: <http://localhost:1214>
- 백엔드 헬스: <http://localhost:8080/health>
- MinIO 콘솔: <http://localhost:9001> (`minio` / `minio12345`)

> 첫 기동 시 `backend/migrations/0001_init.up.sql`이 Postgres 컨테이너 `docker-entrypoint-initdb.d`에 자동 마운트돼 마이그레이션이 적용된다. 마이그레이션을 다시 적용하려면 `docker compose down -v` 후 `pnpm dev`.

> **Note (Windows)** — 백엔드는 호스트의 Go가 아니라 **Docker 컨테이너 안에서 air로 hot-reload** 한다. 일부 Windows 보안 정책(Defender Application Control)이 사용자 디렉터리의 unsigned `.exe` 실행을 차단하기 때문. `backend/` 내 `.go` 파일을 수정하면 컨테이너가 자동으로 재빌드한다. macOS/Linux에서도 동일하게 동작한다 — 별도 분기 불필요.

## 일상 명령어

| 명령 | 동작 |
|---|---|
| `pnpm dev` | 프론트(Vite, 포트 1214) + 백엔드(Docker, 포트 8080) 동시 실행 |
| `pnpm dev:web` | 프론트만 |
| `pnpm dev:api` | 백엔드 컨테이너만 (air hot-reload 포함) |
| `pnpm infra:up` / `infra:down` | postgres + minio만 on/off |
| `pnpm build:web` | 프론트엔드 프로덕션 빌드 → `frontend/dist` |
| `pnpm build:api` | Go 단일 바이너리 → `backend/bin/server` (Linux/macOS 호스트용; Windows에선 Docker 이미지로 빌드) |

## 디렉터리

```
cosimosi/
├── frontend/
│   └── src/
│       ├── art/       조합 가능한 WebGL 빌딩 블록 (MoodOrb · DustField · Ribbon …)
│       ├── scene/     빌딩 블록을 조립해 만드는 씬
│       ├── diary/     일기·캘린더 UI
│       ├── store/     Zustand 스토어
│       └── api/       백엔드 클라이언트
└── backend/
    ├── cmd/server/    엔트리포인트
    ├── internal/
    │   ├── api/       Echo 라우터·핸들러
    │   ├── domain/    엔티티 (entry, mood …)
    │   ├── storage/   pgx 풀, S3 클라이언트
    │   └── config/    env 로딩
    ├── db/queries/    sqlc용 SQL
    └── migrations/    마이그레이션
```

**컨벤션:** 새로운 아트 컴포넌트는 `frontend/src/art/`에 prop 기반 단일 파일로 추가하고, `frontend/src/scene/`에서만 조립한다. 아트 컴포넌트는 외부 상태에 직접 의존하지 않고 props로만 색·속도·크기 등을 받아 조합성을 유지한다.

## 환경 변수 (`.env`)

| 키 | 설명 | 기본값 |
|---|---|---|
| `PORT` | 백엔드 포트 | `8080` |
| `DATABASE_URL` | Postgres DSN | docker-compose 값 |
| `CORS_ORIGIN` | 허용 오리진 | `http://localhost:1214` |
| `S3_ENDPOINT` | S3 엔드포인트 (MinIO는 `http://localhost:9000`) | MinIO |
| `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | S3 자격증명 | MinIO 기본값 |
| `S3_USE_PATH_STYLE` | MinIO는 `true`, AWS S3는 `false` | `true` |
| `VITE_API_URL` | 브라우저에서 호출할 API base URL | `http://localhost:8080` |

## 배포 노트

- 백엔드는 **단일 정적 바이너리**(`go build -o bin/server ./cmd/server`)로 컨테이너에 넣어 **AWS App Runner** 또는 **ECS Fargate**에 올리는 것을 권장. Lambda도 가능하나 DB 커넥션 풀과 어울리지 않아 비추.
- 프론트는 `pnpm build:web` 결과를 **S3 + CloudFront** 또는 Amplify Hosting에 정적 배포.
- 프로덕션 S3는 `S3_USE_PATH_STYLE=false` + 도메인 분리, MinIO 자격증명 제거.

## 다음 단계 (로드맵 아이디어)

- [ ] sqlc 코드젠 워이어업 + `/api/entries` CRUD 구현
- [ ] 일기 캘린더 UI
- [ ] 아트 빌딩 블록 추가 (Flowfield · Brushstroke · AudioReactive)
- [ ] 클라이언트 측 아트워크 스냅샷 → S3 업로드
- [ ] 다중 사용자 대비 인증 (Cognito 또는 자체 JWT)
