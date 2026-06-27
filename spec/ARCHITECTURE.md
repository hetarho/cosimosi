# cosimosi Architecture

This document is the single source of truth for cosimosi's **structure & boundaries** — the layers, the dependency
rules, and where every piece of code lives. (The product's *vocabulary* is owned by a separate document; the vision
and the per-feature specs are too. Those reference this one, never the reverse.) It is **self-contained**: it defines
the *frame*, not the product's features.

In short:

- **One ubiquitous language, owned by the domain model.** One canonical semantic vocabulary is used across the
  domain, DB, proto, and frontend. Each representation may use its own casing/suffixes, but not a second product word
  for the same concept. Boundaries translate proto/sql/pixels to and from the domain model (§1). *Which* words those
  are is domain content, out of scope here.
- **Backend = domain-first Go.** `cmd/` composes, `internal/` protects, context packages own behavior, and adapters sit
  at the edge. Clean Architecture/DDD terms are used as control rails for complex core logic, not as mandatory folders
  for every small feature. Data is **sqlc + pgvector + a weighted graph**; transport is **Connect RPC + Protobuf**; AI is
  **behind consumer-owned ports + an async worker** (§2).
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
    ├── api/               Go domain-first service + Connect + sqlc + pgvector
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

- **The domain model is the single naming authority.** Domain types and domain-service functions carry the canonical
  names; every other layer either uses those names semantically or translates at a boundary. In a small Go context this
  may be the context package itself; in a larger context it may be a `domain/` package.
- **proto and sql are foreign representations, kept at the edge.** The transport DTO (proto) and the persistence row
  (sqlc) are *not* domain types. They are mapped to/from domain at two anti-corruption boundaries — the RPC handler
  (`proto ↔ domain`) and the pg adapter (`row ↔ domain`). No proto/sql type ever leaks inward.
- **The frontend mirrors the domain names, then projects to visuals at one seam.** Domain-mirror slices carry the
  canonical names; the *visual* vocabulary appears only in the rendering layer, behind the `entities/*/api` mapper (§3.4).
- **Enforced, not hoped.** A lint rejects forbidden cross-vocabulary names (a rendering word used as a domain symbol,
  or a second product word for an existing concept), so a new domain name is defined once and reused everywhere. The
  lint is semantic: representation-specific casing, pluralization, and generated-code suffixes are allowed when they do
  not introduce a new concept name.

---

## 2. Backend — Domain-first Go

### 2.1 What this means

The backend needs the control of Clean Architecture without importing Java-style ceremony into Go. The rule is:
**start with clear Go packages, then split only when the package earns it.**

The invariants are stricter than the folder shape:

- **Domain language is protected.** Product terms live in the domain model and stay free of proto, sqlc, pgx, JSON tags,
  DB tags, and transport concerns.
- **Dependencies point toward behavior, not infrastructure.** RPC and persistence code call the context behavior; domain
  logic never calls RPC, sqlc, pgx, SDK clients, or framework code.
- **`cmd/` is the composition root.** Binaries wire concrete dependencies, config, adapters, handlers, and workers.
- **Abstractions are earned.** Interfaces are declared by the consuming code when tests, replacement, or cross-context
  integration needs them. No implementation-side interfaces just for mocking.
- **DDD is a toolbox for the core.** Bounded contexts, aggregates, value objects, domain services, and use-cases are used
  where the product model is rich enough to benefit from them. Thin supporting features stay thin.

No ORM, no DI framework, no generic repository abstraction over sqlc. sqlc is the generated query layer; hand-written Go
around it is an adapter only when domain mapping, dynamic SQL, transactions, or tests need one.

### 2.2 Context kinds & how they integrate

The system is a small set of bounded contexts of three **kinds** (the actual contexts are domain content, out of
scope here):

