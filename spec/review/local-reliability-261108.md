# REVIEW local-reliability-261108

> st:converted@261108 | scope:scripts/ packages/3d-renderer/ | at:b3387f84 | base:ARCH@4

## summary

- Read-only child scouts proposed one reproduced verification defect and one source-traced renderer lifecycle defect. Only coordinator-approved, bounded behavior-preserving work belongs to this eight-hour local run.

## findings

- F1 [o] P1 `scripts/lib.mjs:25-32`, `scripts/go-check.mjs:52-79`, `scripts/check-generated.mjs:15-22`: bug: a signaled subprocess has null status and can be accepted as a completed successful check. The shared wrapper returned zero after an actual child SIGTERM. ← A terminated verification or generation process must not satisfy the existing successful-completion gate. →T225
- F2 [?] P2 `packages/3d-renderer/src/layers/ColorField.tsx:170-221`: bug hypothesis: an inline callback ref hides the same instanced mesh on rerender, while an unchanged frame key skips restoring its count and visibility. ← A settled field can disappear until coordinates or the camera change; actual React/R3F reproduction is still required.

## notes

- Authority: direct user `self-improve-local` invocation for eight hours, `2026-11-07T15:10:49Z..23:10:49Z`; coordinator `/root` may adopt bounded behavior-preserving improvements and integrate separately reviewed submissions on the calling `main`. No new product policy, public contract, precision, storage format or required verification scope is delegated.
- Artifacts: `.git/haeram/v1/artifacts/261108-local8h/invocation.json`, `scout-checks.md`, `signal-baseline.json`, `scout-runtime.json`. Scouts `/root/scout_checks` and `/root/scout_runtime` had no write or implementation authority.
- F1 raw evidence was independently checked by the coordinator: `spawnSync` child result `status:null`, `signal:SIGTERM`, no spawn error; shared wrapper status 0, output `{"result":0}`. Metric: one deliberate interruption falsely accepted; target zero false successes in the frozen success/nonzero/missing-executable/signal regression matrix. Historical incidence and speed benefit are unknown.
- F1 approval by `/root`: base code `b3387f84` (current planning HEAD `193f2cda` changes spec only); allow only `scripts/lib.mjs`, `scripts/go-check.mjs`, `scripts/check-generated.mjs`, `scripts/subprocess-results.test.mjs` and the existing `package.json` guard-test list. Preserve successful execution, each wrapper's ordinary nonzero/spawn-error policy, cwd/environment/stdio, gofmt stdout rejection, generation ordering and every mandatory check. Target zero false successes on real signaled-child regressions and preserved controls. Implementation/task checks capped at 75 minutes, independent review reserved separately; final `pnpm check` belongs to the coordinator. Re-propose scope expansion; rollback the isolated task commit.
- F2 remains a hypothesis pending a bounded real lifecycle reproduction; do not implement it based only on source tracing. Prior T141 fixed the analogous sibling callback, and T172 added this frame gate; neither establishes the proposed reproduction.
- Excluded: blocked T222, pending DEMO/ONB product deltas, existing owner-only rendering decisions, prior inconclusive octree pooling, unmeasured spring denominator optimization and a separate disposal-lifetime hypothesis.
