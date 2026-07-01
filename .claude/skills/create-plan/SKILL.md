---
name: create-plan
description: >-
  Author a NEW feature spec in spec/plan/ by interviewing the user, to the quality bar of the existing plan docs.
  Use when the user wants to plan/design/spec a new feature or capability — "plan a new feature", "create a plan/spec
  for X", "design how X should work", "write a planning doc". This skill interrogates the user (purpose · scope/non-goals
  · design · acceptance criteria), scaffolds the next sequential plan with `pnpm spec:plan "<title>"`, fills it, ALSO
  creates/updates the policy/ux docs and notes the spec/values.yaml numbers the feature needs, and registers it in
  00.overview (status ⬜ planning). It does NOT implement — that's /create-plan-job then /implement-job.
  All docs are written in English. Do NOT auto-commit.
---

# Create a plan (interview → spec doc)

`plan/NN.*.md` is the **as-built SSOT** — the human-authored WHAT that makes implementation safe. Your job is to
turn a fuzzy request into a complete, reviewable plan at the quality of the existing docs (read one, e.g.
[plan/04](../../../spec/plan/04.auth-session.md) or [plan/14](../../../spec/plan/14.rendering-foundation.md), for the bar).
**Write the plan in English.**

## Step 1 — Interview

Don't guess the spec — extract it. Ask the user a few focused questions at a time (use AskUserQuestion for real
forks) until you can write each section concretely:

- **Purpose** — why this feature; the user/product problem.
- **Scope / Non-goals** — what's in, and what's explicitly out (non-goals prevent scope creep).
- **Design** — how it works: key decisions, RPC/proto contract, data model, state machines, render approach.
  Surface choices as questions when there's a real fork (e.g. "coordinates: server-authoritative vs client-emergent?").
  Include **architecture placement** — which FSD layer/slice/segment (FE, `ARCHITECTURE.md` §3.1) or Go context/package
  (BE, §2) each new piece lands in — so the job and implementer inherit the placement instead of re-deriving it (or
  drifting into a flat layout). Invoke `/fe-architecture` · `/be-architecture` · `/mobile-architecture` when unsure.
- **Acceptance Criteria** — the testable criteria that make it "true" (these become the job's acceptance criteria).
- **Policy / Values Impact** — which policy rules, and which spec/values.yaml numbers the feature sets or changes.

Honor the invariants **[I1]–[I11]** (00.overview §3, *The constitution*) — if the request would break one (e.g. delete stars, mutate the
original diary, server-side coords), flag it and resolve with the user before writing.

## Step 2 — Scaffold + fill

- `pnpm spec:plan "<title>"` → creates `spec/plan/NN.slug.md` (next number, stable ID — never reuse/renumber).
- **Pass an English title** so the file slug is English kebab-case (like the existing `plan/` files —
  `diary-wayfinding`, `universe-canvas`). The scaffold slugifies `<title>` straight into the filename.
- Fill every section from the interview, concretely enough to re-implement on another client (e.g. Flutter).
- Leave it as a plan (no checkboxes / no implementation) — implementation is a separate job.

## Step 3 — policy / ux / values it needs

A feature usually implies canonical rules or numbers. As part of creating the plan:

- **policy/** — create or update the domain/ux doc(s) the feature's rules belong to (e.g. `policy/domain/<x>.md`).
  policy describes *current truth*, so write the rule as "will be true once implemented" in the plan's **Policy /
  Values Impact** section now; the rule lands in policy/ when the job completes (see /implement-job Step 6).
  Don't pre-write unbuilt rules into policy as if shipped.
- **spec/values.yaml — ALL config goes here.** Any setting/tuning number the feature introduces or changes
  (thresholds, coefficients, caps, defaults, …) is config: enumerate it in **Policy / Values Impact**. Rule: config
  is **never hardcoded in FE/BE** — it lives once in `spec/values.yaml` and is generated to TS/Go constants via
  `pnpm gen:values` at implementation. (Excluded: formulas, array *content* like theme CSS / mood color tables, and
  proto/DB schema — those stay in code/proto/sqlc; array *lengths* are derived, not declared.)

## Step 4 — Register in 00.overview

Add the plan to the **plan index** and the **progress board** with status **⬜ planning** (so other agents see it
exists, unbuilt). Add it to the dependency graph if it has prerequisites. Then report: the plan path, what policy/ux
you touched, and "Next: `/create-plan-job NN` to generate the implementation job". Do NOT implement or commit.

For a CHANGE to shipped behavior, use /create-change instead (this skill is for new features).
