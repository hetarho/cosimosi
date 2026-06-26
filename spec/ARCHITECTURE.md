# cosimosi Architecture

This document is the single source of truth for cosimosi's **structure & boundaries** — the layers, the dependency
rules, and where every piece of code lives. (The product's *vocabulary* is owned by a separate document; the vision
and the per-feature specs are too. Those reference this one, never the reverse.) It is **self-contained**: it defines
the *frame*, not the product's features.

In short:

- **One ubiquitous language, owned by the domain layer.** One vocabulary is used verbatim across the domain, DB,
  proto, and frontend. The architecture gives it a single home (the domain layer) and guards the boundaries where
  other representations (proto, sql, pixels) translate to and from it (§1). *Which* words those are is domain content,
  out of scope here.
- **Backend = Domain-Driven Design.** Bounded contexts, each layered `domain → app → infra`, dependencies pointing
  inward only. Data is **sqlc + pgvector + a weighted graph**; transport is **Connect RPC + Protobuf**; AI is
  **behind ports + an async worker** (§2).
- **Frontend = Feature-Sliced Design**: React 19 + R3F 9 + three.js `WebGPURenderer` + TSL, one-way imports,
  control-state in XState, data in Zustand/Query (§3).
- **Web and mobile are peer apps** sharing pure code via `packages/`. Mobile is React Native (§3.5).

## System shape

```
cosimosi/                  pnpm workspace
├── proto/                 RPC contract (buf) — one source for the Go server + TS client
├── packages/              code shared across apps (pure: no Vite/Metro/DOM/native deps)
│                          · domain mirror + domain logic · force-sim · TSL shaders
│                          · generated Connect client · generated config (values)
└── apps/                  peer applications — each built & deployed on its own
    ├── web/               React 19 + Vite + R3F (FSD)
    ├── mobile/            React Native + Metro + R3F (FSD) — own native ios/ + android/
    ├── api/               Go (DDD) + Connect + sqlc + pgvector
    └── blog/              Astro
```

- **`apps/web` and `apps/mobile` are two separate React applications**, not one. They share the *pure* layers
  through `packages/` (domain mirror, domain logic, force-sim, TSL shaders, the Connect client, generated config) and
  both follow the same FSD + rendering architecture (§3). The web app bundles with Vite; the mobile app bundles with
  Metro and owns its native `ios/`/`android/` projects — it is **not** hosted inside the web build.
- **`apps/api`** is the Go backend (§2). **`proto/`** is the shared transport contract.

> **Doc scope — the frame, not the contents.** This file defines **layer roles, boundaries, and placement rules**:
> the containers every feature drops into. It deliberately does **not** enumerate the product's contexts, slices, or
> aggregates — those are domain content, out of scope here. Names in this document are generic placeholders
> (`<context>`, `<verb>`, …); the concrete names are filled in elsewhere.

---

## 1. The ubiquitous-language pattern (not the vocabulary)

> The actual vocabulary — which noun maps to which type, which verb to which use-case — is **domain content** and is
> out of scope here. This section is the *architectural rule* for **where** names live and how they cross boundaries.

- **The `domain` layer is the single naming authority.** Domain types and domain-service functions carry the
  canonical names; every other layer either uses those names verbatim or translates at a boundary.
- **proto and sql are foreign representations, kept at the edge.** The transport DTO (proto) and the persistence row
  (sqlc) are *not* domain types. They are mapped to/from domain at two anti-corruption boundaries — the RPC handler
  (`proto ↔ domain`) and the repository (`row ↔ domain`). No proto/sql type ever leaks inward.
- **The frontend mirrors the domain names, then projects to visuals at one seam.** Domain-mirror slices carry the
  canonical names; the *visual* vocabulary appears only in the rendering layer, behind the `entities/*/api` mapper (§3.4).
- **Enforced, not hoped.** A lint rejects forbidden cross-vocabulary names (a rendering word used as a domain symbol,
  or a second name for an existing concept), so a new domain name is defined once and reused everywhere.

