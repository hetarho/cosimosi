# ARCH architecture

> r2 | system shape, stack, placement and dependency rules, conventions, quality gates, test policy and verification tiers that every change follows

## decisions
- ARCH-1 [o] cosimosi is one pnpm workspace of peer apps, shared packages and one RPC contract; each app builds and ships on its own
  | root | holds | build |
  | ------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- |
  | `apps/web` | the web app, Feature-Sliced Design →~ARCH-21 | Vite → `apps/web/dist` |
  | `apps/mobile` | the React Native app, Feature-Sliced Design, with its own committed `ios/` and `android/` | Metro |
  | `apps/api` | the Go backend →~ARCH-5 | Go toolchain →~ARCH-46 |
  | `apps/blog` | the Astro blog, outside Feature-Sliced Design →~MKT-5 | staged into the web build →~ARCH-45 |
  | `packages/*` | cross-app modules →~ARCH-27 | consumed as TypeScript source (exports point at `src/`) |
  | `proto/` | the one RPC contract →~ARCH-15 | buf → Go and TS |
  - workspace members are `apps/web`, `apps/mobile`, `apps/blog` and `packages/*` (`pnpm-workspace.yaml`); `apps/api` is not a pnpm member
  - `.npmrc` sets `node-linker=hoisted` because Metro resolves modules from a flat `node_modules`; `apps/mobile/metro.config.js` adds the repo root to `watchFolders` and `nodeModulesPaths`
  - web and mobile are two separate React applications: mobile is never hosted inside the web build
- ARCH-2 [o] the stack per layer; exact versions live in each `package.json` and in `apps/api/go.mod`
  | layer | choice |
  | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
  | backend | Go 1.26 (module `github.com/cosimosi/api`), Connect RPC + Protobuf (buf), Postgres + pgvector, sqlc on pgx v5, goose migrations |
  | web | React 19, Vite 8, TypeScript 6, TanStack Router, Tailwind CSS 4 |
  | mobile | React Native 0.86 bare (Metro, New Architecture), React Navigation 7, Reanimated + Worklets |
  | 3D | three.js `WebGPURenderer` + TSL through R3F 9; `react-native-webgpu` on mobile →~ARCH-25 |
  | FE state | XState 5 for control state; Zustand 5, TanStack Query 5 and refs for data →~ARCH-24 |
  | blog | Astro |
  | copy | Paraglide (inlang) message functions →~CLIENT-22 |
  | auth | Supabase →~AUTH |
  | tooling | Node at or above the `engines` floor (CI pin `.node-version`), pnpm 10 (`packageManager`), Prettier, oxlint, ESLint, steiger |
  - a library is added or upgraded from its current official docs and scaffolders, never from memory
- ARCH-3 [o] mobile is a first-class React Native target built together with web, never web-first: web ships as open beta, mobile as MVP
  - a feature ships for web and mobile in the same work, sharing every pure layer through `packages/` and one TSL shader source
  - mobile MVP may reduce scope and polish (fewer post-FX, lower instance counts, deferred secondary features); the core loop and the 3D universe run on mobile, and the RN WebGPU renderer is in scope
  - `react-native-webgpu` is pre-1.0: exact version pin, New Architecture (RN ≥ 0.81), custom dev client (no Expo Go), render paths confirmed on a physical device because emulators fall back to a slow software adapter
  - mobile reuses the one shared stack: no parallel state, data, i18n or rendering library →~CLIENT-2
- ARCH-4 [o] one canonical name per concept in every layer (domain, DB, proto, FE): the domain model is the naming authority, and the vocabulary itself is the UL's →~UL
  - representation-specific casing, pluralization, request/response suffixes and generated-code naming are allowed; a synonym, abbreviation or second product word for an existing concept is not
  - guard `pnpm lint:language` (`scripts/lint-ubiquitous-language.mjs`) reads the vocabulary at runtime and fails a rendering word outside visual/UI paths, a modeled memory↔memory edge (→~INV-4) and a forbidden synonym; i18n catalogues are scanned for synonyms only
  - a false positive is fixed by narrowing a path allowlist, never by weakening the vocabulary
- ARCH-5 [o] the backend is domain-first Go: start with clear packages and split a package only when it earns it ← Clean Architecture control without Java-style ceremony
  - product terms live in the domain model, free of proto, sqlc, pgx, JSON/DB tags and transport concerns
  - DDD (bounded contexts, aggregates, value objects, domain services, use-cases) is a toolbox for the core context; thin supporting features stay thin
  - no ORM, no DI framework, no generic repository over sqlc; hand-written Go around sqlc is an adapter only when mapping, dynamic SQL, transactions or tests need one
- ARCH-6 [o] the backend is a small set of bounded contexts: one core domain, supporting contexts around it, external-service wrappers; `internal/platform` is shared infrastructure, not a context
  | kind | contexts |
  | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
  | core | `memory` →~MEM-1 |
  | supporting | `account`, `twinkle`, `store`, `achievement` |
  | operator console | `admin`: a standalone context reaching every other one only through its own consumer-owned ports; no product code calls it →~ADMIN |
  | external-service wrapper | `ai` →~AI |
  | platform, no business meaning | `platform`: config, db pool, rpc mux and server, ids, generated values, error contract, observability, auth seam |
  - a context that needs another depends on the producer's small published behavior (its exported use-case and port surface), never on its internals or tables →!ARCH-9
  - a context is created by the first feature that needs it
