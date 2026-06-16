---
name: create-plan
description: >-
  Author a NEW feature spec in spec/plan/ by interviewing the user, to the quality bar of the existing
  plan docs. Use when the user wants to plan/design/spec a new feature or capability — "새 기능 기획",
  "plan 만들어줘 / 추가해줘", "X 기능 설계하자", "create a plan/spec for X", "기획 문서 써줘". This skill
  interrogates the user (목적·범위/비목표·설계 요점·수용 기준), scaffolds the next sequential plan with
  `pnpm spec:plan "<title>"`, fills it, ALSO creates/updates the policy/ux docs and notes the spec/values.yaml
  numbers the feature needs, and registers it in 00.overview (status ⬜ 기획). It does NOT implement — that's
  /create-new-job then /implement-job. Do NOT auto-commit.
---

# Create a plan (interview → spec doc)

`plan/NN.*.md` is the **as-built SSOT** — the human-authored WHAT that makes implementation safe. Your job is to
turn a fuzzy request into a complete, reviewable plan at the quality of the existing docs (read one, e.g.
[plan/21](../../../spec/plan/21.memory-fragmentation.md) or [plan/30](../../../spec/plan/30.personalization.md), for the bar).

## Step 1 — Interview (꼬치꼬치)

Don't guess the spec — extract it. Ask the user, a few focused questions at a time (use AskUserQuestion for real
forks), until you can write each section concretely:

- **목적** — why this feature; the user/product problem.
- **범위 / 비목표** — what's in, and what's explicitly out (비목표 prevents scope creep).
- **설계 요점** — how it works: key decisions, RPC/proto contract, data model, state machines, render approach.
  Surface choices as questions when there's a real fork (e.g. "좌표는 서버 권위 vs 클라 창발?").
- **수용 기준** — the testable criteria that make it "true" (these become the job's 인수 조건).
- **영향 파일 / 정책·값 영향** — which paths, and which policy rules / values.yaml numbers it sets or changes.

Honor the **8 불변 원칙** (00.overview §불변 원칙) — if the request would break one (e.g. delete stars, mutate
original diary, server-side coords), flag it and resolve with the user before writing.

## Step 2 — Scaffold + fill

- `pnpm spec:plan "<title>"` → creates `spec/plan/NN.slug.md` (next number, stable-ID — never reuse/renumber).
- Fill every section from the interview, concretely enough to re-implement on another client (e.g. Flutter).
- Leave it as a plan (no checkboxes / no implementation) — implementation is a separate job.

## Step 3 — policy / ux / values it needs

A feature usually implies canonical rules or numbers. As part of creating the plan:

- **policy/** — create or update the domain/ux doc(s) the feature's rules belong to (e.g. `policy/domain/<x>.md`).
  policy describes *current truth*, so write the rule as "will be true once implemented" in the plan's **정책 영향**
  section now; the rule lands in policy/ when the job completes (see /implement-job Step 6). Don't pre-write unbuilt
  rules into policy as if shipped.
- **spec/values.yaml — ALL config goes here.** Any setting/tuning number the feature introduces or changes
  (thresholds, coefficients, caps, defaults, …) is config: enumerate it in **정책 영향**. Rule: config is **never
  hardcoded in FE/BE** — it lives once in `spec/values.yaml` and is generated to TS/Go constants via `pnpm gen:values`
  at implementation. (Excluded: formulas, array *content* like theme CSS / mood color tables, and proto/DB schema —
  those stay in code/proto/sqlc; array *lengths* are derived, not declared.)

## Step 4 — Register in 00.overview

Add the plan to the **plan 색인** and the **진행 현황** board with status **⬜ 기획** (so other agents see it exists,
unbuilt). Add it to the dependency graph if it has 선행. Then report: the plan path, what policy/ux you touched, and
"다음: `/create-new-job NN`으로 구현 job 생성". Do NOT implement or commit.
