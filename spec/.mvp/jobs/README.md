# spec/jobs — 구현 작업 문서 (jobs)

> plan(신규)·changes(수정)의 WHAT을 **구현하는 작업 문서**. 시퀀셜 넘버링. `/cosimosi:implement-job NN`이 이걸 보고 구현한다.

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

- **신규:** `/cosimosi:create-plan` → `/cosimosi:create-plan-job NN`(`pnpm spec:job plan NN`) → `/cosimosi:implement-job MM`
- **수정:** `/cosimosi:create-change` → `/cosimosi:create-change-job NN`(`pnpm spec:job change NN`) → `/cosimosi:implement-job MM`

`/cosimosi:implement-job`은 frontmatter의 `type`으로 분기하고, 끝나면 바뀐 현실을 SSOT(plan/policy/tech/values)에 반영한다. 변경(`type: change`)은 출처 `changes/` 문서를 `changes/archive/`로 옮긴다. 그리고 **완료된 job 자체도 `jobs/archive/`로 옮겨** `jobs/`엔 진행 중(todo/doing)만 남긴다(changes와 같은 방식).

## 구조

- `jobs/NN.slug.md` — 진행 중(todo/doing) 작업 문서.
- `jobs/archive/` — 완료된 작업(기록). 완료 시 `/cosimosi:implement-job`이 옮긴다(없으면 생성). 아카이브 문서는 **역사 기록**이라 본문 상대 링크는 stale될 수 있고(깊이 보정 안 함), frontmatter `source`/`plan` 번호만 정확히 유지한다.

## 번호

`jobs/NN.slug.md` — job 자체의 시퀀셜 번호(plan/change 번호와 독립). `/cosimosi:implement-job NN`에 이 번호를 넘긴다. `pnpm spec:job`은 **`archive/`까지 세어 단조 증가**(`live + archive`의 max+1)하므로, 완료 job을 아카이브해도 번호가 재사용되지 않는다 — job 번호는 `/cosimosi:implement-job`·frontmatter가 참조하는 load-bearing 값이라 충돌하면 안 된다.

## 동시 작업 (멀티 에이전트)

여러 에이전트가 동시에 일하면 [00.overview](../plan/00.overview.md) §진행 현황에서 claim을 확인·표시한다 — 같은 plan을 두 job이 동시에 건드리지 않게.
