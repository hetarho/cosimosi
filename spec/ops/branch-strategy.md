# 브랜치 전략 (branch-strategy)

> cosimosi의 git 브랜치·릴리즈 운영 규칙. 도메인(제품) 외적인 운영 규칙이라 `plan/`이 아니라 `ops/`에 둔다. 자동 배포 파이프라인은 [deploy-cicd.md](deploy-cicd.md).

베타 출시부터 **main / develop 2단 + 스펙 작업 브랜치**로 운영한다(deploy-cicd의 develop→스테이징·main→프로덕션 자동 배포 전제와 정합).

| 브랜치 | 역할 | 규칙 |
|---|---|---|
| `main` | **프로덕션** — 베타 사용자가 보는 것 | 직접 push 금지. `develop`→`main` PR(릴리즈) 또는 `hotfix/*` 머지로만 변경. 항상 배포 가능 상태 유지. |
| `develop` | **통합/스테이징** — 작업 합류 지점 | 작업 브랜치의 머지 대상. push 시 스테이징 자동 배포(deploy-cicd). |
| `spec/NN-slug` | **작업 브랜치** — 한 작업 = 한 브랜치 | `develop`에서 분기(예: `spec/28-diary-wayfinding`). 완료 후 `develop`으로 머지. 커밋은 Conventional Commits(영문 제목 / 한글 본문), 의미 단위로 작게. |
| `hotfix/slug` | **프로덕션 긴급 수정** | `main`에서 분기 → `main` 머지 → `develop`에 백머지(둘이 갈라지지 않게). |

```
spec/NN-slug ──PR──► develop ──PR(릴리즈)──► main (프로덕션)
                        ▲                      │
                        └──── 백머지 ◄── hotfix/* ┘
```

- **1인 개발 모드:** 작업 브랜치 → `develop` 머지는 PR 없이 로컬 머지(혼자라 PR 게이트가 과함 — 협업자가 생기면 PR 게이트 복귀). `develop`→`main` 릴리즈 PR은 유지.
- **릴리즈 단위:** 변경이 develop에서 검증되면 `develop`→`main` PR로 베타에 릴리즈. 릴리즈 PR 본문에 포함 범위를 명시한다.
- **충돌 최소화:** 같은 파일을 건드리는 작업은 병렬 브랜치로 띄우지 말고 선행 관계로 직렬화한다.
