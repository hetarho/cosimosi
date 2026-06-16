---
name: create-change-job
description: >-
  Generate the implementation job for an existing CHANGE proposal. Use when the user wants to turn a change into a
  buildable work doc — "change NN job 만들어줘", "create-change-job NN", "변경 NN 구현 준비". Reads spec/changes/NN,
  scaffolds the next sequential spec/jobs/MM.slug.md with `pnpm spec:job change NN` (frontmatter type=change,
  source=changes/NN, plan=the modified plan from the change's frontmatter; the change's 수용 기준 are auto-copied
  into 인수 조건), then fills the delta 구현 체크리스트 + 영향 파일. It does NOT implement — that's /implement-job MM.
  Do NOT auto-commit.
---

# Create an implementation job from a change

Same shape as /create-new-job, but the source is a change proposal, so the job is a **delta** and carries a
regression boundary. The job frontmatter records `type: change` and the `plan:` it modifies.

## Steps

1. **Target** — the change number NN (`spec/changes/NN.*.md`). Confirm its ✍️ WHAT (현재→목표·수용 기준) is filled
   (it should be, from /create-change). If it's still a bare template, send the user back to /create-change first.
2. **Scaffold** — `pnpm spec:job change NN` → `spec/jobs/MM.slug.md` with `type: change`, `source: changes/NN`,
   `plan: <modified plan>` (read from the change's frontmatter), and the change's **수용 기준 auto-copied** into 인수 조건.
   **파일명 슬러그는 반드시 영어 kebab-case** — 스캐폴드가 `<title>` 슬러그를 그대로 파일명으로 쓰므로, 한국어 제목으로
   만들어졌으면 생성 직후 영어 슬러그로 rename한다(`MM.` 번호 접두는 유지).
3. **Fill the 구현 체크리스트** — ordered `- [ ] T001 …` for the **delta only** (현재→목표 차이), `[P]`/`(gen)`/
   `(migrate)`/`(gen:values)` flags. **Config/tuning numbers the change adds or tweaks → a `spec/values.yaml` +
   `(gen:values)` task; import the generated constant, no hardcoding.** Fill **영향 파일** by grepping the as-is code (the blast radius). The job's DoD
   already carries "기존 plan 수용 기준 회귀 없음" — keep it.
4. **Register** — in 00.overview 진행 현황, link the change → job MM.
5. Report the job path + "다음: `/implement-job MM`". Do NOT implement or commit.
