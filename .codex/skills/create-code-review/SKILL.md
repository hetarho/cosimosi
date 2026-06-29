---
name: create-code-review
description: >-
  Run a READ-ONLY code-quality / architecture review and record the findings in spec/code-review/NN.slug.md. Use when
  the user wants an audit, a refactor-opportunity sweep, or a tech-debt report — "review the codebase", "audit the
  frontend for debt", "where can we refactor X", "do a code-quality pass". It scaffolds the next report with
  `pnpm spec:code-review "<title>"`, then fills it with evidence-backed findings (R001…) and candidate jobs. It does
  NOT modify code and does NOT implement — turn selected findings into a job with /create-refactor-job NN.
  All docs are written in English. Do NOT auto-commit.
---

# Create a code-review report (read-only audit → findings)

`spec/code-review/NN.slug.md` is a **read-only** code-quality and architecture review. It records refactor
opportunities only — no code changes here; implementation belongs in `spec/jobs/`. **Write the report in English.**

A good review is **two passes merged into one report** (this is what catches what per-job verification misses):

1. **Readiness / process pass** — *run the gates, don't just read them.* Toolchain parity, full-gate execution, CI
   parity, and enforcement-vs-documentation drift.
2. **Runtime-correctness pass** — a *multi-angle adversarial sweep* over the diff, then a verification pass that
   stamps each candidate CONFIRMED / PLAUSIBLE / REFUTED with a quoted line.

The bar is *evidence-backed*: every finding cites concrete `file:line`. Tests passing is **not** proof — a green test
can mask a bug (a fake that accidentally conforms); a missing test proves nothing.

## Steps

1. **Scope** — agree what's under review with the user: full codebase, a specific app (`apps/web`, `apps/api`,
   `apps/blog`, `apps/mobile`), a module, or a diff (e.g. a finished phase: `git diff main...HEAD`, hand-written source
   only — exclude generated code, native scaffolding, and deletions). State it in the report's **Scope** section.

2. **Ground the judgment** — read the rules you'll judge against and record them in **Grounding** + **Architecture
   Baseline**: FSD layering on the FE, backend domain-first package boundaries, SSOT discipline, the state-machine
   policy, the i18n/observability/config-values seams, and the constitution. The constitution is owned by `concept.md`
   §9–10 and `ARCHITECTURE.md` §4 (the overview references them rather than restating a literal "8 invariants"
   section) — use those as the active invariant source.

3. **Pass A — Readiness / process (execute, don't assume).** This is the cluster per-job work always misses, so do it
   first and report it honestly in **Verification Notes**:
   - **Toolchain parity** — confirm the local runtime matches the declared `engines` (Node, pnpm) *before* trusting any
     result. A mismatch (e.g. running under Node 18 when the repo requires 22.13) is itself a **P-finding**, not just a
     "blocked" note — it means the suites that catch the runtime bugs never ran. Look for an executable pin
     (`.node-version` / `.tool-versions` / `mise.toml`); its absence is a finding.
   - **Run the full gate** — actually execute `pnpm lint`, `pnpm typecheck`, `pnpm test:*`, builds, `pnpm check`. A red
     baseline is a **P1 finding**, not a footnote. Record exactly what PASSED / FAILED / was BLOCKED and why.
   - **CI parity** — diff `.github/workflows/*` against the root gate scripts in `package.json`. *Every* local gate
     must have a CI counterpart (package tests/typechecks, mobile smoke test, observability/raw-string/boundary lints,
     generated-freshness). Each hole is a finding: "CI can pass while X breaks."
   - **Enforcement vs documentation** — for every rule the SSOT *claims* is enforced (FSD boundaries, observability
     import boundary, raw-string lint, per-user persistence isolation), confirm an **executable guard exists** *and* a
     probe proves a violation actually fails. Documented-but-unenforced, or a guard whose allowlist/path has drifted
     from where files actually live, is a finding.

4. **Pass B — Runtime correctness (adversarial diff sweep).** Read + reason over the diff and its enclosing functions
   from independent angles, then verify each candidate (CONFIRMED / PLAUSIBLE / REFUTED, with a quoted line). Record
   **REFUTED** candidates too so they aren't re-raised. Apply these lenses (each one caught a real Phase 1 bug — run
   them every time):
   - **Async / lifecycle races** — events arriving during bootstrap/init, optimistic local state mutated before an
     `await` with no rollback on failure, expiry/refresh windows, provider dispose / re-init (StrictMode remount,
     re-init without closing the prior client).
   - **Degraded / partial-config & error branches** — missing-field *combinations* (one env var set, its pair unset),
     fatal-vs-non-fatal choices at boot, fall-through, unreachable `?? fallback` operands behind an earlier guard.
   - **Seam-without-consumer & masking tests** — set/get key-resolution asymmetry, a fake/test that accidentally
     conforms to the bug and stays green, scaffolding with no production caller, props/exports nothing passes.
   - **Cross-platform divergence** — compare duplicated glue (web ↔ mobile, and any copy) *side by side*. Copies that
     drifted or made opposite (and partly wrong) choices, and platform-pure glue that should be promoted to
     `packages/*` per promote-on-reuse, are findings.
   - **Rebuild / MVP residue** — denylists, config, fixtures, or comments referencing a deleted domain or carried over
     from the old codebase (speculative config for types nothing emits).
   - **Config-seam drift** — hardcoded numeric tuning (TTLs, intervals, limits) that should flow through
     `spec/values.yaml` → `pnpm gen:values` instead of living as code consts.
   - **Hot-path efficiency in shared `packages/*`** — `O(n)` lookups where an `O(1)` map already exists, allocations on
     every render/snapshot. Cheap to fix now, called by every future feature.
   - **Convention / hygiene** — render-phase external-store writes, test teardown not in `afterEach`/`try-finally`
     (leaks on assertion failure), comments recording plan/ticket/phase numbers (violates
     `spec/principle/code-comments.md`), comments that contradict the code.
   - **Latent footguns** — env-var name collisions across keys differing only by separator, consent/flag gates that
     would swallow a future kill-switch.

5. **Scaffold + fill** — `pnpm spec:code-review "<title>"` → `spec/code-review/NN.slug.md` (English title; the scaffold
   slugifies it and stamps the date). Fill **Findings** as `R001`, `R002`, … each with priority (P1/P2/P3), area,
   evidence (`file:line`), why it matters, recommendation, and a suggested job split. Add **Cross-Cutting Themes**
   (name the *root cause*, e.g. "gate ran in a degraded env", "two copies diverged"), open **Questions / Tradeoffs**,
   and honest **Verification Notes** (what PASSED / FAILED / BLOCKED, plus the REFUTED candidates and the docs they
   were checked against).

6. **Candidate Jobs** — distill the findings into coherent implementation-job candidates (cluster related findings:
   e.g. all auth-lifecycle fixes as one job, all cleanup as one). Each a sentence `/create-refactor-job` can turn into
   a job.

7. Report the report path + "Next: `/create-refactor-job NN` to turn selected findings into a job". Do NOT modify code
   or commit.

This is the read-only sibling of the diff reviewer `/code-review` — that one reviews the working tree inline; this one
produces a durable, numbered audit doc for planning refactor work.
