---
name: create-code-review
description: >-
  Run a READ-ONLY code-quality / architecture review and record the findings in spec/code-review/NN.slug.md. Use when
  the user wants an audit, a refactor-opportunity sweep, or a tech-debt report — "review the codebase", "audit the
  frontend for debt", "where can we refactor X", "do a code-quality pass". It scaffolds the next report with
  `pnpm spec:code-review "<title>"`, then fills it with evidence-backed findings (R001…) and candidate jobs. It does
  NOT modify code and does NOT implement — turn selected findings into a job with /cosimosi:create-refactor-job NN.
  All docs are written in English. Do NOT auto-commit.
---

# Create a code-review report (read-only audit → findings)

`spec/code-review/NN.slug.md` is a **read-only** code-quality and architecture review. It records refactor
opportunities only — no code changes here; implementation belongs in `spec/jobs/`. **Write the report in English.**

## Steps

1. **Scope** — agree what's under review with the user: full codebase, a specific app (`apps/web`, `apps/api`,
   `apps/blog`), a module, or the current diff. State it in the report's **Scope** section.
2. **Ground the judgment** — read the architecture rules you'll judge against: FSD layering on the FE, backend
   package boundaries, the SSOT discipline, the state-machine policy, and the **8 invariants** (00.overview
   §불변 원칙). Record the docs/commands consulted in **Grounding** and summarize the rules in **Architecture
   Baseline**. The bar is *evidence-backed*: every finding cites concrete files/lines.
3. **Scaffold + fill** — `pnpm spec:code-review "<title>"` → `spec/code-review/NN.slug.md` (pass an English title;
   the scaffold slugifies it and stamps the date). Fill the **Findings** as `R001`, `R002`, … each with priority
   (P1/P2/P3), area, evidence, why it matters, recommendation, and a suggested job split. Note **Cross-Cutting
   Themes**, open **Questions / Tradeoffs**, and honest **Verification Notes** (what passed/failed/was blocked).
4. **Candidate Jobs** — distill the findings into a list of coherent implementation-job candidates, each a sentence a
   `/cosimosi:create-refactor-job` run can turn into a job.
5. Report the report path + "Next: `/cosimosi:create-refactor-job NN` to turn selected findings into a job". Do NOT
   modify code or commit.

This is the read-only sibling of the diff reviewer `/code-review` — that one reviews the working tree inline; this
one produces a durable, numbered audit doc for planning refactor work.
