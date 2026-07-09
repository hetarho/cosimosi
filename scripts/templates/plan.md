# {{NN}}. {{TITLE}}

> {{TITLE}} — one-line summary | Scope: FE|BE|FS | Status: planning
> Filled by /cosimosi:create-plan through a user interview. A plan states _what must be true_ (the WHAT),
> in enough detail to re-implement on another client (e.g. Flutter). Write it in English.

## Purpose

<!-- Why this feature exists. The user/product problem. -->

## Scope / Non-goals

<!-- What is in, and what is explicitly out. Non-goals prevent scope creep. -->

## Grounding

- Constitution ([I1]–[I11]): [00.overview](00.overview.md) §3 (_The constitution_)
- tech / policy / concept basis: <!-- the docs this depends on -->

## Design

<!-- How it works — key decisions, contracts (proto/RPC), data model, state machines, render approach. -->

## Acceptance Criteria

<!-- Declarative / EARS. The testable criteria that make this feature "true". Copied into the job's Acceptance Criteria. -->

1.

## Policy / Values Impact

<!-- Rules to land in policy/**, plus **every config/tuning number** that goes in spec/values.yaml
     (thresholds, coefficients, caps, defaults…). Config is never hardcoded in FE/BE — its single source is
     spec/values.yaml, generated to FE(TS)/BE(Go) constants via `pnpm gen:values`. (Excluded: formulas, array
     *content* like theme CSS / mood color tables, and proto/DB schema; counts are derived array lengths.)
     /cosimosi:create-plan also creates/updates the relevant policy·ux docs. -->