```
   ┌─────────────────────────────┐
   │  CORE DOMAIN context        │   the product's reason to exist; the richest model
   └──────────▲────────▲─────────┘
   published  │        │   published
   behavior   │        │   behavior
   ┌──────────┴───┐  ┌──┴───────────────┐
   │ SUPPORTING   │  │ SUPPORTING       │   necessary, lower-stakes domains around the core
   └──────────────┘  └──────────────────┘
   ┌──────────────────────────────────────┐
   │ PLATFORM                              │   config · db pool · rpc mux · id — no business meaning
   └──────────────────────────────────────┘
   ┌──────────────────────────────────────┐
   │ SUPPORTING (external-service wrapper) │   3rd-party deps (e.g. AI) hidden behind ports + adapters
   └──────────────────────────────────────┘
```

- **One core domain, the rest support it.** Effort concentrates on the core; supporting contexts stay thin.
- **Contexts integrate through small published behavior.** A context that needs another depends on the other's exported
  use-case/port surface, never on its internals or tables. If the producer is still small, that surface may be the
  context package itself; if it grows, it may live in an `app/` package.
- **`platform/` is not a domain context.** It is shared infrastructure with no business meaning.
- **External services live behind ports** in a supporting context; their concrete adapters sit in the outermost ring.

### 2.3 Layout of a context

`<context>` is a placeholder; real context names are domain content, out of scope here. The important unit in Go is the
package, not a diagram. Do not create empty packages to satisfy an architecture picture.

```
apps/api/
├── cmd/
│   ├── api/main.go         calls run(), builds the HTTP server, wires adapters
│   └── worker/main.go      async/background worker (same wiring style)
├── internal/
│   ├── <context>/          one bounded context; start as one package when that stays readable
│   │   ├── types.go        domain types / value objects / canonical names
│   │   ├── service.go      domain behavior or application use-cases while still small
│   │   ├── ports.go        consumer-owned interfaces, only once a consumer exists
│   │   ├── pg/             sqlc + thin pgx adapter; row↔domain mapping
│   │   └── rpc/            Connect handler; proto↔domain mapping; thin
│   ├── <context>/          another context; same progression, not necessarily same files
│   ├── <external-wrapper>/ supporting wrapper for a 3rd-party service, behind consumer-owned ports
│   └── platform/           config · db pool · rpc mux/server · id · generated config
└── db/
    ├── migrations/         goose .up/.down — tables/columns carry canonical domain meaning
    ├── queries/            sqlc input (*.sql), grouped per context
    └── gen/                sqlc output (never hand-edited) — an infra detail
```

If a context grows past the readable one-package shape, split by dependency direction:

```
internal/<context>/
├── domain/                 pure domain model and domain services
├── app/                    use-cases + consumer-owned ports
├── pg/                     persistence adapter: sqlc/pgx + row↔domain mapping
└── rpc/                    transport adapter: proto↔domain mapping
```

This split is a refactor, not a starting tax. Use it when it removes noise, import cycles, test pain, or mixed IO/domain
code. Supporting contexts may stay in the smaller shape forever.

> Per-context `db` ownership: each context owns its tables and queries; cross-context reads go through the owning
> context's published behavior, not by querying another context's tables.

### 2.4 The dependency rule

```
   pg / rpc / SDK adapters  ───────►  context behavior  ───────►  domain model
                                     (or app package)              (pure)
```

- **Inward only.** `rpc` and `pg` know context behavior; context behavior knows the domain model; the domain model knows
  neither. In the split shape this is `rpc/pg → app → domain`.
- **The composition root sees everything.** `cmd/api` and `cmd/worker` inject concrete adapters into the behavior that
  consumes them.
- **Ports are declared by the consumer.** The context behavior declares the interfaces it needs (repository, clock,
  external service, job queue) only when it actually consumes them. Concrete `pg` packages and external-wrapper packages
  return structs and implement those interfaces implicitly.
