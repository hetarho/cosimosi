---
name: create-refactor-report
description: >-
  Create a read-only refactor and code-quality report in spec/code-review/. Use when the user asks to review the
  whole codebase or a broad area for maintainability, architecture, module boundaries, layering, FSD/backend package
  design, technical debt, or refactor opportunities, especially with phrases like "refactor report", "code quality
  review", "architecture review", "리팩터링 검토", or "유지보수 관점으로 봐줘". It scaffolds the next numbered report with
  `pnpm spec:code-review "title"`, fills evidence-backed findings, and does not edit product code or create jobs.
---

# Create a refactor report

`spec/code-review/NN.slug.md` is a read-only architecture and maintainability report. It is not a bug-fix diff and not
an implementation plan. Its job is to capture evidence, tradeoffs, and candidate job splits so the user can decide what
to turn into work.

## Steps

1. **Stay read-only.** Do not edit product code, generated files, specs, or config while auditing. The only write after
   the audit is the report document itself.
2. **Inventory first.** Run `git status --short --branch`, include untracked files, and list the broad repo layout with
   `rg --files` or targeted directory reads. If the worktree is dirty, review the current working tree as-is and say so.
3. **Load the local architecture rules.** Read the relevant `spec/tech/**`, `spec/policy/**`, `spec/values.yaml`, and
   existing plan/change/job docs needed to judge the area. For broad repo reviews, start with:
   - `spec/tech/architecture.md`
   - `spec/tech/quality-gates.md`
   - `spec/tech/state-machines.md`
   - `spec/plan/00.overview.md`
4. **Inspect by boundary.** Check frontend FSD imports and public APIs, backend feature packages and ports, generated
   contracts, config/value ownership, test boundaries, and documentation drift. Use `rg` first.
5. **Verify cheaply when useful.** Run non-mutating quality checks if they fit the request, such as frontend lint,
   FSD lint, focused tests, `git diff --check`, or backend tests/builds. If local policy or tooling blocks a command,
   record the blocker honestly.
6. **Scaffold the report.** Run `pnpm spec:code-review "short title"` to create `spec/code-review/NN.slug.md`.
7. **Fill the report.** Use exact file paths and line numbers for findings. Separate proven findings from questions or
   tradeoffs. Each finding should include priority, evidence, why it matters, recommendation, and suggested job split.
8. **Report only.** Do not create implementation jobs unless the user explicitly asks for `/create-refactor-job`.

## Report standards

- Prefer maintainability and architecture findings over one-off bug hunting.
- Do not stretch uncertainty into a finding; put it under Questions / Tradeoffs.
- Prefer fewer, better findings with concrete evidence.
- Keep implementation recommendations behavior-preserving unless the user explicitly asks for product behavior changes.
- If a recommendation changes product behavior, route it through `/create-change` instead of a refactor report job.

## Completion

End by reporting:

- the report path
- the number of findings and highest-priority themes
- validation commands run and blockers
- next step: `/create-refactor-job NN` for the selected finding or job bundle
