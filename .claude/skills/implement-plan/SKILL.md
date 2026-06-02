---
name: implement-plan
description: >-
  Implement a numbered work spec from this repo's spec/plan/ directory end-to-end —
  read the spec, build its tasks top-to-bottom, regenerate code with `pnpm gen` when the
  proto contract changes and apply `pnpm db:migrate` when the DB schema changes, then
  verify (frontend build + lint + the spec's Definition-of-Done) and report completion.
  Use this skill whenever the user asks to implement / build / 구현 a plan or spec in this
  repo — phrasings like "plan 하나 구현해줘", "03 구현해줘", "다음 plan 해줘", "spec 구현",
  "implement spec NN", "이거 마저 구현", or to continue spec-driven work — even when they
  don't name the file. Do NOT auto-commit; leave committing to the user.
---

# Implement a plan (spec-driven)

This repo (cosimosi) is built **spec-driven**: every unit of work is a numbered file in
`spec/plan/NN.*.md`, written so it can be implemented cold-start in one pass. Your job with
this skill is to take one such spec from "not started" to "verified done" — and stop short of
committing, because the user commits themselves.

The whole point of the spec format is that the spec is the source of truth, not your memory.
So the dominant failure mode to avoid is **improvising past the spec** — adding scope it marks
as out-of-scope, skipping its Definition-of-Done, or violating an invariant. Read first, then build.

## Step 0 — Pick the target spec

- If the user named a number ("03", "spec 04", "memory-api") → that's the target.
- If they said "plan 하나 / 다음 plan / continue" with no number → open
  `spec/plan/00.overview.md`, read the **dependency graph**,
  **recommended order**, and **전체 진행도** checklist, pick the lowest-numbered spec whose
  prerequisites (선행) are all done and that isn't done yet, and **confirm it with the user in one
  line** before building ("03 data-schema 들어갈게 — 맞아?").

Then **check 선행**: if the chosen spec's `선행:` specs aren't marked done in 00.overview, surface
that — don't build on an unfinished foundation. Ask whether to proceed or do the prerequisite first.

## Step 1 — Read before you build

Read the target `NN.*.md` in full: 목적 · 범위(**특히 비목표**) · 참고 · 설계 요점 · **영향 파일** ·
수용 기준(EARS) · 작업(Tasks) · 완료 정의(DoD). Then read the grounding it points to:

- The 참고 section's `spec/Architecture.md §N` and `spec/concept.md §N` — these carry the *why* and the
  exact contracts. Implementing without them is how you drift.
- The **8 불변 원칙 (constitution)** at the bottom of 00.overview. These are non-negotiable across every
  spec — e.g. original diary text is immutable, stars/synapses are never row-deleted (decay is brightness
  only), star coordinates emerge client-side, proto=transport / domain=pure / sqlc=persistence, Connect is
  unary-only, shaders are TSL. If a task seems to ask you to break one, re-read — you've likely misread the spec.

The 영향 파일 list tells you exactly which paths the spec may touch — treat it as the blast radius.

## Step 2 — Build the tasks top-to-bottom

Implement tasks in order. `- [ ] TNNN [P] …` — the `[P]` marks tasks that touch different files with no
ordering dependency, so they're safe to batch. Each task names an exact path and action; follow it. Match
the style of surrounding code (see existing files in the same layer).

As you finish each task, flip its checkbox `- [ ] TNNN` → `- [x] TNNN` in the spec file. This is how the
next session knows what's done — stale checkboxes cause re-work.

**Windows toolchain rule (this machine):** unsigned `.exe` in the user dir is blocked by Application Control,
so `go` / `sqlc` / `buf` / `goose` **never run on the host** — always in Docker. The repo's `pnpm` scripts
(`scripts/`) already do this. For ad-hoc Go commands not covered by a script, use Docker too:

```bash
docker run --rm -v ${PWD}/backend:/app -w /app golang:1.26 go build ./...
docker run --rm -v ${PWD}/backend:/app -w /app golang:1.26 go mod tidy
```

## Step 3 — Regenerate / migrate when the contract or schema moves

These are the two changes that ripple beyond the file you edited. Run the matching command — they're the
reason this skill exists. (The wrappers no-op cleanly if a tool's config isn't present yet, so running them
is always safe; for these specs they should do real work — confirm the output isn't a "건너뜀" skip.)

| You changed | Run | Effect |
|---|---|---|
| `proto/**/*.proto` (the RPC contract) | `pnpm gen:proto` | regenerates Go (`backend/internal/gen/...`) + TS (`frontend/src/shared/api/gen/...`) clients → then fix call sites |
| A goose migration in `backend/internal/db/migrations/` (+ sync `backend/internal/db/schema.sql`) | `pnpm db:migrate` | applies the migration to local Postgres |
| The DB schema or sqlc queries in `backend/internal/db/queries/` | `pnpm gen:sql` | regenerates typed query code from `schema.sql` |
| Both proto and schema | `pnpm gen` | runs buf + sqlc together |

`pnpm db:migrate` needs Postgres running — `pnpm infra:up` first if it isn't (or `pnpm setup` for a clean
slate). Generated code is committed in this repo, so after regenerating, leave the new `*/gen/` files in the
working tree for the user to commit (don't delete or gitignore them).

## Step 4 — Verify before you say it's done

"완성" means *verified*, not just "code written". Run, in this order, and only what the spec's scope implies:

1. **Codegen/migration applied** (Step 3) with no errors, and not skipped.
2. **Frontend specs** → `pnpm --filter ./frontend build` and `pnpm --filter ./frontend lint` pass (0 errors).
3. **Backend specs** → `docker run --rm -v ${PWD}/backend:/app -w /app golang:1.26 sh -c "go vet ./... && go build ./..."` passes.
   (The `&&` must run *inside* the container — without `sh -c` it splits at the host shell and `go build` runs outside Docker.)
4. **The spec's own DoD** — its 완료 정의 section lists concrete checks (curl, psql `\d`, build commands,
   grep invariants). Actually run them; that section *is* the acceptance bar.
5. **Constitution sanity** — quick check you didn't introduce a row `DELETE FROM records|memories|memory_links`
   or `UPDATE records` (body), per 불변 원칙 1·2. (Legitimate `weight`/`last_*` updates and goose `Down` DROPs are fine.)

If a check fails, fix it and re-run — don't report done with a known-red check.

## Step 5 — Report completion (and do NOT commit)

When DoD passes, update `spec/plan/00.overview.md`: flip the spec's row
status (⬜ → ✅) in the index table and its line in **전체 진행도**. Then report in this shape:

```
✅ Spec NN — <제목>  완료
- 구현: T001–TNNN 체크박스 갱신
- 코드젠/마이그레이션: <pnpm gen / db:migrate 결과, 또는 "해당 없음">
- 검증: build ✅ · lint ✅ · DoD <항목별 ✅/주의>
- 남은 것/주의: <있으면>
- 커밋: 안 함 — 변경 파일 준비됨. 커밋은 직접 (convention: Conventional Commits, 영문 제목/한글 본문).
```

**Don't run `git commit`.** The user commits. If they ask you to, follow the repo convention (Conventional
Commits — English title, Korean body) and the established practice of committing to `main` directly.

## Quick reference — commands

| 명령 | 동작 |
|---|---|
| `pnpm gen` / `gen:proto` / `gen:sql` | 코드젠 (buf+sqlc / buf만 / sqlc만) — Docker |
| `pnpm db:migrate` / `db:status` / `db:reset` | goose up / status / 리셋(down+up) — Docker, postgres 필요 |
| `pnpm infra:up` / `infra:down` | 로컬 postgres on/off |
| `pnpm --filter ./frontend build` / `lint` | 프론트 검증 |
| `pnpm setup` | fresh/리셋 부트스트랩(.env·deps·postgres·migrate·gen) |
