---
name: create-change
description: >-
  Author a CHANGE proposal in spec/changes/ by interviewing the user — for modifying an ALREADY-IMPLEMENTED plan.
  Use when the user wants to change/extend/refactor shipped behavior — "테마 개수 제한 없애고 DB로 관리하자",
  "이 기능 이렇게 바꾸자", "기존 NN 동작 수정", "change how X works", "확장/리팩터". It interrogates the user for the
  delta (현재→목표·범위/비목표·수용 기준) — NOT a one-line prompt — scaffolds the next sequential change with
  `pnpm spec:change <planNN> "<title>"`, fills it, and notes affected policy/tech/values. It does NOT implement —
  that's /create-change-job then /implement-job. Do NOT auto-commit.
---

# Create a change proposal (interview → WHAT delta)

`spec/changes/NN.slug.md` is the **human-authored WHAT of a change** to an existing plan — the analogue of a plan,
but a delta. Authoring it by interview (not a one-liner) is the safety gate: the agent must not invent scope.

## Steps

1. **Pin the target plan** — which `spec/plan/NN.*.md` does this change modify? If unclear, find the plan whose
   current behavior the user is describing and confirm in one line.
2. **Interview the delta (꼬치꼬치)** — ask, a few focused questions at a time (AskUserQuestion for real forks),
   until you can write concretely:
   - **현재 (as-is)** — how the touched part works now (from plan/NN + a quick code grep).
   - **목표 (to-be)** — the desired behavior/contract after the change.
   - **범위 / 비목표 (회귀 경계)** — what changes, and what must NOT (the regression boundary).
   - **수용 기준** — testable criteria for the change (become the job's 인수 조건).
   Honor the 8 불변 원칙 — a change never breaks an invariant.
3. **Scaffold + fill** — `pnpm spec:change <planNN> "<title>"` → `spec/changes/NN.slug.md` (frontmatter
   `change`/`plan`/`status`/`title`). **파일명 슬러그는 반드시 영어 kebab-case** (기존 `plan/` 파일과 동일 —
   `diary-wayfinding`, `universe-canvas`). 스캐폴드는 `<title>` 슬러그를 그대로 파일명으로 쓰므로, 영어 제목을 넘겨
   영어 파일을 만든 뒤 frontmatter `title`·H1에 한국어 설명을 채우거나, 한국어 제목으로 만들었다면 생성 직후 영어 슬러그로
   rename한다(`NN.` 번호 접두는 유지). Fill the sections from the interview. Note affected `policy/**`/`tech/**`; **any config/tuning number the change
   adds or tweaks goes in `spec/values.yaml`** (never hardcoded in FE/BE) — list it so the job adds it there.
4. **Register** — in 00.overview 진행 현황, note the in-flight change against plan NN.
5. Report the change path + "다음: `/create-change-job NN`". Do NOT implement or commit.

For a brand-new (unbuilt) feature, use /create-plan instead.
