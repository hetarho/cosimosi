---
job: '{{JOB}}'
type: '{{TYPE}}'
source: '{{SOURCE}}'
plan: '{{PLAN}}'
status: todo
title: '{{TITLE}}'
---

# Job {{JOB}}: {{TITLE}} ({{TYPE}})

> Implementation work doc. Source spec: [{{SOURCE}}](../{{SOURCE}}.md).
> /cosimosi:implement-job {{JOB}} builds it via the two checklists below. When done, reflect the result into the
> SSOT (plan/policy/values) and set status: done. Write it in English.

## Acceptance Criteria (from {{SOURCE}})

<!-- The source spec's acceptance criteria. After building, verify each is true in the running code. -->

- [ ] A1 …

## Implementation Checklist

<!-- How to build it, top to bottom. [P] = parallel (different files, no dependency). Flag (gen)/(migrate)/(gen:values).
     Config/tuning numbers are never hardcoded — add them to spec/values.yaml, then import the (gen:values) constant. -->

- [ ] T001 …

## Grounding

- Constitution ([I1]–[I11]): [00.overview](../plan/00.overview.md) §3 (_The constitution_)
- Architecture (placement): [ARCHITECTURE.md](../ARCHITECTURE.md) — FE §3 (layers/slices/segments, §3.4 domain→visual,
  §3.5 mobile) · BE §2 (context layout, dependency rule). Invoke `/fe-architecture` · `/mobile-architecture` ·
  `/be-architecture` for the surfaces this job touches.
- tech / policy / values touched: <!-- -->

## Affected files (blast radius)

<!-- Exact paths found from the source spec + a code grep — nothing outside this scope is touched.
     For each, note its target placement: FE layer/slice/segment (§3.1) or BE context/package (§2). -->

## Verification / DoD

- [ ] Every **Acceptance Criteria** item above is true in the current code
- [ ] (if type=change) no regression of the existing plan's acceptance criteria
- [ ] Codegen / migration / values applied (if any): `pnpm gen` / `pnpm db:migrate` / `pnpm gen:values`
- [ ] FE `--filter @cosimosi/web build`·`lint` / BE `go vet ./... && go build ./...` (Docker) pass (if any)
- [ ] Constitution sanity: no row deletes on `records`/`memories`/`memory_links`, no body UPDATE on `records`
- [ ] Architecture self-audit passed (the relevant `/fe-` `/mobile-` `/be-architecture` checklist): placement correct,
      app-layer segmented (not flat), web↔mobile parity, `pnpm lint:fsd:layout` green (FE)

## Review

- [ ] `/code-review` applied (rejections noted with reason) · for non-trivial logic, `/codex:review --background`

## After completion — reflect into the SSOT

- [ ] Update `plan/` to the new reality · update affected `policy/**`·`tech/**` · tuned numbers → `spec/values.yaml` (+`pnpm gen:values`)
- [ ] (if type=change) move the `changes/` source doc to `changes/archive/`
- [ ] 00.overview progress board ✅ · this doc's frontmatter `status: done`
