# Rendering (as-built)

As-built rules for the 3D rendering substrate (built by [plan/14](../plan/14.rendering-foundation.md) /
[job/17](../jobs/17.rendering-foundation.md)). Owner doc for renderer/shader/skin rules; other docs reference it.

> **Status.** Web is built and verified (typecheck · lint · test · build). Mobile is wired and verified at the
> source-gate level (typecheck · lint · test · `pod install`); the **on-device/simulator render is pending
> verification** — run `pnpm ios` (this is the one thing CI can't see). The 3D scene, shader toolkit, and skins are **shared
> verbatim** across web and React Native — only the native _build setup_ forks, not the code.

## The package — `@cosimosi/3d-renderer`

A **platform-aware** package (like `@cosimosi/ui`): it owns `three` + `@react-three/fiber` (peer deps) and is the
single 3D library both apps consume. The exports map forks only the entry — `react-native` → `src/index.native.ts`,
default → `src/index.ts` — and `index.native.ts` re-exports the web entry (the code is shared; only the _build setup_
differs on native). Slices import `@cosimosi/3d-renderer`, never `three` directly.

```
packages/3d-renderer/src/                                                              GENERIC core (names no concrete bg)
├── shader-art/   noise · field · pattern · finish · sdf · geometry (+ tsl helper)  — pure TSL building blocks
├── layers/       Background (node) · StarField · CameraControls (demo orbit) · PostFX (bloom)  — type-agnostic R3F layers
├── canvas/       UniverseCanvas (web R3F + WebGPURenderer)                          — the only platform-forked surface
├── asset-source · skin-context · SkinProvider                                       — §3.4 port + skin seam
├── assets/       CONCRETE looks (use the core; depend on it, not vice-versa)
│   ├── backgrounds/  nebula · gradient (each: Props + node-builder) + registry (BackgroundSpec + resolveBackgroundNode)
│   ├── skins/        presets (typed instances: {background:{type,props}, bloom, camera})
│   └── UniverseScene composition: resolves the bg node + wires the layers
└── index.ts / index.native.ts / jsx-elements.ts
```

### Shader-art toolkit (the composable effect library)

Domain-agnostic procedural TSL techniques, two families: **effects** (`noise` fbm/worley/ridged · `field`
domain-warp/polar/kaleido/log-spiral · `pattern` cell-edge/iso-line/contour · `finish` fresnel/iridescent → color/mask
nodes) and **objects** (`sdf` · `geometry` → forms). Each is a pure node-in/node-out builder — no material, uniform,
React, or DOM. Skins **compose** these into a look. Authoring is **TSL only** (transpiles to WGSL + GLSL) — never raw
GLSL — so one source serves web + native. (Rich artistic layering/mixing is later product work; the foundation makes
the effects library-shaped.)

### Backgrounds, skins, and the registry

A background is a **typed** thing. Each **background type** owns its own props shape **and** its own TSL node-builder,
paired in a discriminated union (`BackgroundSpec`) and dispatched by **one registry** — `resolveBackgroundNode(spec)`
(`assets/backgrounds/`: `nebula` + `gradient` today; adding a type = its module + one registry case — no layer/host/seam
change). A **skin** is a _typed instance_ of non-domain ambiance: `UniverseSkin = { key, label, background: {type, props},
bloom, camera }` (`assets/skins/presets.ts`). Type-specific params live in `background.props` (nebula:
palette/pattern/clear); **scene-level** ambiance — `bloom` (post) and `camera` (fov) — stays at the skin top level, so
`PostFX`/`UniverseCanvas` never index a type-specific props bag. The **active skin** is one build-time constant —
`rendering.active_skin` (`spec/values.yaml` → `@cosimosi/config`). The seam is `SkinProvider` + `useSkin()`
(`resolveActiveSkin` maps the constant); a future end-user runtime switcher ([P4]) replaces the source with no consumer
change. **Invariant:** a skin/background is presentation-only — it never sets per-memory emotion/position/strength ([I3][I11]).

**Generic core vs assets.** The toolkit (`shader-art`), scene layers (`layers/`), canvas host, skin seam, and
asset-source port name **no** concrete background type; the type→node-builder dispatch and the concrete looks
(`nebula`/`gradient`/skins/`UniverseScene`) live in `assets/`, which depends on the core — not vice-versa. `Background`
takes a resolved `node`; `PostFX` takes `bloom` params. (The seam reads the skin _table_ from `assets/skins` — its
content — but references no background type/node-builder.)

### Across the R3F reconciler

R3F runs its own reconciler, so context from the DOM/RN tree outside `<Canvas>` does **not** reach in-canvas children.
The active skin is read with `useSkin()` at the boundary; `UniverseScene` resolves the background node and passes it as a
prop to `Background` (and `skin.bloom` to `PostFX`) — never via context across the canvas.

### Camera (demo orbit)

`UniverseScene` mounts `CameraControls` — three's `OrbitControls` (drag = rotate, wheel/pinch = zoom, inertial damping;
pan off; distance clamped). It updates in a default-priority `useFrame`, before `PostFX`'s priority-1 render. This is a
**demo inspection rig**, not product navigation — the real universe camera/fly rig is Epic A `universe-canvas`
([U3][V0]). It attaches to the canvas DOM element and stays **inert on hosts without one** (native gesture nav is Epic A).

