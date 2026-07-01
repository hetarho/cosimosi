# Epic A plan decisions & open questions

> **What this file is.** The Epic A spec plans (`spec/plan/16`–`27`) were authored in one pass without a live
> interview. This document records **(A)** the cross-cutting decisions made autonomously to keep the 12 plans
> coherent, and **(B)** every place a plan deliberately left something open or picked a default you may want to
> change. Each plan links here when it defers a choice ("left open — see root DECISIONS.md").
>
> **How to use it.** Skim Part A first — those are the load-bearing decisions. Then Part B, per plan. Anything you
> disagree with: edit the relevant plan's Design / Policy-Values section (and this file). None of these are built yet
> — they are the WHAT, not code — so changing them now is cheap. Values-tuning numbers are **not** set here; they are
> enumerated per plan and land in `spec/values.yaml` at implement (`pnpm gen:values`).
>
> **Status of the plans themselves:** all 12 are `Status: planning`, registered in
> [spec/plan/00.overview.md](spec/plan/00.overview.md) §5.1. Next step per unit is `/create-plan-job NN` → `/implement-job`.
>
> The set then passed an **adversarial cross-plan consistency audit** (six review dimensions → per-finding
> verification → completeness critic). Its confirmed findings — naming collisions (`InitialStrength`/`EffectiveStrength`),
> a `jobs.kind` enum gap, circular RPC-contract ownership, the launch-response fields (A9), and cross-reference drift —
> were applied before commit; the decisions they settled are recorded in A8–A10.

---

## Part A — cross-cutting decisions (apply across Epic A)

These were chosen against the PRD, `spec/ARCHITECTURE.md`, and the existing Foundation plans. They are the shared
artifacts the 12 plans agree on; changing one ripples across several plans.

### A1. Backend context map
- **`internal/memory`** is the single **core domain context**. It owns the whole memory aggregate (`Diary`,
  `EpisodicMemory`, `Neuron`, `NeuronActivation`, `Synapse`, `Emotion` VO, `Embedding`), the `jobs` table, all pure
  domain functions (plasticity, emotion, decay stubs), and the use-cases (`Encode`/`PersistEncoded`/`Link`). It starts
  as one Go package and splits into `memory/{domain,app,pg,rpc}` only when it earns it (ARCHITECTURE §2.3).
- **`internal/ai`** is a supporting external-service wrapper holding the concrete `Extractor`/`Embedder`/`Semanticizer`
  adapters + keyless mocks. The **ports are consumer-owned in `internal/memory`**; `internal/ai` has no domain logic.
- The **`jobs` queue table is owned by `internal/memory`** (its work); the generic claim/backoff helper may live in
  `platform`. `cmd/worker` drains it. *Alternative considered:* a standalone `jobs` context — rejected as premature for
  Epic A's three job kinds.

### A2. The write→launch loop is split into a synchronous preview + an atomic launch
- **`SplitDiary` is synchronous** (the user must see and edit the split — PRD [W2], not background). Embedding, gist
  (semanticize), and any cross-memory link refinement are **async jobs** enqueued at launch (ARCHITECTURE §2.8).
- **The `Diary` is persisted at `LaunchStars`** (atomic with the memories), not at split — split is a stateless
  preview. *Open sub-question in A6.*

### A3. Read-time derived state, shared pure math
- Effective brightness / strength / decay and effective synapse strength are **computed at read time** from stored
  facts (ARCHITECTURE §4), by **pure functions mirrored TS↔Go** in `packages/memory-logic`, pinned by golden-parity
  fixtures — so the client renders them and the server can gate on them from one source of truth.