- ARCH-7 [o] a context starts as one readable package and splits by dependency direction only as a refactor that removes noise, import cycles, test pain or mixed IO/domain code
  | path | holds |
  | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
  | `apps/api/cmd/api`, `apps/api/cmd/worker` | composition roots →~ARCH-18 |
  | `internal/<context>/` | domain types and canonical names, behavior and use-cases, consumer-owned ports (`ports.go`) once a consumer exists |
  | `internal/<context>/pg/` | sqlc + thin pgx adapter, row↔domain mapping |
  | `internal/<context>/rpc/` | Connect handler, proto↔domain mapping, the context's error reasons |
  | `internal/<context>/domain/`, `internal/<context>/app/` | the split shape: pure model and domain services; use-cases and ports |
  | `apps/api/db/migrations`, `db/queries/<context>/`, `db/gen` | goose migrations; sqlc input per context; sqlc output, never hand-edited |
  - no empty package to satisfy a diagram; supporting contexts may keep the small shape forever
  - each context owns its tables and queries; a cross-context read goes through the owning context's published behavior, never its tables
  - package names read well at call sites: no generic `domain`, `app` or `service` name that forces aliases or hides the product concept
- ARCH-8 [o] dependencies point inward only: `rpc`, `pg` and SDK adapters → context behavior (`app` once split) → domain model, which knows neither
  - composition roots (`cmd/api`, `cmd/worker`) see everything and inject concrete adapters into the behavior that consumes them
  - ports are declared by the consumer, only once it consumes them (repository, external service, job queue); `pg` and wrapper packages return structs that satisfy them implicitly; no implementation-side interface just for mocking
  - proto types and sqlc rows are infrastructure: the handler maps proto↔domain and the pg adapter maps row↔domain; these two mappers are the anti-corruption boundary, and no proto or sqlc type crosses inward
  - domain logic never calls RPC, sqlc, pgx, SDK clients or framework code
- ARCH-9 [o] contexts never talk through an event bus: every cross-context edge is a composition-root adapter over a consumer-owned port, in exactly one of two shapes
  | shape | when | mechanism |
  | ----------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | shared-transaction port | the consumer's write must commit or roll back with the producer's fact | the producer transaction declares the consumer-shaped behavior it needs; its `pg` adapter receives a composition-root capability factory bound to that exact open transaction. No `any`, runtime DB assertion or persistence type crosses inward; an unbound capability fails closed |
  | idempotent pairing | the effect lands in another context's ledger or rows | commit in the owning context first, then call the other through its port keyed by a stable id (a claim id, a grant id), so a replay completes the effect and never doubles it |
  - generic job envelopes, storage and leases live in `platform/jobqueue`; producer contexts own job identities, payload validation and handlers, and composition roots explicitly register durable retry policy
  - split independent read/recording capabilities from payout and command services so the root constructs a complete dependency graph in order, without mutating a late-bound holder
  - a required port is never silently defaulted: a service refuses a nil collaborator at construction, and a deliberate no-op is an explicit named binding
  - both composition roots carry every leg they run: `cmd/api` serves requests and runs the dev worker, `cmd/worker` runs the job queue, the withdrawal sweep with every purge leg and the settlement drain
  - a seam bound in one root and forgotten in the other is invisible to a build, so `cmd/worker`'s test constructs its runner with every seam bound and `cmd/api` refuses to boot on wiring drift: a forgotten leg fails CI or the boot, never silently in production
  - the achievement edges follow these shapes →~ACH-15 →~ACH-21 →~ACH-30
- ARCH-10 [o] an entity with its own lifecycle is its own aggregate root; an entity shared by many is a separate root referenced by id through a membership or join, never owned, and no aggregate reaches into another's internals →~MEM-3
  - a relationship computable from stored data is never a domain type or source of truth; it may be materialized only as a rebuildable infrastructure projection (a weighted edge table) when performance, async derivation or query shape needs it →~INV-4
  - domain services are pure functions with no IO, so a client mirror and the server run the same math, pinned by golden parity →~ARCH-48
- ARCH-11 [o] persistence is raw SQL through sqlc on Postgres + pgvector, never an ORM ← the workload is vector similarity (HNSW), weighted-graph traversal and batched atomic weight upserts, which reward SQL control
  - sqlc generates the static queries from the migrations and `db/queries/**` into package `dbgen` (`apps/api/sqlc.yaml`); a thin pgx layer handles only genuinely dynamic SQL (runtime hop count or sort)
  - `<context>/pg` is the only context package that touches sqlc or pgx; no sqlc row escapes into behavior or the domain
  - `internal/platform/db` owns the pool (`ConfigFromEnv` reads `DATABASE_URL`, `Open`, `InTx`); with `DATABASE_URL` unset the API boots with the platform service only, so `/health` never depends on the database
- ARCH-12 [o] schema changes are goose migrations `apps/api/db/migrations/NNNNN_<name>.sql`, forward-only safe, each with a `-- +goose Down` section; the task that adds a schema owns its migration
  - run only through `pnpm db:migrate`, `db:status`, `db:down`, `db:reset` (`scripts/db.mjs`: compose `postgres` up, goose in Docker); `COSIMOSI_MIGRATION_DATABASE_URL` overrides the target
  - tables and columns carry canonical domain names →~ARCH-4; a closed set is a domain-owned `TEXT` column, never a Postgres enum
  - a fresh database runs `pnpm db:migrate` before anything reads it