### Post-processing

`PostFX` builds a three `PostProcessing` pipeline with a **TSL bloom pass** (`three/addons/tsl/display/BloomNode.js`)
over `pass(scene, camera)`, parameterized by the skin. It takes the render loop with a positive-priority `useFrame`;
`renderAsync()` per frame is the documented three WebGPU pattern (the renderer queues).

## Consumers

- **Web:** `apps/web/src/pages/universe` is the **main page (`/`)** — full-bleed `UniverseCanvas` (background + stars +
  bloom) with floating HUD buttons. The old design-system showcase page is retired; design-system primitives are
  verified via the `/test` harness `Design system` panel. The `/test` **rendering-foundation** panel
  (`pages/test/lib/render-demo-panel`) drives the package with a live skin switcher.
- **Mobile:** `apps/mobile/.../navigation/screens/UniverseScreen` (route `Universe`, reached from `ShellHome`) renders
  the **same** package scene, error-boundaried so a WebGPU/native failure shows a fallback instead of crashing.
- Both apps import `@cosimosi/3d-renderer` identically — proven by `typecheck` passing on **both** web and RN.

## three confined to the package

`apps/web/eslint.config.js` `no-restricted-imports` forbids `three` / `three/*` / `@react-three/fiber` in
`app`/`pages`/`widgets`/`features`/`entities` — slices go through the package boundary.

## React Native build setup (as-built)

The scene code is shared; native needs build-time wiring (not forked code):

