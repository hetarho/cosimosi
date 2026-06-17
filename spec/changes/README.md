# spec/changes — 변경 제안 (change proposals)

> 이미 구현된 plan의 **동작을 바꿀 때** 쓰는, 사람이 작성하는 변경 단위(WHAT 델타). 시퀀셜 넘버링.

## 무엇

`changes/NN.slug.md` = 한 변경의 **WHAT** — 현재(as-is)→목표(to-be)·범위/비목표·**수용 기준**. frontmatter가 대상 plan을 가리킨다. STEPS(구현 체크리스트)는 여기 두지 않고 **job**(`spec/jobs/`)이 받는다(plan→job과 같은 분리).

## 왜 사람이 쓰나

`/implement-job`이 안전한 건 WHAT이 *사람이 작성·검토한 문서*이기 때문이다 — 자연어 한 줄에서 에이전트가 범위를 지어내지 않는다. `/create-change`가 사용자를 **인터뷰**해 이 문서를 채운다(현재→목표·범위·수용기준).

## 흐름

1. `/create-change` → `pnpm spec:change <planNN> "<title>"` → `changes/NN.slug.md` 생성, 인터뷰로 채움.
2. `/create-change-job NN` → `pnpm spec:job change NN` → `changes/NN`에서 `jobs/MM` 생성(수용 기준 복사 + 델타 구현 체크리스트).
3. `/implement-job MM` → 구현(회귀 없음) → SSOT 반영(plan/policy/values) → 이 `changes/` 문서를 `archive/`로 이동.

## 구조

- `changes/NN.slug.md` — 진행 중 변경 제안.
- `changes/archive/` — 완료된 제안(기록). 완료 시 `/implement-job`이 옮긴다(없으면 생성).

번호는 **`archive/`까지 세어 단조 증가**한다(`pnpm spec:change`가 `live + archive`의 max+1) — 완료 제안을 아카이브해도 번호가 재사용되지 않는다. job frontmatter `source: changes/NN`이 번호로 참조하므로 충돌하면 안 된다.

신규(미구현) 기능은 여기가 아니라 `/create-plan`(plan/).