---

## 2. Backend — Domain-Driven Design

### 2.1 What DDD means here

The domain layer is the sole home of the ubiquitous language; proto, sqlc, and pgx live outside it. "DDD here" means:

- **Bounded contexts** — the model is split where the language changes meaning. Inside a context the terms are exact;
  across contexts they talk through published interfaces, never by reaching into each other's domain or tables.
- **A layered context** — every context is `domain → app → infra`, with the **dependency rule**: source code
  dependencies point **only inward**. `domain` imports nothing of ours and nothing of infrastructure.
- **Tactical patterns** — aggregates, entities, value objects, domain services (pure), application services
  (use-cases), repositories (ports declared consumer-side), and an anti-corruption boundary at proto/sql mapping.

It is *pragmatic* Go DDD: no ORM, no generic repository abstraction over sqlc. sqlc *is* the repository
implementation; the domain is kept clean of it.

### 2.2 Context kinds & how they integrate

The system is a small set of bounded contexts of three **kinds** (the actual contexts are domain content, out of
scope here):

```
   ┌─────────────────────────────┐
   │  CORE DOMAIN context        │   the product's reason to exist; the richest model
   └──────────▲────────▲─────────┘
   app port   │        │   app port
   ┌──────────┴───┐  ┌──┴───────────────┐
   │ SUPPORTING   │  │ SUPPORTING       │   necessary, lower-stakes domains around the core
   └──────────────┘  └──────────────────┘
   ┌──────────────────────────────────────┐
   │ GENERIC / SHARED KERNEL               │   config · db pool · rpc mux · id — no business meaning
   └──────────────────────────────────────┘
   ┌──────────────────────────────────────┐
   │ SUPPORTING (external-service wrapper) │   3rd-party deps (e.g. AI) hidden behind ports + adapters
   └──────────────────────────────────────┘
```

- **One core domain, the rest support it.** Effort concentrates on the core; supporting contexts stay thin.
- **Contexts integrate only through `app`-layer interfaces.** A context that needs another depends on the other's
  *published* interface (a port), never on its `domain` internals or its tables (customer/supplier, core upstream).
- **The generic context is a shared kernel** of infra with no business meaning.
- **External services live behind ports** in a supporting context; their concrete adapters sit in the outermost ring.

### 2.3 Layout of a context

Every context — core or supporting — has the **same three-layer shape**. `<context>` is a placeholder; the real
context names are out of scope here.

```
apps/api/
├── cmd/
│   ├── api/main.go         composition root: the ONLY place that wires all layers & contexts together
│   └── worker/main.go      async/background worker (same wiring style)
├── internal/
│   ├── <context>/          one bounded context
│   │   ├── domain/         PURE. aggregates · entities · value objects · domain services (pure fns).
│   │   │                   carries the canonical names. imports: stdlib only — NO proto/sqlc/pgx, NO json/db tags.
│   │   ├── app/            use-cases (application services) + the ports they consume (interfaces: repo, clock, …)
│   │   └── infra/          adapters (outermost ring):
│   │       ├── pg/         repository impl: sqlc + thin pgx; row↔domain mapping
│   │       └── rpc/        Connect handler: proto↔domain mapping; thin (policy stays in app)
│   ├── <context>/          … one folder per bounded context, same split
│   ├── <external-wrapper>/ supporting context: ports + concrete adapters for a 3rd-party service
│   └── platform/           generic shared kernel: config · db pool · rpc mux · id · generated config
└── db/
    ├── migrations/         goose .up/.down — tables/columns carry the canonical domain names
    ├── queries/            sqlc input (*.sql), grouped per context
    └── gen/                sqlc output (never hand-edited) — an infra detail
```

> Per-context `db` ownership: each context owns its tables and queries; cross-context reads go through the owning
> context's `app` interface, not by querying another context's tables.

### 2.4 The dependency rule