### A4. Positions are emergent and never stored ([I5])
- `packages/force-sim` (pure `tick(dt)`, Web Worker) is **client-authoritative** for layout; the server owns only
  neurons/synapses/activations/connectivity facts. "Golden-parity" for force-sim means **web↔mobile determinism** via a
  seeded PRNG + golden fixtures — **not** a Go position authority (ARCHITECTURE §2.9 #8).

### A5. Vocabulary & config placement
- One ubiquitous language: the canonical domain names above are used verbatim across Go / DB / proto / FE mirror; the
  poetic/rendering words (star, cell-star, filament, nebula, constellation, latent-star) are **FE-visual only** and
  never appear as a domain/DB/proto symbol (PRD §3.4).
- Per-mood **(valence, arousal) coordinates** live in `spec/values.yaml` as two one-level number-maps
  (`emotion.mood_valence`, `emotion.mood_arousal`) — this shape is supported by `gen:values`. The **`mood → color`
  palette is code** (like a theme table, excluded from values), a single swappable entry-point in `packages/emotion`.

### A6. Past-dated diaries — the monotonic-time seam ([T1][I10]) — **default, confirm at Epic B**
- The universe clock (`universe_state`) is **Epic B**. Epic A derives universe time from the latest launched memory.
- **Default for Epic A:** a diary whose `diary_date` is *before* the latest launched date **is saved** (readable in
  the archive) but **launches no star**. The exact past-date UX (show a Epic-A confirmation vs. fully defer the
  behavior to Epic B) is **left open** — touches plans 16, 20, 27.

### A7. Neuron dedup ([E10]) is conservative + narrowly embedding-assisted
- `Encode` fetches candidate existing neurons (by name/type + a **narrow** embedding nearest-neighbour) and asks the
  `Extractor` to canonicalize conservatively (type-differentiated); the domain enforces identity. The similarity
  threshold and its values home are **open** (A/plan 20).

### A8. Naming: the two "effective strength" functions (resolved by the audit)
- PRD §3.2/§3.3 name **`EffectiveStrength`** (별 크기 / memory size) and **`EffectiveBrightness`** (밝기) at the
  **memory** level. Plan 18 originally reused `EffectiveStrength` for the *synapse* read-time strength — a one-name,
  two-concepts collision. **Resolution:** the synapse read-time function is renamed **`EffectiveSynapseStrength`**;
  bare `EffectiveStrength`/`EffectiveBrightness` stay reserved for the memory level.
- **Ownership:** all read-time effective-value pure math (synapse + memory-level) is owned by **plan 18** in
  `packages/memory-logic` (TS) ↔ `internal/memory` (Go), under one golden-parity harness. In Epic A the memory-level
  fns are trivial (`EffectiveStrength = base_strength` since recall_count=0; `EffectiveBrightness` = full); recall
  accumulation is Epic C, forgetting decay Epic D.

### A9. `LaunchStars` returns `new_neuron_ids` (resolved by the audit)
- Whether a neuron is *created* or *deduped onto an existing one* is a **server-only** decision. The latent-star
  **awaken** animation (plan 25) needs the genuinely-created neuron ids, so `LaunchStarsResponse` returns
  `{ memory_ids, new_neuron_ids }`. The client's optimistic insert is **memory-level only**; the deduped neuron graph,
  synapse edges, and emergent positions arrive on the next `GetUniverse` read.

### A10. `neuron_activations.weight` default — **[default]**
- The schema-forced `Extractor` output carries no weight (by [W4a] design), so `PersistEncoded` sets it at persist
  time. **Epic-A default: uniform `1.0`** per membership; differentiated co-membership weighting (which pulls the
  centroid harder for stronger neurons, [E8]) is **[open]** and refined later.

---

## Part B — per-plan open items & chosen defaults

Legend: **[default]** = a reasonable choice made now, change if you disagree · **[open]** = genuinely undecided,
needs your call or is deferred to implement.

### 16 · memory-aggregate-schema
- **[open]** HNSW index operator class + parameters, and the embedding nearest-neighbour similarity threshold — tuning,
  confirmed at implement.
- **[default]** Emotion stored as columns on `episodic_memories` (one primary emotion per memory, [M1]); soft-delete
  (`deleted_at`) and `sealed_at` columns declared now but unused until Epic H.
- **[open]** Past-dated launch handling (see A6).

### 17 · emotion-model
- **[default]** The FE palette + arousal-math mirror lives in **`packages/emotion`** (vs `packages/memory-logic`).
- **[default]** `arousal → initial strength` is **linear** across `emotion.arousal_strength_min..max` (vs a curve).
- **[open]** Whether to enforce valence/arousal axis-consistency ([P3]) on user-customized palettes — deferred to the
  Epic I palette-customization unit.

### 18 · synapse-plasticity
- **[default]** `Potentiate`/`Depress` take an explicit `rate`/`amount` argument (defaulting to the `synapse.*`
  constant) rather than always reading the constant — testable & reusable.
- **[default]** Read-time effective-strength decay is **exponential** in elapsed universe time (pinned by behaviour,
  not the exact shape). Coefficient `synapse.strength_decay_per_day`.
- **[note]** `synapse.temporal_window_days` / `synapse.temporal_bonus` are listed in the synapse values group but are
  **consumed by plan 21 (Link)**, not by these pure functions — see B/21.

### 19 · force-sim-layout
- **[open]** Coordinate-buffer packing / node-index-map ownership (which layer owns the id↔buffer-index mapping).
- **[open]** Whether Epic-A z is a settled force output *within* the hippocampus band or pinned to a mid-plane until
  the neocortex layer (Epic E) exists.
- **[open]** Active pattern-separation logic ([E11]) — reserved slot; v1 relies on force-sim repulsion + conservative
  merging only.

### 20 · encode-usecase
- **[default]** Encode split is synchronous; `PersistEncoded` is atomic and enqueues `embed` + `semanticize`, then
  hands to `Link`.
- **[open]** Dedup embedding-assist similarity threshold, and whether its value belongs under `encode.*` or `ai.*`
  (decided with the embedder in plan 22).
- **[open]** Past-dated launch handling (see A6).

### 21 · link-usecase
- **[default]** `Link` runs at **launch time**, synchronously inside `PersistEncoded`'s transaction (correctness &
  idempotency). Whether to move cross-memory (shared-neuron / temporal) linking into the async `link` job is **open**.