- ARCH-13 [o] every product row carries an owned `user_id`, and every product statement is scoped to the authenticated user →!ACCT-1
  - the scope is `platform.UserScope`, taken from the auth interceptor's context; persistence methods require it, and a cross-user query is not allowed by default
  - RLS is deferred; schema and query design must not block adding it
  - guard `pnpm lint:persistence` (`scripts/check-persistence-isolation.mjs`): a product `CREATE TABLE` declares an owned `user_id` (a foreign key, CHECK or `*_user_id` lookalike does not count); every product statement's relations reach a `user_id` parameter through conjunctive equality (alias- and CTE-aware; an OR disjunct is no scope; unsupported SQL fails closed)
  - exemptions are named one by one in the gate beside the reason they cross users: platform tables (admin console operator state, anonymous mood-colour counts) and deliberately global statements (job claim and purge, payment dedup, admin batch reads) →~ADMIN
  - the same gate holds the hard-delete allowlist: product rows are deleted only by named release, withdrawal-purge and queue-maintenance statements →~INV-1
  - `internal/persistenceprobe` pins the shape without product tables: a consumer-declared store, implemented in `pg`, that refuses to run without a `UserScope`
- ARCH-14 [o] the backend mints every aggregate id: `TEXT` primary keys from `platform.NewID` (16 random bytes, hex), the same shape as request ids; a client never creates an aggregate's identity
  - the only client-minted identifiers are idempotency keys: a paid action's `operation_id`, and the admin grant id that keys `admin_stardust_grants`
  - timestamps are stored UTC and shown in the user's zone; universe dates are UTC-day values →~TIME-7
- ARCH-15 [o] transport is Connect RPC + Protobuf, and `proto/` is the single contract for the Go server and both TS clients
  - one buf module (`proto/buf.yaml`, template `proto/buf.gen.yaml`) with one package per backend context, `cosimosi/<context>/v1`; `pnpm gen:proto` writes Go to `apps/api/internal/gen` and TS to `packages/api-client/src/gen` plus `service-descriptors.gen.ts`
  - proto is the DTO layer: messages carry canonical domain terms →~ARCH-4, and the domain never sees a proto type →~ARCH-8
  - `@cosimosi/api-client` has no DOM, Vite or Metro dependency; the transport is created at app composition, never as a global client inside a slice, so auth, cache, flags and tests can replace it
  - `PlatformService.Ping` proves the transport only and never becomes a product API
- ARCH-16 [o] every RPC is unary: no server streaming, websockets, subscriptions or client polling ← React Native has no server streaming
  - high-frequency client-local events persist as a debounced, idempotent unary batch whose server-recorded `batch_id` prevents double counting
  - slow results reach the client on its next read →~ARCH-19
- ARCH-17 [o] a read RPC is a unary method marked `idempotency_level = NO_SIDE_EFFECTS` and travels as HTTP GET; every mutation stays POST
  - GET eligibility never makes a response shared-CDN cacheable: authenticated reads use the private user-scoped GET policy
  - every `NO_SIDE_EFFECTS` method is classified exactly once in the client RPC cache-policy registry (`packages/client-cache/src/http-policy.ts`); the transport refuses a missing, duplicate or proto-incompatible classification before any I/O →~CLIENT-5
- ARCH-18 [o] the API composes in one place: `cmd/api` wires config, adapters and services into `platform.NewHTTPServer`, one `net/http` mux with h2c and CORS where every Connect service mounts through `WithRPCService` behind one shared interceptor chain
  - only `/health` and `/` are hand-routed; route and service registration stay visible at the composition root
  - interceptor chain, outermost first: panic recovery → request id → structured errors → logging → auth → withdrawn-account scope (once product services mount) →~OBS-5 →~OBS-6 →~AUTH-10 →~ACCT-23
  - handlers are thin: map proto↔domain and call the use-case; policy lives in context behavior or the domain
  - `internal/platform` is transport-only infrastructure with no domain, use-case or product dependency
  - CORS origins default to the local web and Metro dev servers and are replaced by `COSIMOSI_CORS_ORIGINS`
- ARCH-19 [o] a write that triggers slow work persists, returns its id and enqueues a job in its own transaction; a background worker runs the work, and the result surfaces on the client's next read →~AI-31
  - the queue is the `jobs` table: claims use `SELECT … FOR UPDATE SKIP LOCKED`, retries back off exponentially through `next_run_at` →~AI-34
  - the worker is its own process (`cmd/worker`); the dev API may run it in-process (`COSIMOSI_DEV_WORKER=1`)
  - the client renders optimistically from the returned id; no polling, no streaming
  - an external service sits behind a consumer-owned port with a keyless mock fallback injected at the composition root, cost-metered (per-call caps, caching, daily and monthly limits); a new provider slots in behind the same consumed behavior →~AI-14 →~AI-25
- ARCH-20 [o] forbidden backend patterns, numbered for review citations
  | # | forbidden | rule |
  | --- | ----------------------------------------------------------------------------------------------------------------- | --------- |
  | 1 | renaming a concept across layers | →=ARCH-4 |
  | 2 | packages for a diagram: empty `domain`/`app`/`infra` folders, pass-through services, interfaces no consumer needs | →=ARCH-7 |
  | 3 | a computed relationship as domain source of truth | →=ARCH-10 |
  | 4 | sqlc rows or proto types inside domain or context behavior | →=ARCH-8 |
  | 5 | an ORM or a hand-rolled generic repository over sqlc | →=ARCH-11 |
  | 6 | an interface declared at the implementation | →=ARCH-8 |
  | 7 | business logic in an RPC handler | →=ARCH-18 |
  | 8 | client-derivable state (layout coordinates) stored as server-authoritative | →=ARCH-31 |
  | 9 | high-frequency events as server streaming | →=ARCH-16 |