- **proto types and sqlc rows are infrastructure.** The domain has never heard of them. The handler maps
  proto↔domain; the pg adapter maps row↔domain. These two mappers are the anti-corruption boundary that keeps the
  language pure.
- **Package names must read well at call sites.** Avoid repeating generic `domain`, `app`, or `service` package names
  when they force aliases or hide the product concept. Prefer the smaller context package until the split makes code
  clearer.

### 2.5 Aggregate boundaries (a structural decision)

The *rules* for drawing aggregate boundaries are architectural; *which* aggregates exist (and their fields) are domain
content, out of scope here. The rules:

- **An entity with its own lifecycle is its own aggregate root.** An entity shared by many others is a separate root,
  referenced **by id through a membership/join**, never *owned* — an aggregate never reaches inside another's
  internals.
- **Emergent relationships are not domain source-of-truth.** A relationship that can be computed from stored data is not
  promoted into an aggregate root or canonical domain type. It may be materialized as an infrastructure projection
  (for example, a weighted edge table) only when performance, async derivation, or query shape requires it, and only if
  it can be rebuilt from its source facts.
- **Domain services are pure functions** (no IO) over the aggregates. Purity is what lets a client-side simulation and
  the server run the *same* math, pinned by golden-parity tests.

### 2.6 Persistence — sqlc + pgvector (because the workload isn't CRUD)

The chosen approach is **raw SQL via sqlc + pgvector**, not an ORM — because the workload shapes that drive this
product reward SQL control and gain nothing from an ORM:

- **vector similarity** (approximate-nearest-neighbour over embeddings; HNSW),
- **weighted-graph traversal** (neighbour / top-N / recursive N-hop over an edge table), and
- **atomic weight upserts** (`INSERT … ON CONFLICT … DO UPDATE`, batched).

sqlc generates the static queries; a *thin* pgx layer handles only the genuinely dynamic ones (runtime-variable hop
count / sort). **`<context>/pg` is the only context-specific package that touches sqlc/pgx**, mapping rows to/from
domain types — no sqlc row escapes into context behavior or the domain model. (Concrete tables/queries are defined
per-feature, not here.)

### 2.7 Transport — Connect RPC + Protobuf

- **`proto/` is the single contract.** `buf` generates the Go server (`protoc-gen-connect-go`/`protoc-gen-go`) and
  the TS client (`protobuf-es` + `connect-es`) — shared by the web and mobile apps. Proto messages carry canonical
  domain terms semantically; representation-specific casing, request/response suffixes, and generated-code naming are
  fine, but synonyms and abbreviations are not.
- **proto = DTO layer.** Domain stays pure; the `rpc` handler maps proto↔domain.
- **Unary only.** RN has no server-streaming, so we never design push streams. **High-frequency client-local events
  persist as a debounced, idempotent unary batch** (a `batch_id` recorded server-side prevents double-counting).
  Idempotent unary reads are exposed as HTTP GET → cacheable on the CDN.
- connect-go handlers are `http.Handler`s mounted on a thin `net/http` mux (`platform`) with `h2c` + CORS; only
  `/health` is hand-routed. The server is built through a `NewServer(...deps) http.Handler` constructor, with route /
  service registration visible in one place. `main()` stays tiny and delegates to `run(...)`. Run `buf`/`sqlc`/`go`
  inside Docker/WSL (Windows Application Control blocks user-dir `.exe`s).

### 2.8 Async work & external-service ports

A write that triggers slow work returns immediately and enqueues a job; a background worker runs the work.

```
[sync]   use-case → persist + return id → enqueue Job
[worker] claim Job (SELECT … FOR UPDATE SKIP LOCKED) → run the domain-defined stages → complete | retry
```

- **Queue = a `jobs` table** (`SELECT … FOR UPDATE SKIP LOCKED`), exponential backoff via a `next_run_at` column.
  The worker is a separate process (`cmd/worker`) but may run as a goroutine in dev.