- **[open]** Numeric `synapse.temporal_window_days` and `synapse.temporal_bonus` (set at implement).
- **[note — reconcile with plan 18]** The `synapse.initial_shared_neuron` tier applies to **cross-memory neuron↔neuron
  edges**; the "shared neuron *is* the link" ([L2]) creates no extra edge (it is the activation membership). Confirm
  this framing lands identically in plan 18's tier semantics at implement.

### 22 · ai-worker-pipeline
- **[open — provider]** LLM + embedding provider/model. **Default:** the latest Claude models via the Anthropic SDK for
  extraction/semanticization (today that is Opus 4.8, `claude-opus-4-8`) plus an embedding model for `Embedder`. Not
  hard-coded into the plan (it is a WHAT-doc); confirm exact ids at implement. Model ids / API keys are runtime
  env/secrets, never `values.yaml`.
- **[open]** Monthly cost ceiling, exact backoff curve/jitter, and the daily-cost accounting window (universe-day vs
  calendar-day).

### 23 · universe-canvas
- **[default]** `EpisodicMemory↔Neuron` activation edges are carried as a membership list on the `episodic-memory`
  mirror (vs a standalone mirror slice).
- **[open]** Camera fly easing/durations, gesture mappings, zoom clamps — code-level constants unless a scalar earns a
  `rendering.camera.*` values entry at implement.
- **[open]** Whether memory ("star") nodes are simulated bodies or derived from their neuron centroid — deferred to the
  plan 19 layout contract.

### 24 · star-neuron-rendering
- **[default]** `cell-star` (neuron) point size is a small constant (vs degree-scaled).
- **[open]** Instance-bucket strategy — per-kind (star / cell-star / filament) vs shared buckets.
- **[open]** Mobile-MVP reduction extent (instance caps, which post-FX to drop).

### 25 · latent-star-field
- **[open]** Awaken-animation vocabulary/timing and latent-star ambient drift (motion design, at implement).
- **[open]** The client-side "recently active neuron" window + nearest-latent-star metric used to pick the awaken
  anchor (a presentation choice; the final position is emergent, never stored).

### 26 · nebula-color-field
- **[default]** Nebula composites **additive/screen over the skin background, behind the star bodies**; realized
  **screen-space on web** (reduced-sample on mobile) vs volumetric.
- **[open]** The honest-notice copy wording (reviewed at implement — must be literary/restrained, not AI-flavored).
- **[open]** Values grouping: `nebula.*` vs folding nebula scalars into `rendering.*`.
- **[open]** Whether a read-only *diagnostic* average-tone readout is ever surfaced (never stored/authoritative if so).

### 27 · writing-flow-ui
- **[default]** Optimistic launch: `LaunchStars` returns ids, the star renders immediately, gist/embeddings fill on the
  next `GetUniverse` read; editing is session-only (launched stars change only via natural processes).
- **[open]** Past-dated diary UX in the flow (see A6).
- **[open]** The FE tech-doc filename that will own the writing-flow rules (assigned at implement).

---

## Recurring themes to resolve once (touch multiple plans)
1. **Past-dated launch UX** (A6) — plans 16, 20, 27. One decision settles all three.
2. **Dedup similarity threshold + its values home** — plans 20, 22.
3. **Launch-time vs `link`-job for cross-memory linking** — plans 21, 22.
4. **LLM/embedding provider + model ids** — plan 22 (affects encode 20 + semanticize).
5. **Mobile-MVP reduction budget** (instance caps, dropped post-FX) — plans 23, 24, 25, 26.
