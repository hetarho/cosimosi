---
job: "{{JOB}}"
type: {{TYPE}}
source: {{SOURCE}}
plan: {{PLAN}}
status: todo
title: {{TITLE}}
---

# Job {{JOB}}: {{TITLE}}  ({{TYPE}})

> 구현 작업 문서. 출처 스펙: [{{SOURCE}}](../{{SOURCE}}.md).
> `/implement-job {{JOB}}`이 아래 두 체크리스트로 구현한다. 끝나면 SSOT(plan/policy/values) 반영, status: done.

## 인수 조건 (acceptance — 기획 관점, {{SOURCE}}에서)
<!-- 출처 스펙의 수용 기준. 구현 후 각 항목이 코드에서 참인지 검증한다. -->
- [ ] A1 …

## 구현 체크리스트 (implementation — 구현 관점)
<!-- 어떻게 만드나. 위→아래 순서. [P]=서로 다른 파일·의존 없는 병렬. (gen)/(migrate)/(gen:values) 표시.
     config·튜닝 수치는 코드 하드코딩 금지 — spec/values.yaml에 추가 후 (gen:values)로 생성 상수 import. -->
- [ ] T001 …

## 참고 (grounding)
- 헌법(불변 원칙): [00.overview](../plan/00.overview.md) §불변 원칙
- 건드리는 tech/policy/values: <!-- -->

## 영향 파일 (blast radius)
<!-- 출처 스펙·코드 grep으로 찾은 정확한 경로 — 이 범위 밖은 안 건드린다. -->

## 검증 / DoD
- [ ] 위 **인수 조건** 전 항목이 현재 코드에서 참
- [ ] (type=change면) 기존 plan 수용 기준 회귀 없음
- [ ] 코드젠/마이그레이션/values 적용(해당 시): `pnpm gen` / `pnpm db:migrate` / `pnpm gen:values`
- [ ] FE `--filter @cosimosi/web build`·`lint` / BE `go vet ./... && go build ./...`(Docker) 통과(해당 시)
- [ ] 헌법 sanity: `records`/`memories`/`memory_links` 행 삭제·`records` 본문 UPDATE 없음

## 리뷰
- [ ] `/code-review` 반영(기각은 이유) · 비자명 시 `/codex:review --background`

## 완료 후 — SSOT 반영
- [ ] `plan/`을 새 현실로 갱신 · 영향받은 `policy/**`·`tech/**` · 튜닝 수치는 `spec/values.yaml`(+`pnpm gen:values`)
- [ ] (type=change면) `changes/` 출처 문서를 `changes/archive/`로 이동
- [ ] 00.overview 진행 현황 ✅ · 이 문서 frontmatter `status: done`