```
   infra  ───────►  app  ───────►  domain
 (pg repo,        (use-cases,     (pure types +
  rpc handler,     ports as        domain services)
  ai adapters)     interfaces)     depends on NOTHING of ours
```

- **Inward only.** `rpc` handler knows `app`; `app` knows `domain`; `domain` knows neither. The composition root
  (`cmd/api/main.go`) is the one place that sees everything and injects concrete adapters into ports.
- **Ports are declared by the consumer.** `<context>/app` declares the interfaces *it* needs (repository, clock,
  external-service ports) — idiomatic Go, "accept interfaces, defined where used". `<context>/infra` and the
  external-wrapper context *implement* them.
- **proto types and sqlc rows are infrastructure.** The domain has never heard of them. The handler maps
  proto↔domain; the repo maps row↔domain. These two mappers are the **anti-corruption boundary** that keeps the
  language pure.

### 2.5 Aggregate boundaries (a structural decision)

The *rules* for drawing aggregate boundaries are architectural; *which* aggregates exist (and their fields) are domain
content, out of scope here. The rules:

- **An entity with its own lifecycle is its own aggregate root.** An entity shared by many others is a separate root,
  referenced **by id through a membership/join**, never *owned* — an aggregate never reaches inside another's
  internals.
- **Emergent relationships get no aggregate, type, or table.** A relationship that can be *computed* from stored data
  is derived at read time, not modeled — storing it as a redundant edge is forbidden.
- **Domain services are pure functions** (no IO) over the aggregates. Purity is what lets a client-side simulation and
  the server run the *same* math, pinned by golden-parity tests.

### 2.6 Persistence — sqlc + pgvector (because the workload isn't CRUD)

The chosen approach is **raw SQL via sqlc + pgvector**, not an ORM — because the workload shapes that drive this
product reward SQL control and gain nothing from an ORM:

- **vector similarity** (approximate-nearest-neighbour over embeddings; HNSW),
- **weighted-graph traversal** (neighbour / top-N / recursive N-hop over an edge table), and
- **atomic weight upserts** (`INSERT … ON CONFLICT … DO UPDATE`, batched).

sqlc generates the static queries; a *thin* pgx layer handles only the genuinely dynamic ones (runtime-variable hop
count / sort). **`<context>/infra/pg` is the only place that touches sqlc/pgx**, mapping rows to/from `domain` types —
no sqlc row escapes into `app` or `domain`. (Concrete tables/queries are defined per-feature, not here.)

### 2.7 Transport — Connect RPC + Protobuf

- **`proto/` is the single contract.** `buf` generates the Go server (`protoc-gen-connect-go`/`protoc-gen-go`) and
  the TS client (`protobuf-es` + `connect-es`) — shared by the web and mobile apps. **proto messages carry the
  canonical domain names verbatim** (never abbreviated or renamed).
- **proto = DTO layer.** Domain stays pure; the `infra/rpc` handler maps proto↔domain.
- **Unary only.** RN has no server-streaming, so we never design push streams. **High-frequency client-local events
  persist as a debounced, idempotent unary batch** (a `batch_id` recorded server-side prevents double-counting).
  Idempotent unary reads are exposed as HTTP GET → cacheable on the CDN.
- connect-go handlers are `http.Handler`s mounted on a thin `net/http` mux (`platform`) with `h2c` + CORS; only
  `/health` is hand-routed. Run `buf`/`sqlc`/`go` inside Docker/WSL (Windows Application Control blocks user-dir `.exe`s).

### 2.8 Async work & external-service ports

A write that triggers slow work returns immediately and enqueues a job; a background worker runs the work.

```
[sync]   use-case → persist + return id → enqueue Job
[worker] claim Job (SELECT … FOR UPDATE SKIP LOCKED) → run the domain-defined stages → complete | retry
```

- **Queue = a `jobs` table** (`SELECT … FOR UPDATE SKIP LOCKED`), exponential backoff via a `next_run_at` column.
  The worker is a separate process (`cmd/worker`) but may run as a goroutine in dev.
