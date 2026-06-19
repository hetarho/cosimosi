---
name: create-refactor-job
description: >-
  Generate an implementation job from an existing spec/code-review refactor report. Use when the user wants to turn
  report findings into a buildable job, with phrases like "create-refactor-job NN", "refactor report NN job 만들어줘",
  "R001 job으로 만들어줘", or "이 리팩터링 항목 구현 준비". It reads spec/code-review/NN, asks which finding or coherent
  bundle to implement when unclear, scaffolds `spec/jobs/MM.slug.md` with `pnpm spec:job refactor NN "title"`, fills
  acceptance criteria, implementation checklist, grounding, and blast radius, and does not implement or commit.
---

# Create a refactor job

A refactor job turns a read-only `spec/code-review/NN.slug.md` report into buildable work in `spec/jobs/MM.slug.md`.
The source is evidence from the report, not a new product behavior request. Keep the job behavior-preserving unless the
user explicitly chooses a product behavior change; behavior changes belong in `/create-change`.

## Steps

1. **Target the report.** Find `spec/code-review/NN.*.md` and read it in full. Confirm it is filled, not just a bare
   template.
2. **Choose the job scope.** If the user named findings such as `R001` or a title, use those. If not, pick the smallest
   coherent bundle from the report's Candidate Jobs section. Ask a concise question only if multiple bundles are equally
   plausible and combining them would create a risky job.
3. **Check for behavior change.** If the selected work changes user-facing behavior, data semantics, APIs, or product
   policy, stop and route to `/create-change` instead. Refactor jobs are for structure, maintainability, tests, docs
   hygiene, or behavior-preserving architecture cleanup.
4. **Scaffold.** Run `pnpm spec:job refactor NN "short job title"`. This creates `spec/jobs/MM.slug.md` with
   `type: refactor`, `source: code-review/NN.slug`, `plan: none`, and `status: todo`.
5. **Fill acceptance criteria.** Write checkable `A001...` items that prove the refactor preserved behavior and improved
   the targeted structure. Include regression boundaries from the report.
6. **Fill implementation checklist.** Write ordered `T001...` tasks. Mark `[P]` only when tasks touch unrelated files.
   Add `(gen)`, `(migrate)`, or `(gen:values)` only when the job truly changes contracts, schema, or generated values.
7. **Fill grounding and blast radius.** Copy the relevant report evidence, add exact source files to inspect, and list
   tests or validation commands that should run.
8. **Do not implement.** Stop after the job document is ready.

## Job standards

- One job should be small enough to implement and review in one pass.
- Prefer a series of focused refactor jobs over one broad "clean up everything" job.
- Acceptance criteria must be observable in code, tests, build output, or docs.
- Include a "no product behavior change" criterion unless the job is purely docs-only.
- If a finding is only a question or tradeoff, do not make a job until the user decides.

## Completion

End by reporting:

- the job path
- the source report and selected findings
- the implementation theme
- next step: `/implement-job MM`
