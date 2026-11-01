# REPORT 261102-refactor
> mode:autopilot | host:solo | from:2026-11-02 | to:- | push:main

## done
- Implemented the two adopted reviews through T166–T180: session-scoped completions and snapshot reconciliation; bounded ingress/deadlines; owned auth, telemetry and renderer lifetimes; shared profile/signup/export and writing/recall/deletion/diary-jump controllers; consistent passive entity placement and enforced web/mobile boundaries.
- Split encoding, export, spend-signal reads, account reads and achievement recording from broader service graphs. Both backend roots construct independent read/recording capabilities before commands and payouts, without late binding.
- Introduced rolling-compatible versioned paid receipts and actual Connect-handler tests for scope, operation identity, consent and canonical refusal mapping.
- Replaced opaque transaction handles and dynamic DB assertions with typed transaction behaviors bound to the exact pgx transaction. Provider comparison releases the graph transaction; preparation checks affordability without charging, and commit rechecks the source version, consent, balance and receipt.
- Batched synapse writes in bounded SQL arrays. Moved neutral queue envelopes/storage to platform infrastructure and withdrawal/settlement definitions to their producer contexts, preserving persisted kinds, keys, targets, leases and durable retry policy.
- Isolated nine real-database test binaries with independently migrated temporary databases. Explicit test base URLs are not migrated by the test launcher.
- Reduced repeated universe/archive projection allocations and released inactive archive caches/mirrors. An active deletion confirmation owns at most one diary across reader unmount and releases it on close, action replacement or account reset. Changed export reads to bounded batches from one consistent snapshot while preserving existing file and RPC contracts.

## decided
- Preserve public and persisted contracts. Export remains the existing unary byte response; full scene reads retain their current shape. These changes reduce repeated projection and database materialization costs without silently truncating an account or removing archive back-navigation.
- Retain solver adjacency/centroid precomputation and deterministic quiet-interval sleep/reheat. Exclude the experimental octree pool because measurements did not establish an active-tick improvement.
- Measured on Apple M1 Max, macOS arm64, Node 26.8.1; generated, reproducible fixtures, not production telemetry. Projection timings average 30 warm iterations; solver timings average 120 active ticks. Compare the checked-in benchmark with `COSIMOSI_BASELINE_SIM` pointing to the baseline module.

| Memories | Approximate uncompressed JSON | Fresh projection ms | Reused projection ms | Active tick ms | Baseline tick ms |
| --- | --- | --- | --- | --- | --- |
| 100 | 337,088 B | 0.033 | 0.004 | 0.077 | 0.067 |
| 1,000 | 3,376,756 B | 0.330 | 0.031 | 0.822 | 0.940 |
| 10,000 | 33,833,424 B | 1.831 | 0.446 | 16.014 | 17.723 |

- These are illustrative fixture costs; solver comparisons include runtime/GC noise and do not establish device FPS. Cached projections reuse unchanged immutable DTO objects and weakly reference keys.
- Export benchmark: 100 / 1,000 / 10,000 retained 1,900-byte diaries took approximately 0.070 / 0.432 / 3.893 ms and allocated 0.52 / 4.22 / 67.42 MB per operation. These are total allocations, not peak RSS. DB rows are bounded by `diary_reader.export_page_size`; returned bytes still scale with the full export.

- A separate isolated Go probe sampled `HeapAlloc` after each emitted diary, above a forced-GC baseline: approximately 0.526 / 4.214 / 50.460 MB for 100 / 1,000 / 10,000 diaries, producing 0.192 / 1.917 / 19.170 MB files. This samples the pure export use-case; it excludes database driver and RPC encoding buffers and is not process RSS.

## parked
- A scene/detail projection split and a streamed or background export require a separate compatible protocol design. The 10,000-memory fixture is about 33.8 MB before compression. Current full-snapshot and unary-delivery costs remain explicit capacity limits; no pagination is allowed to make missing graph nodes disappear or silently shorten a retained export.
- Active archive history remains available for backward scrolling. Only unchanged-page mapping and inactive-cache/mirror lifetime are bounded here; a strict active page window needs cursor/back-navigation and scroll-anchor design.
- Physical RN/WebGPU behavior, renderer-driver resource counts and real mobile frame latency require a device. Automated lifecycle tests cannot establish those measurements.
- Concurrent duplicate recalls may both reach the provider while their graph lock is released. Commit-time receipts still allow one debit and one set of effects; cross-instance provider-call deduplication is not introduced.

## checks
- Final archive/deletion handoff regressions passed: 289 universe tests, six diary-reader tests, four native deletion tests and universe type checking.
- Generated Inlang project metadata is excluded explicitly using [Prettier’s documented ignore-file syntax](https://prettier.io/docs/ignore), so a generator run does not break the following format check.
- Focused tests passed for session resets, strict mount/disposal, renderer late initialization, telemetry binding replacement, shared paid flows, profile rollback, receipt compatibility, actual RPC handlers, transaction behavior, source revalidation, batching and queue ownership.
- Two concurrent account integration runs passed against separate temporary databases. Focused real DB checks passed for transaction rollback, export pagination and snapshot consistency.
- Web/mobile FSD/ESLint boundary checks and package lint passed before the final integration gate. Final validation passed across lint, all workspace type checks, all package/web/mobile/API tests (including isolated PostgreSQL), web/blog builds, Go vet/build and generated-output freshness. A scene regression assertion was updated to the newly coherent pending-launch snapshot, then affected/remaining suites passed. Queue query relocation preserved all eight SQL bodies byte-for-byte and passed persistence fixtures plus all-package compilation.

## next
- Commit the verified integration candidate, push main and wait for CI once. CI result and commit are reported in the session response. Independently owned T165 provider work remains separate.
