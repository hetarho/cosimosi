---
name: create-new-job
description: >-
  Generate the implementation job for an existing NEW plan. Use when the user wants to turn a plan into a
  buildable work doc — "plan NN job 만들어줘", "create-new-job NN", "12 구현 준비", "plan NN으로 작업 만들어".
  Reads spec/plan/NN, scaffolds the next sequential spec/jobs/MM.slug.md with `pnpm spec:job plan NN` (frontmatter
  type=new, source/plan=plan/NN; the plan's 수용 기준 are auto-copied into the job's 인수 조건), then fills the
  구현 체크리스트 + 영향 파일 from the plan's 설계 요점. It does NOT implement — that's /implement-job MM. Do NOT auto-commit.
---

# Create an implementation job from a plan (new)

A **job** (`spec/jobs/MM.slug.md`) is the buildable work doc: two checklists — **인수 조건** (from the plan, the
WHAT to verify) and **구현 체크리스트** (the STEPS to do). This skill creates it from a plan; it doesn't build it.

## Steps

1. **Target** — the plan number NN (`spec/plan/NN.*.md`). Confirm it exists and is the right one.
2. **Scaffold** — `pnpm spec:job plan NN` → creates `spec/jobs/MM.slug.md` (next job number, independent sequence)
   with frontmatter `type: new`, `source: plan/NN`, `plan: plan/NN`, `status: todo`, and the plan's **수용 기준
   auto-copied** into the 인수 조건 section. **파일명 슬러그는 반드시 영어 kebab-case** — 스캐폴드가 `<title>` 슬러그를
   그대로 파일명으로 쓰므로, 한국어 제목으로 만들어졌으면 생성 직후 영어 슬러그로 rename한다(`MM.` 번호 접두는 유지).
3. **Fill the 구현 체크리스트** — derive ordered `- [ ] T001 …` from the plan's 설계 요점 (the HOW). `[P]` for
   parallel (different files, no dep); flag `(gen)`/`(migrate)`/`(gen:values)` where a contract/schema/tuning number
   moves. **Any config/tuning number the plan calls for → a `spec/values.yaml` + `pnpm gen:values` task; code imports
   the generated constant, never a hardcoded literal.** Fill **영향 파일** (blast radius from the plan) and the 참고
   grounding (tech/policy/values it depends on).
   Don't pad the 인수 조건 — those came from the plan; refine only if the plan's wording isn't checkable.
4. **Register** — in 00.overview 진행 현황, note plan NN now has job MM (still ⬜/🟡 until implemented).
5. Report the job path + "다음: `/implement-job MM`". Do NOT implement or commit.

For a CHANGE to shipped behavior, use /create-change → /create-change-job instead (this skill is for new plans).