- ARCH-21 [o] the frontend is Feature-Sliced Design, applied identically by web and mobile: six layers `app → pages → widgets → features → entities → shared`, and a slice imports only lower layers
  | layer | role | one-line test |
  | ---------- | ----------------------------------------------------------------- | ------------------------------ |
  | `app` | composition: providers, routing, global style | wires the app together |
  | `pages` | a route or screen composing lower layers, holding no domain logic | a URL lands here |
  | `widgets` | a large self-contained block reused across pages | a big chunk a page drops in |
  | `features` | one user-facing action, named by its verb | a verb the user does |
  | `entities` | a domain object mirror, or its visual projection →~ARCH-26 | a noun the product talks about |
  | `shared` | domain-agnostic reuse | no domain word in it |
  - same-layer cross-import is forbidden; the one exception is `entities` → `entities` through the target's `@x` public API (`entities/A/@x/B.ts`), and an `@x` file reaches only its own slice
  - each slice exposes one `index.ts`; no wildcard barrels
  - guards: web `steiger --fail-on-warnings` and `eslint-plugin-boundaries`, mobile `eslint-plugin-boundaries`; each app's boundary probe proves a forbidden reach fails
  - slices are created per feature and promoted on reuse, never pre-built
- ARCH-22 [o] the non-sliced layers are segmented by technical role, never flat
  - `app` segments are a closed set: `providers`, `routes` (web) or `navigation` (mobile), `model`, `styles`; the router segment's name is per platform, and neither app borrows the other's
  - the `app` root holds only `App.tsx`, `main.tsx`, `index.css`, `index.ts` and their co-located tests
  - mobile `app/navigation/screens` holds exactly two neutral app-shell surfaces, the boot shell and the provider-health diagnostics screen (no product data); product composition lives in `pages`, and a third surface needs the same argument in writing
  - `shared` is segmented too (`ui`, `lib`, `i18n`, `config`; mobile also `native`, `testing`), without a lint-enforced closed set
  - guard `pnpm lint:fsd:layout` (`scripts/lint-fsd-layout.mjs`) checks directories as well as loose files
- ARCH-23 [o] inside a slice, files group by technical role into segments; generic folders (`components`, `hooks`, `utils`, `helpers`, `types`, `constants`, `misc`) are forbidden
  | segment | holds |
  | -------- | --------------------------------------------------------------------------------------------------- |
  | `ui` | React and R3F components, shader bindings: the only platform-aware code (`*.native.tsx` lives here) |
  | `model` | types, Zustand stores, XState machines, pure slice logic |
  | `api` | backend calls and proto→domain mappers for the slice |
  | `lib` | slice-internal helpers |
  | `config` | slice-local constants; tuning numbers follow →~ARCH-32 |
  - placement order: a domain noun or its rendering → `entities/<domain>` or `entities/<visual>`; a user action → `features/<verb>`; a big self-contained block → `widgets`; a whole screen → `pages`; domain-agnostic and reused → `shared`, or `packages/` when pure and cross-app; then the segment
  - when two slices need the same thing it moves down a layer, never copied sideways
  - naming: kebab-case slices, PascalCase component files, camelCase or kebab-case elsewhere, named exports only (the `App` entry is the one default export)
- ARCH-24 [o] control state lives in XState v5 machines, data in Zustand, TanStack Query and refs ← an interaction-rich, navigated app, not a form app
  - control state is the exclusive modes, phases, lifecycle and selection ("one of N"); machines are pure TS in `model/<name>.machine.ts`
  - data (collections, the graph, caches, coordinate buffers) never enters machine context: id references only
  - per-frame loops read machines through `getSnapshot()` in `useFrame` and per-frame values through refs, never React state (no 60 fps re-renders)
  - the machine catalog and its React binding →~CLIENT-14