- **External services live behind ports:** an interface in `app`, a concrete adapter (3rd-party SDK or a **keyless
  mock** fallback) injected at the composition root. Cost-metered (per-call caps, caching, daily/monthly limits). New
  providers/capabilities slot in behind the *same* port — nothing else changes.
- **Optimistic write pattern.** The write returns only an id; the client renders optimistically. Slow results filled
  by the worker surface on the **next read** (refetch) — no polling, no streaming.

### 2.9 Forbidden patterns

1. **Renaming a concept across layers.** One name, every layer (§1).
2. **A type/table for a relationship that should be emergent.** If it can be computed from stored data, derive it;
   don't store a redundant edge.
3. **sqlc rows or proto types leaking into `domain`/`app`** — they are infra; map at the boundary.
4. **An ORM or hand-rolled generic repository over sqlc** — sqlc *is* the repository.
5. **Interfaces declared at the implementation** — declare them consumer-side (`<context>/app`).
6. **Business logic in the RPC handler** — handler is thin (map + call); policy lives in `app`/`domain`.
7. **Server-authoritative client-derived state** — the server owns the source data; anything a client can derive
   (e.g. layout coordinates) is not stored authoritatively.
8. **High-frequency events as server-streaming** — unary batch only (RN constraint).

---

## 3. Frontend — Feature-Sliced Design

The frontend is Feature-Sliced Design, applied identically by both the web and mobile apps (§3.5).

### 3.1 Layers & the web directory tree

**Six layers, one-way imports:** `app → pages → widgets → features → entities → shared`. A slice imports only
*lower* layers; same-layer cross-import is forbidden — the **only** exception is `entities`↔`entities` via the `@x`
public API (`entities/A/@x/B.ts`). Each slice exposes a single `index.ts` (no wildcard barrels). Enforced by `steiger`
+ `eslint-plugin-boundaries`.

The skeleton — what each **layer** is for. `<…>` are placeholders; the actual slices (and their domain names) are
created per-feature and are out of scope here, never pre-listed:

```
apps/web/src/
├── app/                    entry · providers (data/transport/i18n/theme/error) · router · global styles
├── pages/      <screen>/   route-level screens; compose widgets + features; hold no domain logic
├── widgets/    <block>/    self-contained big UI blocks (e.g. a full-screen canvas)
├── features/   <verb>/     one slice per user action / use-case
├── entities/               domain objects — TWO kinds, kept apart (§3.4):
│   ├── <domain-noun>/      model (type + store) · api (proto→domain mapper) · @x/<consumer>   — pure, NO three
│   └── <visual-noun>/      ui (renderer + shader bindings)                — projects a domain entity to a body
└── shared/                 domain-agnostic
    ├── ui/                 design-system primitives + HUD atoms
    ├── lib/                platform / render glue (e.g. the renderer boundary)         — web-specific
    └── i18n/               message catalogue
```

| Layer | Role | One-line test |
|---|---|---|
| `app` | composition: providers, routing, global style | "wires the app together" |
| `pages` | a route/screen; composes lower layers | "a URL lands here" |
| `widgets` | a large self-contained block reused across pages | "a big chunk a page drops in" |
| `features` | one user-facing action | "a verb the user does" |
| `entities` | a domain object (mirror) or its visual projection | "a noun the product talks about" |
| `shared` | domain-agnostic reuse | "no domain word in it" |

> Pure cross-app modules (shared domain logic, deterministic compute, the shader toolkit, the generated transport
> client, generated config) are *designed* to live in `packages/` (§3.5). Destination fixed (nothing is homeless);
> while `apps/web` is the only consumer they may sit in `shared/lib/*` / `entities/*/model` and are **extracted to
> `packages/` when `apps/mobile` becomes the second consumer** (promote-on-reuse — lazy *timing*, fixed *destination*).

**Where each file goes (segments).** Inside *any* slice, files are grouped by *technical role* — never by generic
`components/`/`hooks/`/`types/` folders:

| Segment | Holds |
|---|---|
| `ui` | React/R3F components, shader bindings — **the only platform-aware code** (`*.native.tsx` lives here) |
| `model` | types, Zustand stores, **XState machines**, pure slice logic |
| `api` | backend calls + proto↔domain mappers for this slice |
| `lib` | slice-internal helpers (not shared out) |
| `config` | slice-local constants (tuning numbers come from generated config, never hardcoded) |

**Decision procedure** — given a new file, ask in order: (1) *a domain noun, or its rendering?* → `entities/<domain>`
vs `entities/<visual>`; (2) *a user action?* → `features/<verb>`; (3) *a big self-contained block?* → `widgets`;
(4) *a whole screen?* → `pages`; (5) *domain-agnostic & reused?* → `shared` (or `packages/` if pure & cross-app).
Then pick the segment from the table. If two slices need the same thing it promotes **down** a layer — never copied
sideways.

**Naming.** kebab-case singular slices; PascalCase component files; camelCase/kebab elsewhere; named exports only.

### 3.2 Control-state in XState, data in Zustand/Query

This is an interaction-rich, navigated app, not a form app. **Control state** — the exclusive modes/phases/lifecycle/
selection ("one of N states") — lives in **XState v5 machines** (`model/<name>.machine.ts`, pure TS). **Data** —
collections, the graph, caches, coordinate buffers — lives in **Zustand/TanStack Query/refs**, never in machine
context (id references only). Per-frame render loops read the machine via `getSnapshot()` in `useFrame`, never via
React state (no 60fps re-renders).

### 3.3 Rendering stack — R3F 9 + WebGPURenderer + TSL

The render workload is a **force-directed graph viz** (many instanced nodes + many fat-line edges, updated per frame).
The stack that fits it:

- **R3F 9 + three.js `WebGPURenderer`** (auto-falls-back to WebGL2); shaders in **TSL** (compiles to WGSL *and* GLSL →
  one shader source for web + mobile). Post-processing via three's node pipeline (pin three's version).
- **Simulation off the render thread.** The force-sim is a pure `tick(dt)` module (in/out: node+edge arrays /
  `Float32Array` of coords), run in a Web Worker (Barnes-Hut, O(N log N)). The renderer only *reads* coords into
  `InstancedMesh.matrix` / uniforms — **never drives 60fps from React state**.
- **Instancing/batching first.** Nodes = `InstancedMesh` buckets; edges = `Line2`.
- **Visual bodies come through an asset-source port** (shader | glTF | …) so the domain never imports a concrete
  renderer.

### 3.4 The domain → visual projection (the FE anti-corruption boundary)

The rendering layer is the **only** place the domain vocabulary and the visual vocabulary meet. (Which domain noun
maps to which visual body, and how each property maps, is domain content, out of scope here.) The rule:

- **Domain-mirror entities** mirror the transport/domain types and know nothing about three.js. Their `api` segment
  maps `proto → FE domain` — the FE mirror of the backend's anti-corruption boundary (§2.4).
- **Rendering entities** import a domain-mirror entity (via `@x`) and project it to a visual body. The projection is
  **one-way**: visual words never travel back up into the domain slices or the API mapper, and anything the domain
  treats as *emergent* stays emergent here too — rendered, never modeled.

### 3.5 Shared packages & the mobile app

**`packages/` — the pure, cross-app core** (no Vite/Metro/DOM/native deps; `apps/web` and `apps/mobile` both depend
on it). Each package has one job and one home:

```
packages/                pure cross-app modules — no Vite/Metro/DOM/native deps. By role (placeholder names):
├── <domain>/            shared domain-mirror types + proto→domain mappers
├── <domain-logic>/      deterministic pure functions over the domain (golden-parity with the Go domain)
├── force-sim/           pure tick(dt) simulation module (node+edge → Float32Array coords)
├── shaders/             cross-platform shader/geometry toolkit — TSL nodes, no DOM
├── api-client/          generated transport client + config
└── config/              constants generated from values.yaml (gen:values)
```