- **Deps:** `react-native-webgpu` + its peers `react-native-reanimated` + `react-native-worklets`.
- **Metro** (`apps/mobile/metro.config.js`): `resolveRequest` maps `three` → `three/webgpu`, and `@react-three/fiber`
  → its WebGPU/web build (`require.resolve`) instead of the expo-gl RN bundle (the react-native-webgpu README's
  patch, done via resolver so node_modules isn't patched).
- **Babel** (`babel.config.js`): `react-native-worklets/plugin` (last).
- **Runtime:** `navigator.gpu` is a main-thread global from the native module — no polyfill import on the JS thread;
  `installWebGPU()` is only for worklet runtimes.
- **Native build:** `pod install` (autolinks rn-webgpu/Dawn + reanimated + worklets); New Architecture, RN ≥ 0.81; a
  custom dev client (no Expo Go). Verify the render on a simulator/device.
- **Jest:** host shell tests mock `@cosimosi/3d-renderer` (`jest.mock.3d-renderer.tsx`) so jest never loads three (ESM).

## The universe canvas (plan 23 as-built)

The first real consumer of the substrate: `widgets/universe-canvas` (web + mobile) renders the per-user memory graph
on the main page (`/` · `UniverseScreen`). Its platform-agnostic core — the graph builder, the `UniverseSimBridge`,
the XState navigation machine, and the camera-rig scalars — is shared verbatim through **`@cosimosi/universe`**; the
app widget slices hold only the app-context wiring (fetch → stores, scene composition) and the per-app sim-worker
spawner. Sharing the core through a package — rather than copy-mirroring it into each app — is what keeps web and
mobile byte-identical (a copy-mirror drifts on formatting alone).

- **Mount, never re-bootstrap.** Presentation units mount `UniverseCanvas` + `SkinProvider` + `PostFX` from the
  package and compose their scene inside; they add no renderer lifecycle, skin system, or post pipeline of their own.
  React context does **not** cross the R3F reconciler — app-context hooks (query/skin/machine) run outside the canvas
  and pass data in as props.
- **The read model** is three Zustand stores (episodic-memory / neuron / synapse; populated once per `GetUniverse`
  fetch), promoted to **`@cosimosi/universe`** (job 35) and shared verbatim by both apps, over `@cosimosi/memory` — the
  shared FE domain types + proto→domain mappers (strict at the boundary: unknown mood/neuron-type or a non-canonical
  synapse fails loud). The pages/screens wrap the widget in an
  error boundary — reset-wired through react-query's `QueryErrorResetBoundary` so its Retry actually refetches the
  failed `GetUniverse` read — so a corrupt row or read failure contains to the canvas area and recovers in place.
- **Scene primitives** are package layers, the only three importers: `InstancedNodeLayer` (one `InstancedMesh` sized to
  the active node count — bodies resolved through the `VisualBodySource` port, `createPrimitiveBodySource` binding
  generic unlit spheres until the real bodies land) and `EdgeLineLayer` (a plain `THREE.LineSegments` +
  `LineBasicNodeMaterial` over a `position` BufferGeometry, 2 verts per edge, raycast disabled so picking stays on
  nodes). Both READ the latest coordinate buffer in `useFrame` — coordinates never enter React state or a store, and
  nothing persists them [I5]. **WebGPU note:** a mesh is kept `visible = false` until it has ≥1 instance/segment to
  draw — a 0-count geometry inside the PostFX `pass()` makes the WebGPU backend build an invalid object bind group and
  wedges the device. `InstancedNodeLayer`/`EdgeLineLayer`/`createPrimitiveBodySource` remain generic package primitives;
  the universe scene composes the plan-24 star/cell-star/filament bodies over them (below). `instance_bucket_size`
  bucketing for graphs beyond one InstancedMesh is still future — each body kind renders as one InstancedMesh / one
  batched ribbon.
- **The sim runs off the render thread**: `packages/force-sim` in a module Web Worker behind a `UniverseSimBridge`
  (`@cosimosi/universe`), two buffers ping-ponging as transferables; `FrameTick` pumps it once per frame. React Native
  has no standard Worker, so its per-app spawner returns null and the bridge runs the sim inline on the JS thread — the
  bridge/sim/scene stay shared and a future RN worker primitive slots in behind the spawner seam. On a refetch the
  bridge resizes the coordinate buffer to the new graph and carries existing node coordinates across the swap, so a
  growth refetch never flashes stale/origin geometry. A worker/sim error terminates the bridge and reads as an
  **empty** universe (never a zero-stacked one); the shared graph builder coerces out-of-range **and non-finite**
  stored magnitudes into the sim's finite domain so a skewed or corrupt row cannot kill the scene, and structurally
  emits neuron↔neuron edges only [I4][I6] from connectivity alone [I3].
- **Navigation** is the product `NavigationRig` (zoom · rotate · pan via OrbitControls where a DOM canvas exists —
  inert on native for the MVP — plus machine-driven focus/fly glides). It replaces the demo `CameraControls` for the
  universe scene; the demo layer remains for `/test`/`UniverseScene`. The camera/selection modes live in the XState
  navigation machine (`@cosimosi/universe`, ids-only context), polled per frame via `getSnapshot()`. Arrival is a pure,
  unit-tested latch (`navigation-latch.ts`): it fires ARRIVED once when the camera settles inside the epsilon shell,
  re-arms when the camera drifts out **or the travel target changes** (so a retarget across an unobserved idle frame
  can't strand the glide), and force-arrives past `arriveTimeoutSeconds` so chasing a still-drifting target always
  returns control. Rig feel scalars (`UNIVERSE_CAMERA_RIG`) are code-level constants in `@cosimosi/universe` (no
  `rendering.camera.*` values group exists yet).

## Star / neuron / filament bodies (plan 24 as-built)

The three **rendering entities** turn the domain-mirror graph into bodies. Their body is a `VisualBodySource` from
`@cosimosi/3d-renderer/assets/bodies/` — so `three` stays inside the package.

> **As-built (job 35 — write vertical promoted to packages).** The rendering entities are no longer duplicated app
> slices. Their **pure channel projections** (`starChannels`/`cellStarChannels`/`filamentChannels`, nebula
> `buildContributors`, `latentField`) + the read-model stores live in **`@cosimosi/universe`**; their **R3F bindings**
> (`StarLayer`/`CellStarLayer`/`FilamentLayer`/`LatentStarField`/`NebulaField`/`AwakenNeuron`) live in
> **`@cosimosi/universe-render`** (depends on `@cosimosi/3d-renderer` + `@cosimosi/universe`). Both apps import them
> verbatim — one source, no `*.native` fork (nothing here uses a DOM/RN primitive). The apps keep only the forked
> DOM/RN sheets (`WritingFlowSheet`, `ReviseControls`, `LaunchButton`, `NebulaNotice`, …) and their session stores.

- **The domain→visual projection is one-way (§3.4).** A channel projection imports the domain read-model **types** from
  `@cosimosi/memory` (formerly the FE mirror's `@x` public API), reads the shared read-time functions
  (`@cosimosi/memory-logic`) and the palette seam (`@cosimosi/emotion`), and produces a body. It exports nothing back
  into the domain types or the `api` mapper; no visual word (`star`/`cell-star`/`filament`/…) becomes a domain symbol.
  Enforced by the §1 ubiquitous-language lint (which treats the `@cosimosi/universe`/`@cosimosi/universe-render` scene
  packages as visual paths so the vocabulary is native there, still forbidden in `@cosimosi/memory` + `apps/api`).
- **`star` (episodic-memory).** An instanced TSL big-star (`star-body.ts`, `shader` source): a unit sphere whose
  surface is displaced by ridged noise keyed on a per-instance **seed**, so two seeds take different coherent forms
  [V5]; the seed is immutable input (rendered, never mutated/animated — the Epic-C `Reshape` seam). Four independent
  channels, each a pure function of stored facts (`entities/star/model`): **size** = `effectiveStrength` → per-instance
  matrix scale in `star_size_min…max` [V3]; **brightness** = the real read-time `effectiveBrightness` (forgetting fade:
  offset-inclusive universe-days since last recall, slowed by arousal + connection strength) → per-instance attribute.
  Its own range already equals `[star_brightness_min, star_brightness_max]` (`forgetting.brightness_floor` is aligned to
  `star_brightness_min`), so `starChannels` **clamps it in place — it does NOT re-lerp a `[0,1]` fraction** (that would
  lift the silent-engram floor off the min); a fully-decayed star bottoms at `star_brightness_min`, never 0/removed
  [V2][F1][F2]; **color** = the primary emotion via the plan-17 `moodColor` palette seam, linear-RGB per-instance
  attribute — emotion feeds color and nothing else [I3][M3]. Channels ride `InstancedNodeLayer` (extended with an
  optional `channels` = per-instance scale + named instance attributes; and an optional `onNodeHover` pointer-hover seam),
  recomputed only on read-model / universe-time change; the coordinate buffer is read per frame. A clock advance dims
  crossed-threshold stars through this same rebuild (the forgetting half of the acceleration slot [V8]).
- **`cell-star` (neuron).** A seedless instanced point (`cell-star-body.ts`, `primitive` source) at a constant
  `cell_star_point_size` — no emotion color, no seed-form; a neuron carries information, not emotion [V5][I3].
  Degree-driven sizing stays reserved.
- **`filament` (synapse).** A batched camera-billboarded **ribbon** fat-line (`FatLineLayer` + `filament-body.ts`,
  `shader` source, additive + `DoubleSide`): one mesh, 4 verts / 2 tris per edge, each quad billboarded toward the
  camera with **half-width + glow = `effectiveSynapseStrength`** (read-time from stored `strength` +
  `last_activated_universe_time`) in `filament_width_min…max` / `filament_brightness_min…max` [V6]. **Not three's
  `Line2`:** `Line2NodeMaterial`'s transparent path samples the opaque viewport texture the custom PostFX pipeline
  never exposes (WebGPU rejects the bind group); the ribbon needs no viewport texture and survives the pipeline.
  Endpoints are neuron coordinate slots only, so a star↔star line is structurally impossible [I4][I6].
- **One universe clock.** `elapsedUniverseDays` (ISO-date → floored days) lives in `@cosimosi/memory-logic` — the
  companion to `effectiveBrightness` / `effectiveSynapseStrength` — so star and filament read the same clock. Visual
  channel mapping (`lerpClamp`) floors a non-finite read-time value to the range minimum, so a skewed row can't write a
  NaN scale/vertex.
- **On-device render** is pending verification like the rest of the RN scene — run `pnpm ios` (the mobile MVP instance
  caps / dropped post-FX are confirmed via on-device profiling; the shared bodies and projection do not fork).

## Latent star field & awaken (plan 25 as-built)

Latent stars are **rendering-only** — no DB rows, no RPC, no domain type in Go/proto/sqlc or the FE mirror. A `neurons`
row exists only for an _activated_ neuron, written by Encode (plan 20), never here. The awaken is entry choreography; the
seed anchor is a client presentation choice; the real neuron's final position is **emergent** from the force-sim and is
**never stored** [I5][E7a].

- **`LatentField` layer (`@cosimosi/3d-renderer`).** One `InstancedMesh` + a gray TSL `MeshBasicNodeMaterial`, rendered
  as a background layer: `depthTest`/`depthWrite` off + `renderOrder = -1` so every real body draws on top. Matrices are
  written **once** (rewritten only when the field or the consumed set changes), never per frame; a subtle shader-time
  `positionLocal` wobble (`drift`) gives the dust life without meaning. A consumed point (one that has awakened)
  collapses to scale 0. The mesh is hidden until its matrices are first written (a fresh `InstancedMesh` starts
  full-count with zero matrices).
- **`entities/latent-star` (visual entity).** `model/latent-field.ts` is a deterministic seeded generator (self-contained
  Park-Miller PRNG seeded by `force_sim.seed`, so web↔mobile agree) producing `rendering.latent_star_count` positions in
  a disc of `rendering.latent_field_radius`, z ∈ the hippocampus band; points carry no color/brightness/identity. It is
  **not** a force-sim node. `model/latent-consumed-store.ts` holds the shared consumed marks.
- **`features/awaken-neuron` (feature).** `pickAwakenSeeds` picks N **distinct** latent stars nearest the recently-active
  anchors (`recentlyActiveNeuronIds` over the episodic-memory mirror within `synapse.temporal_window_days`), else random.
  The UI flares each pick with a `sin(πp)` envelope (a fixed-capacity pool advanced by `FrameTick`, no XState, no 60fps
  React state) and marks it consumed; a module-level `awaken-registry` store makes the awaken **idempotent across
  remounts**. It reacts to `new_neuron_ids` — the writing flow (plan 27) announces them through the module-level
  `features/launch-stars` launched-neurons store, which the always-mounted canvas reads and feeds here.
- **Mobile (§3.5).** The field + layer are the shared package modules (`@cosimosi/universe` / `@cosimosi/universe-render`);
  the widget passes `rendering.latent_star_count_mobile` (reduced MVP count). No `*.native` sibling — the R3F host is
  already forked at the canvas level.

### Nebula emotion color field (plan 26)

The ambient color field blends **many** per-star emotion colors at once — each memory's mood color bleeds into its
region, stronger stars bleed wider, and the universe's global tone **emerges** from the composite; it is never stored,
modeled, or surfaced as an average-tone readout ([M4][M5][I5][§3.4]).

- **`ColorField` layer (`@cosimosi/3d-renderer`).** The domain-agnostic realization is **additive world-space soft-glow
  kernels**, not a full-screen uniform-array loop pass: one `InstancedMesh` of unit spheres with a TSL
  `MeshBasicNodeMaterial` whose `opacityNode` is a **view-facing radial falloff** (`clamp(normalView.z,0,1) ^
falloff_exponent × base_intensity`), so a plain sphere reads as a soft glow with no billboarding. `AdditiveBlending`,
  `depthTest`/`depthWrite` off, `renderOrder = -2`, so contributions **sum** in the framebuffer (many colors coexist and
  bleed, the tone emerges) and the latent field (-1) + every real body draw on top. Positions are read per frame from the
  coordinate buffer into instance matrices (§3.3); the per-contributor tint is an instance attribute uploaded only when
  the read model changes. Colors in, pixels out — the layer holds no emotion, palette, or domain import. This reuses the
  proven `InstancedNodeLayer`/`LatentField` per-frame pattern and avoids an untested TSL `Loop`/`uniformArray` full-screen
  shader with WebGL2-fallback risk; additive framebuffer compositing is the screen-space realization the plan left open.
- **`entities/nebula` (visual entity).** `lib/contributors.ts` is a pure projection: each rendered memory →
  `(nodeIndex = firstNodeIndex + storeIndex, moodColor(mood) → linear RGB tint, EffectiveStrength → max(min_bleed_radius,
bleed_radius_coefficient × strength) radius)`, capped at `max_contributors` keeping the **strongest**. Color comes
  solely through the plan-17 `moodColor` seam — no color literal, no valence→hue math; the weight input is
  `EffectiveStrength` (the derived read-time size), the Epic-C recall mirror seam. `ui/NebulaField.tsx` binds the layer
  with `firstNodeIndex = neuronCount` (memories share the star layer's buffer slots); `ui/NebulaNotice.tsx` is the
  honest-mirror HUD disclosure (i18n copy, renders no color; the one bit still app-local, a forked DOM/RN component).
  The read model is read from the shared `@cosimosi/universe` episodic-memory store.
- **Layer coexistence.** The nebula (domain emotion color) composites over the plan-14 skin background and behind the
  latent field + bodies. The skin never reads emotion; the nebula never sets ambiance — neither writes to the domain.
- **Optimistic-launch interaction (plan 27).** A just-launched memory enters the `episodic-memory` store before its
  force-sim node exists, so its nebula kernel (and its star) render at the world origin until the next `GetUniverse`
  refetch rebuilds the graph and the sim positions it — the §2.8 optimistic degradation ("position fills on next read").
- **Mobile (§3.5).** The projection (`buildContributors`) + the `NebulaField` layer are the shared package modules; the
  mount passes `nebula.field_resolution_mobile` (coarser kernels). `NebulaNotice` is forked per-app (RN View/Text vs
  DOM); the `ColorField` TSL layer is shared — no `*.native`.

## Gist-star / z-layer rendering (plan 42 as-built)

The universe renders its **two z-bands as one navigable 3D depth** ([V9][V0]): the hippocampus band
(`force_sim.hippocampus_z_*`; episodic stars + latent field) below, the neocortex band (`force_sim.neocortex_z_*`;
gist bodies) above — one scene, the plan-23 camera rig, no mode toggle, no second camera.

- **A gist star copies the episodic `(x, y)` and raises only z** ([C6][I5]). The neocortex runs **no force-sim**:
  `GistStarLayer` (`@cosimosi/universe-render`) derives each instance's position per frame — x, y read live from the
  memory's hippocampal sim slot, z from the memory-logic golden-parity `gistCoordinate` for the instance's stage — via
  `InstancedNodeLayer`'s optional `getInstancePosition` mapper (per-frame, allocation-free; the default
  contiguous-slot path is unchanged). No gist coordinate is ever stored or reverse-projected. `COORDINATE_STRIDE` is
  exported by the renderer as the coordinate-buffer contract's owner.
- **One instance per risen stage.** `gist-star-channels.ts` (`@cosimosi/universe`, pure, shared web+mobile) emits N
  instances for `semanticStage = N` (risen stages persist [C7]): color = `moodColor(mood)` through the single palette
  seam and nothing else ([M3][I3]); size = `EffectiveStrength` lerped into `rendering.gist_star_size_*` (a quieter
  echo of the episodic range [V3]); softness = `rendering.gist_star_diffuse` at stage 1 deepening to fully diffuse at
  the ladder top ([V5]). The `GetUniverse` DTO carries `semantic_stage` (the plan-40 read premise, realized here —
  the server facts always had it; the wire field was added, no new RPC).
- **Abstraction is z + a diffuse look, never shape** ([V5]). `gist-star-body.ts` (`@cosimosi/3d-renderer`) is its own
  TSL `VisualBodySource` — a facing-falloff glow ball (additive, depth-tested but never depth-written) with
  per-instance tint + softness attributes; the episodic seed channel is untouched by stage.
- **The gap depth cue is `BandFog`** — an additive, raycast-invisible haze slab across the z 10–15 gap (peak at the
  gap center, zero at both band edges; intensity `rendering.gist_rise_layer_fog`): a rendering affordance marking the
  boundary, never a wall and never a click shield.
- **The neutral stage-rise is appearance-driven and one-way** ([V8][I10]). Consolidation is the sole stage writer, so
  a `(memory, stage)` instance newly appearing in the projection *is* the advance's read landing: it eases from the
  memory's hippocampal z up into the band once (`GIST_RISE_DURATION_SECONDS`, a code-level layer constant); the first
  non-empty projection seeds silently (no page-load mass rise) and an empty interval adds no instance, so nothing
  plays. The per-interval rise events surface on `GistStarLayer.onStageRise` — the **booked [V8] slot** the
  later-authored pulled-upward/relate-star replay choreography consumes; nothing more is built.
- **A gist star is read-only** ([R8][I8]). Its pick payload is `gistNodeId(memoryId, stage)`; a pick sends the
  navigation machine SELECT only (a gist body is not a sim node — no camera glide), the star-detail resolver routes it
  through the injected `parseGistNodeId` recognizer as `{kind: 'gist', episodicMemoryId, stage}`, and the panel
  forwards `(memoryId, stage)` to the ViewSemantic surface seam — no 회고하기, no rewrite affordance, no
  un-rise/placement/stage control ([I10][I11]).
- **Mobile (§3.5).** Channels, body, fog, and layer are the shared package modules — no `*.native` fork; the mobile
  widget composes them identically (source-gate verified; on-device render pending).

## Config

`spec/values.yaml → rendering`: `active_skin` (preset key), `max_pixel_ratio` (DPR cap), `instance_bucket_size`
(instancing bucket capacity), the plan-24 visual ranges `star_size_min`/`star_size_max`,
`star_brightness_min`/`star_brightness_max`, `filament_width_min`/`filament_width_max`,
`filament_brightness_min`/`filament_brightness_max`, `cell_star_point_size`, plus the plan-25 latent-field scalars
`latent_star_count`, `latent_star_count_mobile`, `latent_field_radius`, `latent_star_size`, and `awaken_capacity`
(the awaken flare pool ceiling — a resource cap, so it is config; the flare's motion/look stays in code), and the
plan-42 gist scalars `gist_star_size_min`/`gist_star_size_max` (the quieter `EffectiveStrength` → size range),
`gist_star_diffuse` (the base softness of the diffuse gist body), `gist_rise_layer_fog` (the gap depth-cue haze).
(The stage→z map is **not** a value — it is the memory-logic `gistCoordinate` derivation over the reused
`force_sim.{hippocampus,neocortex}_z_*` bands; the rise duration stays a code-level layer constant.)

`spec/values.yaml → nebula` (plan 26, its own group): `bleed_radius_coefficient` (`EffectiveStrength` → bleed radius),
`min_bleed_radius` (floor), `falloff_exponent` (kernel density sharpness), `max_contributors` (kernel budget cap),
`field_resolution_web`/`field_resolution_mobile` (per-platform kernel tessellation), `base_intensity` (ambient
amplitude). Generated to `@cosimosi/config` (`VALUES.rendering.*` / `VALUES.nebula.*`) + Go constants via
`pnpm gen:values` — never hardcoded. (The star seed-form shader graph, the latent-field drift/flare motion, the nebula
falloff/blend graph, the compositing/blend mode, and the filament/cell-star/latent/nebula tint colors are code/content,
not values.)