- ARCH-25 [o] rendering is R3F 9 + three.js `WebGPURenderer` (automatic WebGL2 fallback) with shaders written once in TSL for web and mobile ← the workload is a force-directed graph of many instanced nodes and fat-line edges updated every frame
  - post-processing goes through three's node pipeline; instancing and batching come first: one `InstancedMesh` or one batched camera-facing ribbon per body kind, never three's `Line2` →~VIS
  - layout simulation stays off the render path: `@cosimosi/force-sim` is a pure `tick(dt)` module (Barnes-Hut); web runs it in a module Web Worker, mobile inline on the JS thread behind the same `SimWorkerSpawner` seam, since React Native has no Worker primitive →~VIS-18
  - the renderer only reads coordinates into instance matrices and uniforms, never drives frames from React state →~ARCH-24
  - visual bodies come through an asset-source port (shader, glTF …), so the domain never imports a renderer
  - three and R3F are imported only through `@cosimosi/3d-renderer`, never in an app slice; the guard is web-only today (`no-restricted-imports` in `apps/web/eslint.config.js`; mobile's `.eslintrc.js` has no such rule) →~VIS-20
  - TSL is the only shader language; the renderer package, shader toolkit and visual rules →~VIS-21 →~VIS
- ARCH-26 [o] the domain → visual projection is the FE anti-corruption boundary: the rendering layer is the only place domain and visual vocabulary meet
  - domain-mirror entities mirror transport and domain types and know nothing of three.js; their `api` segment maps proto → FE domain, mirroring the backend handler
  - rendering entities import a domain-mirror entity through `@x` and project it to a visual body; the projection is one-way, so visual words never travel back into domain slices or API mappers
  - what the domain treats as emergent stays emergent: rendered, never modeled →~INV-5
- ARCH-27 [o] `packages/` is the cross-app core: one job and one home per package, consumed by web and mobile from the start, so pure code is written cross-platform into a package directly, never built web-first and extracted later
  | role | packages |
  | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
  | generated config | `config` →~ARCH-32 |
  | transport and cache | `api-client` (generated client, service descriptors), `client-cache` (Query defaults, keys, optimistic helpers, RPC cache policy) |
  | platform seams | `auth`, `errors`, `i18n`, `observability`, `state-machine` |
  | design system | `ui` →~UI |
  | FE domain mirrors: types, stores, IO, React seams | `emotion`, `memory`, `universe`, `twinkle`, `store`, `achievement` |
  | deterministic domain logic mirrored in Go | `memory-logic`, `twinkle-logic`, `emotion` →~ARCH-48 |
  | layout and rendering | `force-sim`, `3d-renderer`, `universe-render` →~VIS |
  | guided runs | `sequence`, `onboarding` →~ONB, `demo` →~DEMO |
  - a pure package has no Vite, Metro, DOM or native dependency; React enters only through an explicit seam entry (`react.ts`, `./react`)
  - `@cosimosi/ui` and `@cosimosi/3d-renderer` are the platform-aware packages: each exports a `react-native` entry (`src/index.native.ts`) and keeps its forks inside the package
  - engine substrate (the memory mirror, emotion model, plasticity, force-sim, universe clock) is built inside the first feature that needs it, then promoted down into a package on reuse, never copied sideways
- ARCH-28 [o] web↔mobile parity means shared packages plus a forked `ui`: `apps/mobile` mirrors `apps/web` with the same layers and slice names, and `model`, `api` and all of `packages/` are shared verbatim
  - `ui` is shared by default (the web is responsive and mobile mirrors it); a `*.native.tsx` sibling exists only where a primitive genuinely differs: DOM ↔ RN `View`/`Text`/gesture, web router ↔ RN navigation, the `<Canvas>` host wiring, auth token storage
  - a `*.native` file that restates its web sibling is drift: delete it and share
  - native plumbing (the navigation root, `metro.config.js` mapping `three` to its WebGPU build, `babel.config.js`, native modules, `ios/`, `android/`) lives in `apps/mobile` only
  - guard: a normalized-equivalent pure module at the same relative path in both apps (`api`, `model`, `lib`, `config`, `shared`, `app/providers`, `app/model`) fails `pnpm lint:fsd:layout` until promoted to its package; identifier-only renames and comment or format churn do not evade it
  - a `ui` file joins that comparison when it carries no platform marker (a React Native or `react-dom` import, a DOM global, a lowercase JSX intrinsic) and holds more than a wiring shell
- ARCH-29 [o] parity is per surface: every user surface ships on both apps unless a waiver is written here ← `lint:fsd:layout` does not check page peering, so an unwritten waiver would go unnoticed
  | surface | web | mobile | waiver owner |
  | ----------------------- | --- | ------ | --------------------------- |
  | landing page | yes | no | →=MKT-26 |
  | blog and its miss route | yes | no | →=MKT-26 |
  | demo page | yes | no | →=DEMO-35 |
  | admin console | yes | no | an operator surface →~ADMIN |
  - a platform fork of one surface (web `<aside>` or `Dialog`, mobile bottom sheet) is parity, not a waiver
  - headless units (models, use-cases, the engine half of the sequence engine) carry no parity question: they are shared by construction
- ARCH-30 [o] a `*.native` fork owns its own test suite: where it constructs, starts and must tear down something (an `Animated.loop`, a native-driver animation), the suite asserts the teardown ← the two arms fail differently, and a `useNativeDriver: true` loop registers no JS timer, so the mobile Jest guard cannot see its leak
- ARCH-31 [o] derived state, not stored state: a value that varies continuously with time is computed at read time from the last event's timestamp, never written per tick; only discrete events persist
  - the server stays authoritative over source data; anything derivable from it (appearance, layout coordinates) is a pure function and is never stored as authoritative →~INV-5
- ARCH-32 [o] tuning numbers are build-time config: `spec/values.yaml` → `pnpm gen:values` → TS `VALUES` (`@cosimosi/config`, `packages/config/src/values.gen.ts`) and Go constants (`apps/api/internal/platform/values/values_gen.go`); never hardcoded, never mutated at runtime ← FE and BE must not drift
  - docs and code cite a value by its key (`twinkle.small_daily_amount`), never restate it
  - a constant exactly one module reads and no other surface tunes may stay a named constant beside its reader (`UNIVERSE_TIME_ACCELERATION`, the blog's `FEED_LIMIT`); it becomes a key once a second surface reads it
  - no runtime remote config
- ARCH-33 [o] a number belongs in `values.yaml` only when it is product behavior or cache policy that must hold identically across processes and builds
  - in: coefficients, thresholds, caps, defaults, debounce and delay windows that shape behavior, numeric arrays for deterministic calculations, stable id → value maps a product rule owns
  - out: runtime environment, deployment config, URLs, DSNs, API keys and secrets →~ARCH-50; feature flags →~OBS-9; proto and SQL schema; formulas, which are code; UI copy, locale data, design tokens, theme CSS, mood-colour content tables; array lengths derivable from the array
  - deployment-shaped network and lifecycle budgets (HTTP client timeouts, shutdown windows) are named constants at each `cmd/*` composition root, injected into the adapter they bound; a capability-wide client never overrides another provider's SDK policy
  - protocol and structural safety bounds (vendor response byte caps, bounded error-body drains, fixed vector shapes) sit beside the protocol code with an invariant comment
- ARCH-34 [o] `values.yaml` groups are closed and keys inside a group are open: a change may add a key to a group its domain owns, while a new group is an ARCH change
  | owner | groups |
  | ------ | ---------------------------------- |
  | CLIENT | `client_cache` |
  | ERR | `errors` |
  | AUTH | `auth_session`, `supabase_auth` |
  | ACCT | `account` |
  | VIS | `rendering`, `nebula`, `force_sim` |
  | UI | `ui` |
  | AI | `ai`, `worker` |
  | MOOD | `emotion`, `palette` |
  | ENC | `encode` |
  | LINK | `synapse` |
  | CONSOL | `semantic`, `consolidation` |
  | RECALL | `reconsolidation` |
  | FORGET | `forgetting` |
  | TWINK | `twinkle` |
  | DECOR | `store` |
  | ACH | `achievement` |
  | ADMIN | `admin` |
  | DIARY | `diary_reader` |
  | DEL | `deletion`, `release` |
  | ONB | `sequence` |
  | DEMO | `demo` |
  | MKT | `landing` |
  - a catalog row is never a value: ornament definitions and prices, achievement conditions and rewards are content kept as Go tables in their context; a row names a tier, and `values.yaml` holds that tier's number →~DECOR-13 →~ACH-2
  - groups and keys are stable once shipped, because they generate public constants FE and BE import
- ARCH-35 [o] `values.yaml` schema: snake_case groups, keys and map keys (generated as camelCase TS keys and PascalCase Go constants); a value is a finite number, a non-empty numeric array, a string, or a non-empty one-level map whose values are all numbers or all strings
  - `pnpm gen:values` fails with a `values.yaml: …` error on empty YAML, non-finite numbers, bad casing, generated-name collisions, empty or nested arrays and maps, and mixed-type maps (`scripts/gen-values.test.mjs`)
  - output is deterministic and formatted; generation skips only while the file does not exist
- ARCH-36 [o] code, identifiers and code comments are English (a comment may quote a Korean product term or copy); user-facing copy goes through i18n message functions (`m.*`), never a raw literal →~CLIENT-22
  - guard `pnpm lint:raw-strings`; its scope and opt-out →~CLIENT-28
- ARCH-37 [o] formatting is mechanical: Prettier (single quotes, no semicolons, trailing commas, width 100) for TS, JS, JSON, Markdown, YAML, CSS and HTML; `gofmt` for Go
  - generated output, lockfiles and `spec/**/*.md` (owned by `spec/FORMAT.md` and the spec CLI) are Prettier-ignored; `.astro` files have no Prettier parser here, so `format:check` skips them
  - `lint-staged` formats staged files in the pre-commit hook; `pnpm format:check` and `pnpm lint:api` fail unformatted code
- ARCH-38 [o] a commit is one small semantic unit staging only its own files, with the subject `type(scope): <English title>`
  - types: `feat`, `fix`, `refactor`, `docs`, `chore`; the scope names the area touched (`universe`, `demo`, `account`, `gates`)
  - the body says why the change is right
- ARCH-39 [o] a comment explains the code in front of the reader, never process or history: a non-obvious invariant, a platform constraint, a boundary rule, a reason the code must be this way ← narrated history goes stale the moment the code moves
  - forbidden: "changed from", "renamed from", "used to be", "formerly", "previously was"; plan, job, change, review, task or finding numbers; bare numeric doc anchors (`[64]`); dated notes; TODOs that tell a story; decision logs
  - a rule is cited by its decision ID (`ARCH-39`, `TWINK-4`) or its legacy requirement ID (`[G4]`, read through `spec/FORMAT.md`); traceability beyond that needs a dedicated mechanism, never prose
  - a comment that only makes sense to someone who watched it being written is deleted
  - guard `pnpm lint:comments` (`scripts/lint-comment-history.mjs`) scans `apps/web/src`, `apps/mobile/src`, `apps/api`, `packages`, `proto` and `scripts` plus root and app-root config files; `.proto` comments matter most because they propagate verbatim into generated code; tests, stories, fixtures and generated output are exempt
  - its patterns stay high-confidence, because a false positive fails all of `pnpm lint`
- ARCH-40 [o] `pnpm check` is the one full local gate, running every non-deployment validation in the order `check:node` → `lint` → `typecheck` → `test` → `build:site` → `vet:api` → `build:api` → `check:gen`
  - CI runs this same command rather than a re-split of it, so a gate added to `pnpm check` reaches CI in the same commit with no workflow edit
  - `pnpm test` covers the values generator fixtures, `test:guards`, every package, web and mobile suite, and the Go suite (`test:api`)
  - no gate needs production secrets, and no gate boots an emulator or a device; on-device render confirmation stays manual →~ARCH-3
- ARCH-41 [o] `pnpm lint` chains every static gate, one rule per command
  | command | fails when | rule |
  | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
  | `check:node` | Node or the `.node-version` pin is below the `engines` floor, or a declared `workspace:` dependency is not installed | →~ARCH-2 |
  | `format:check` | a file is not Prettier-formatted | →~ARCH-37 |
  | `lint:web` | oxlint, steiger, ESLint boundaries or React-hooks diagnostics report anything, or the web boundary probe fails | →~ARCH-21 |
  | `lint:mobile` | ESLint, boundaries included, reports anything, or the mobile boundary probe fails | →~ARCH-21 |
  | `lint:packages`, `lint:packages:probe` | the shared flat config `eslint.config.packages.mjs` reports anything over `packages/**` | →~ARCH-42 |
  | `lint:fsd:layout` | an app-layer segment, root file or mobile screen leaves its allowlist, a generic folder appears, or a pure module is copied across apps | →~ARCH-22 →~ARCH-28 |
  | `lint:api` | `gofmt` is not clean | →~ARCH-37 |
  | `lint:observability` | a vendor telemetry SDK is imported outside its boundary file | →~OBS-1 |
  | `lint:language` | the vocabulary drifts | →~ARCH-4 |
  | `lint:raw-strings` | user-facing copy is a raw literal | →~ARCH-36 →~CLIENT-28 |
  | `lint:style-escapes` | a product slice hardcodes a colour or geometry literal | →~UI-31 |
  | `lint:persistence` | a product table or statement escapes user scope, or a hard delete is not allowlisted | →~ARCH-13 |
  | `lint:spec` | `spec/` holds anything outside the `spec/FORMAT.md` layout, or a skill link is broken | `spec/FORMAT.md` |
  | `lint:comments` | a comment narrates process or history | →~ARCH-39 |
  | `lint:public-copy` | public copy overclaims | →~MKT-9 →~INV-12 |
  | `lint:error-reasons` | a wire reason is missing from the FE union or the reason registry | →~ERR-13 |
  | `lint:test-reachability` | a test-shaped file is collected by no runner | →~ARCH-48 |
- ARCH-42 [o] gates fail loudly: a green exit never coexists with warnings or lifecycle noise, and no gate stays green through force-exit or suppression
  - linters reject warnings: `oxlint --deny-warnings`, `eslint --max-warnings=0`, `steiger --fail-on-warnings`
  - the mobile Jest harness (`apps/mobile/jest.guards.js`) fails a test on an unexpected `console.error` or `console.warn` (a test expecting output owns it with a spy) and a suite that leaves a long-lived timer pending
  - a gate's scope is part of its rule: each scanner names its roots, and code outside every root is unguarded; `packages/**` has its own ESLint pass because the app linters never see it
  - React-hooks rules are errors, `exhaustive-deps` included, on `apps/web/src` and on the package React seams (`react.ts(x)`, `react/**`, `packages/ui`, the scene packages `3d-renderer` and `universe-render`)
  - rule exemptions are ratchets: `react-hooks/refs` and `react-hooks/set-state-in-effect` are off only for a named file list that may only shrink; `react-hooks/immutability` is off only in the two scene packages, whose per-frame mutation of preallocated objects is the renderer's design
  - the React Compiler runs as diagnostics only; its build transform stays off until locale is a React input, because copy reads `m.*()` against a module-global locale and a memoized component would keep its first language
- ARCH-43 [o] every guard proves it bites: a scanner ships a negative probe in `pnpm test:guards` showing the rule fires and that its allowlist spares only what it names ← a rule nobody has seen fail is a rule nobody knows is wired
  - liveness anchors assert that allowlisted boundary files still contain what the guard looks for
  - each boundary probe also asserts the gate wiring: the app's lint chain still runs the scan over the whole `src/**`
  - probes are hermetic: fixtures live in a throwaway `.probe-ws-*` workspace under the app root (`scripts/probe-workspace.mjs`, linted with the app's own config) or in memory, never in a scanned root
  - every ordinary scanner excludes `**/.probe-*/**` and `**/__boundary_probe_*/**` (both gitignored); `scripts/probe-hermeticity.test.mjs` proves an overlapping probe and lint both stay green while a violation at a real path still fails
- ARCH-44 [o] generated code is committed, never hand-edited, and kept fresh: `pnpm check:gen` runs `pnpm gen` and fails when any generated path changes
  - `pnpm gen` order: values → Paraglide messages → design-token CSS → buf → sqlc, so later outputs can depend on earlier ones
  - generated paths: `apps/api/internal/gen`, `apps/api/db/gen`, `apps/api/internal/platform/values/values_gen.go`, `packages/**/gen/**`, `packages/**/*.gen.{ts,tsx,css}`
  - a generator skips cleanly only while its input does not exist; once it exists, invalid input fails
  - `scripts/gen-mobile-env.mjs` stays outside `pnpm gen`: its source is the local gitignored `.env`, and its committed default keeps CI building without one
- ARCH-45 [o] the production frontend build is the gate's build: `pnpm check` builds through `pnpm build:site`, the same command deployment runs, and `build:web` or `build:blog` alone never stand in for it →=MKT-27
- ARCH-46 [o] the codegen and migration toolchain runs only in Docker through the pnpm scripts, each tool a pinned image: buf (`pnpm gen:proto`), sqlc (`pnpm gen:sql`), goose (`pnpm db:*`) ← one command surface on every host, including Windows hosts whose Application Control blocks user-dir binaries
  - Go gates run through `scripts/go-check.mjs` (`pnpm lint:api`, `vet:api`, `test:api`, `build:api`, `check:api`): a host `go` when present, otherwise the same commands in `golang:1.26` with `apps/api` mounted; the fallback is the same gate, not a weaker one
  - the Go version moves together in `apps/api/go.mod`, the `golang:1.26` image and CI `setup-go`
  - `pnpm test:api` runs `pnpm db:migrate` first and points the Go suite at the compose Postgres
- ARCH-47 [o] verification runs in three tiers: task (fast, before each task commit), batch (the full gate once on the final candidate), CI (once per code push)
  - task, before each done commit: `pnpm lint` `pnpm -r --filter "...[${HAERAM_DIFF_BASE:-HEAD}]" typecheck` `pnpm -r --filter "...[${HAERAM_DIFF_BASE:-HEAD}]" test`
  - batch, before code push or final completion: `pnpm check`
  - CI, after code push: the `CI` workflow (`.github/workflows/ci.yml`) job `check` on every push and pull request to `main` and `develop`: `pnpm install --frozen-lockfile`, then `pnpm check`, with Node from `.node-version` and Go 1.26 from `setup-go`
  - the task tier's filter selects every workspace package changed since the task start and every package depending on one (`git diff` sees modified and staged files, not untracked ones); Go is outside the pnpm workspace
  - a change under `apps/api/` or `proto/` adds `pnpm check:api` to the task tier (gofmt, vet, the Go suite against the local compose Postgres, build)
  - a change under `scripts/`, to an ESLint, oxlint or steiger config, or to a probe adds `pnpm test:guards` to the task tier
  - a change to a generator input (`spec/values.yaml`, `packages/i18n/messages/`, `packages/ui/src/tokens.ts`, `proto/`, `apps/api/db/`) runs `pnpm gen` and commits the regenerated output with it
  - `pnpm lint` plus per-package tests never stands in for the full gate: it misses the root guard probes (`pnpm test:guards`), the site build, Go vet and build, and generated-code freshness, which `pnpm check` and CI run
  - every commit also passes the husky pre-commit hook: `lint-staged`, `pnpm lint`, the web production build
  - the batch gate needs a running Docker daemon, since the Go suite uses the compose Postgres and buf, sqlc and goose run in Docker →~ARCH-46
  - one owner runs the batch gate: the coordinating or standalone session, on the final integrated candidate; worker and review sessions run the task tier only and hand the rest off
- ARCH-48 [o] tests are a default obligation: every task's acceptance names the tests it adds or changes, and no ARCH decision exempts a kind of change from them
  | surface | runner | expected |
  | -------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | a pure domain function mirrored in Go and TS | `go test` + Vitest | golden parity: one fixture `apps/api/internal/<context>/testdata/*golden*.json`, regenerated only by the Go suite (`UPDATE_GOLDEN=1`) and asserted by the TS mirror's suite |
  | Go behavior, adapters, handlers, composition roots | `go test` | `_test.go` beside the code; SQL paths run against the compose Postgres and skip without `COSIMOSI_TEST_DATABASE_URL` or `DATABASE_URL` |
  | `packages/*` | Vitest | `*.test.ts(x)` beside the module |
  | `apps/web` | Vitest | `*.test.ts(x)` beside the slice code |
  | `apps/mobile` | Jest with the RN preset and `jest.guards.js` | `*.test.ts(x)` beside the slice code; every `*.native` fork its own →~ARCH-30 |
  | gate scripts | `node --test`, `--probe` | a negative probe in `pnpm test:guards` →~ARCH-43 |
  - a headless domain or use-case unit is verified by automated tests first; a `/test` panel is optional browser inspection →~ARCH-49
  - runners collect by filename (`*.test.*`, `*.spec.*`, `__tests__/`); `pnpm lint:test-reachability` fails a test-shaped file that nothing collects, such as a `*.probe.ts` inside an app
  - a suite that builds a TanStack `QueryClient` sets `retry: false` and `gcTime: Infinity` (`createClientCacheTestContext`), so a read still failing at teardown schedules no gc timer that holds the runner open
  - suites run on doubles, never production secrets: fake auth, mock transport, in-memory telemetry →~OBS-12
  - a test is classified by its isolation and dependencies, not its script name; running a DB-backed or full suite in the batch tier is never an exemption
- ARCH-49 [o] dev diagnostics surfaces are not product UI: web `/test` (a typed panel registry) and the mobile `test` deep link and diagnostics screen are never linked from product navigation and carry no product behavior
  - web dev builds always reach them; a production build and mobile reach them only while `platform.diagnosticsSurface` is on →=OBS-10
  - web `/test` renders inside the full app provider stack; a panel declares `id`, `titleKey`, optional `descriptionKey`, `requiredCapabilities` and `render`; duplicate ids fail before render, and a panel whose capability is absent shows the standard unavailable state
  - a new panel is an entry in `apps/web/src/pages/test/model/registry.ts`, never a rewrite of the route shell
  - panels and their suites run on fakes (`createTestHarnessFakes()`: `FakeAuthAdapter`, `createClientCacheTestContext`)
  - web panel titles and descriptions are message keys and panels use `@cosimosi/ui` primitives; the mobile showcase's captions are dev data outside the product catalogue
- ARCH-50 [o] deployment and live infrastructure are owned by `DEPLOY.md` (hosting, domains, pipelines, secret names and locations, rollback, rebuild from scratch); spec documents never restate them
  - secret values are never committed; runtime configuration (ports, URLs, DSNs, keys, CORS origins, dev toggles) lives in `.env` or the deploy environment, and local keys are documented in `.env.example`
  - the frontend deploy builds with `pnpm build:site` →~ARCH-45
- ARCH-51 [o] the local loop runs from the repo root: `pnpm setup` (`.env` from `.env.example`, then install), then `pnpm dev` (web on Vite, the API and Postgres in Docker Compose); mobile runs with `pnpm dev:mobile` and `pnpm ios` or `pnpm android`
  - `pnpm infra:up` and `pnpm infra:down` start and stop the compose stack; a fresh database needs `pnpm db:migrate` →~ARCH-12
  - the dev sign-in bypass and its seeded universe →~AUTH-15
- ARCH-52 [o] no multi-user real-time collaboration: social features are async, one-way and deferred →~SOCIAL-3

## flow
- change: edit → task tier(`pnpm lint`, affected typecheck and tests, conditional gates) → commit(pre-commit hook) → batch `pnpm check` on the final candidate → push → CI `pnpm check`
- request: client transport(cache policy, request-id interceptor) → mux(CORS, request-id middleware) → interceptor chain → handler(proto→domain) → use-case(consumer-owned ports) → pg adapter(row↔domain) → Postgres

## constraints
- ARCH owns no `values.yaml` group
- the `be-architecture`, `fe-architecture` and `mobile-architecture` skills are procedures over these decisions, never a second source of their rules

## chg

- r2 261102 ARCH-9✎ opaque DB assertions and late-bound holders→typed transaction behaviors and independently constructed read/recording capabilities ; queue producer ownership stays with each context
- r1 261102 initial