**`apps/mobile` — React Native, mirrors the web app's FSD.** Same layers and same slice names; it consumes
`packages/` exactly as the web does. Only the platform-aware bits differ:

```
apps/mobile/
├── ios/ · android/         native projects
├── metro.config.js         Metro bundler (resolves three → its WebGPU build)
└── src/
    ├── app/                providers + RN navigation (the web's router is the only app-layer swap)
    ├── pages/ · widgets/ · features/ · entities/   ← same slices as apps/web
    │                       model · machines · api imported from packages/ and shared verbatim
    └── shared/ui/          RN primitives (View/Text/gesture) where the web uses DOM
```

- **What is shared vs forked.** Everything under `model`/`api` and all of `packages/` is shared verbatim — it is
  free of `three`/React-DOM/DOM by rule. `ui` is shared by default — the web is responsive and the mobile UI mirrors
  it — and a `*.native.tsx` sibling exists **only** where a primitive genuinely differs (HTML/DOM ↔ RN
  `View`/`Text`/gesture; web router ↔ RN navigation; the `<Canvas>` host wiring; auth token storage).
- **Renderer.** `react-native-webgpu` hosts the same three.js `WebGPURenderer` + TSL shaders from `packages/shaders`
  — the scene renders from one shader source on both platforms.

> The foundation's only mobile obligation is to keep the shared layers platform-pure; the mobile app itself is built
> later.

---

## 4. Cross-cutting patterns

- **Per-user isolation.** Every persisted row carries the user id and every query is scoped to it via an
  interceptor-injected context value (RLS is a later hardening). This is a transport+persistence rule, applied
  uniformly rather than per-feature.
- **Derived state, not stored state.** State that varies continuously with time is *computed at read time* from the
  last-event timestamp, never written per tick; only discrete events persist. The server stays authoritative over the
  source data while anything derivable from it (appearance, layout) is a pure function — kept out of the store.
- **Config is build-time and generated.** Tuning scalars live in `values.yaml` → `pnpm gen:values` → FE(TS)/BE(Go)
  constants; never hardcoded, never mutated at runtime.

---

## 5. Conventions & non-goals

- **Language.** English for code and identifiers; UI copy is i18n'd (Paraglide).
- **IDs.** Backend mints `TEXT` PKs (UUID/nanoid); clients never create IDs. Times stored UTC, displayed local.
- **Git.** Conventional Commits, small semantic units. `gofmt` + ESLint.
- **Not now:** real prod deployment; Connect server-streaming; the mobile build itself (RN is *decided* (§3.5) but
  built later — the foundation only keeps logic platform-pure); multi-user real-time collaboration (the social
  features are async, one-way, and deferred). These are decisions on record, not work in flight.

---

## 6. References

- **FSD** — [Overview](https://feature-sliced.design/docs/get-started/overview) ·
  [Layers](https://feature-sliced.design/docs/reference/layers) ·
  [Public API](https://feature-sliced.design/docs/reference/public-api)
- **DDD** — Evans, *Domain-Driven Design*; Vernon, *Implementing DDD*;
  [Three Dots Labs — Clean Architecture in Go](https://threedots.tech/post/introducing-clean-architecture/) ·
  [Go Code Review — Interfaces](https://go.dev/wiki/CodeReviewComments#interfaces)
- **Backend stack** — [sqlc](https://docs.sqlc.dev) ([#2467 repository](https://github.com/sqlc-dev/sqlc/issues/2467),
  [#3548 vector](https://github.com/sqlc-dev/sqlc/issues/3548)) · [pgvector](https://github.com/pgvector/pgvector) ·
  [connect-go](https://connectrpc.com/docs/) · [buf](https://github.com/bufbuild/buf)
- **Frontend stack** — [R3F](https://r3f.docs.pmnd.rs) · [three.js WebGPU/TSL](https://threejs.org/docs/) ·
  [XState v5](https://stately.ai/docs)
