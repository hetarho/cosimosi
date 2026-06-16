# spec/jobs — 구현 작업 문서 (jobs)

> plan(신규)·changes(수정)의 WHAT을 **구현하는 작업 문서**. 시퀀셜 넘버링. `/implement-job NN`이 이걸 보고 구현한다.

## 무엇

job 1개 = `jobs/NN.slug.md`. frontmatter가 출처(신규/변경)를 가리키고, 본문은 **두 체크리스트**:

- **인수 조건**(acceptance) — 출처 스펙(plan/change)의 수용 기준을 복사. 구현 후 *코드에서 참인지 검증*.
- **구현 체크리스트**(implementation) — *어떻게 만드나*. 위→아래로 체크하며 구현.

frontmatter:

```yaml
job: "02"
type: new | change          # 신규 빌드 vs 기존 수정 (implement-job이 이걸로 분기)
source: plan/NN | changes/NN # 이 job이 구현하는 스펙
plan: plan/NN                # 짓거나(new) 고치는(change) plan
status: todo | doing | done
title: ...
```

## 흐름

- **신규:** `/create-plan` → `/create-new-job NN`(`pnpm spec:job plan NN`) → `/implement-job MM`
- **수정:** `/create-change` → `/create-change-job NN`(`pnpm spec:job change NN`) → `/implement-job MM`

`/implement-job`은 frontmatter의 `type`으로 분기하고, 끝나면 바뀐 현실을 SSOT(plan/policy/tech/values)에 반영한다. 변경(`type: change`)은 출처 `changes/` 문서를 `changes/archive/`로 옮긴다.

## 번호

`jobs/NN.slug.md` — job 자체의 시퀀셜 번호(plan/change 번호와 독립). `/implement-job NN`에 이 번호를 넘긴다.

## 동시 작업 (멀티 에이전트)

여러 에이전트가 동시에 일하면 [00.overview](../plan/00.overview.md) §진행 현황에서 claim을 확인·표시한다 — 같은 plan을 두 job이 동시에 건드리지 않게.