- **External services live behind ports:** an interface at the consumer, a concrete adapter (3rd-party SDK or a
  **keyless mock** fallback) injected at the composition root. Cost-metered (per-call caps, caching, daily/monthly
  limits). New providers/capabilities slot in behind the same consumed behavior — nothing else changes.
- **Optimistic write pattern.** The write returns only an id; the client renders optimistically. Slow results filled
  by the worker surface on the **next read** (refetch) — no polling, no streaming.

### 2.9 Forbidden patterns

1. **Renaming a concept across layers.** One semantic product name, every layer (§1).
2. **Creating packages for a diagram.** No empty `domain/app/infra` folders, no pass-through services, no interface
   unless a consumer needs it.
3. **A computed relationship as domain source-of-truth.** If it can be derived, keep it derived or materialized only as
   a rebuildable infrastructure projection.
4. **sqlc rows or proto types leaking into domain/context behavior** — they are infra; map at the boundary.
5. **An ORM or hand-rolled generic repository over sqlc** — sqlc is the generated query layer.
6. **Interfaces declared at the implementation** — declare them consumer-side where they are used.
7. **Business logic in the RPC handler** — handler is thin (map + call); policy lives in context behavior/domain.
8. **Server-authoritative client-derived state** — the server owns the source data; anything a client can derive
   (e.g. layout coordinates) is not stored authoritatively.
9. **High-frequency events as server-streaming** — unary batch only (RN constraint).

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

> The foundation sets up the mobile app **shell** alongside the web — providers (data/i18n/theme/session), RN
> navigation, and the design-system's RN primitives — so both apps run from day one, with the shared layers kept
> platform-pure in `packages/`. **Promote-on-reuse still governs feature code** (web-first, extracted as mobile
> features arrive); only the mobile **feature UI** and the **RN WebGPU renderer** are built later, with their web
> counterparts.

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
- **Git.** Commit small semantic units with `type(planNN - scope): English title`; the subject is English and the
  body/comment is Korean. Use the relevant plan number for plan-bound work. `gofmt` + ESLint.
- **Not now:** real prod deployment; Connect server-streaming; the mobile **feature UI** and the RN WebGPU renderer
  (the mobile app *shell* ships in the foundation per §3.5 — only its feature screens + renderer come later);
  multi-user real-time collaboration (the social features are async, one-way, and deferred). These are decisions on
  record, not work in flight.

---

## 6. References

- **FSD** — [Overview](https://feature-sliced.design/docs/get-started/overview) ·
  [Layers](https://feature-sliced.design/docs/reference/layers) ·
  [Public API](https://feature-sliced.design/docs/reference/public-api)
- **Backend architecture** — [Go module layout](https://go.dev/doc/modules/layout) ·
  [Go Code Review — Interfaces](https://go.dev/wiki/CodeReviewComments#interfaces) ·
  [Ben Johnson — Standard Package Layout](https://gobeyond.ghost.io/standard-package-layout/) ·
  [Mat Ryer — HTTP Services in Go](https://grafana.com/blog/how-i-write-http-services-in-go-after-13-years/) ·
  Evans, *Domain-Driven Design*; Vernon, *Implementing DDD*;
  [Three Dots Labs — Clean Architecture in Go](https://threedots.tech/post/introducing-clean-architecture/)
- **Backend stack** — [sqlc](https://docs.sqlc.dev) ([#2467 repository](https://github.com/sqlc-dev/sqlc/issues/2467),
  [#3548 vector](https://github.com/sqlc-dev/sqlc/issues/3548)) · [pgvector](https://github.com/pgvector/pgvector) ·
  [connect-go](https://connectrpc.com/docs/) · [buf](https://github.com/bufbuild/buf)
- **Frontend stack** — [R3F](https://r3f.docs.pmnd.rs) · [three.js WebGPU/TSL](https://threejs.org/docs/) ·
  [XState v5](https://stately.ai/docs)
