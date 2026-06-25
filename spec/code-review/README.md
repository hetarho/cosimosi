# spec/code-review - refactor reports

> Read-only code-quality and architecture review reports. These documents capture
> refactor opportunities before any implementation job is created.

## What belongs here

`code-review/NN.slug.md` is a numbered report for maintainability, architecture,
module boundaries, duplication, testability, or documentation drift.

Use this directory for broad refactor audits such as:

- full-codebase maintainability reviews
- architecture-boundary checks
- FSD or backend package-boundary audits
- technical-debt inventories that should become implementation jobs later

Do not put bug-fix implementation steps directly in a report. A report explains
the evidence and recommendations; a job in `spec/jobs/` turns selected findings
into buildable checklist work.

## Flow

1. `/cosimosi:create-code-review` -> `pnpm spec:code-review "title"`
2. `/cosimosi:create-refactor-job NN` -> `pnpm spec:job refactor NN "job title"`
3. `/cosimosi:implement-job MM` or an equivalent implementation flow executes the job.

## Numbering

Report numbers are monotonic. The scaffold script scans both this directory and
`archive/` if it exists, so archived reports do not reuse numbers.

## Report shape

A good report is evidence-backed and read-only:

- inventory the branch/worktree and relevant untracked files
- state the architecture baseline used for judgment
- pin findings to file paths and line numbers
- separate confirmed issues from questions or tradeoffs
- recommend job splits without implementing them
