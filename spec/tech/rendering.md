# Rendering (as-built)

As-built rules for the 3D rendering substrate (built by [plan/14](../plan/14.rendering-foundation.md) /
[job/17](../jobs/archive/17.rendering-foundation.md)). Owner doc for renderer/shader/skin rules; other docs reference it.

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
packages/3d-renderer/src/                                                              GENERIC shared renderer
├── shader-art/   noise · field · pattern · finish · sdf · geometry (+ tsl helper)  — pure TSL building blocks
├── layers/       SkySphere · StarField · CameraControls (demo trackball) · PostFX (bloom)  — R3F layers
├── canvas/       UniverseCanvas (web R3F + WebGPURenderer)                          — the only platform-forked surface
├── asset-source · skin-context · SkinProvider                                       — §3.4 port + skin seam
├── assets/       CONCRETE looks (use the core; depend on it, not vice-versa)
│   ├── bodies/       star catalogue · cell-star · filament · gist
│   ├── sky/          emotion ramp + registered TSL sky effects
│   └── skins/        typed ambiance instances ({sky, bloom, camera})
└── index.ts / index.native.ts / jsx-elements.ts
```

### Shader-art toolkit (the composable effect library)

Domain-agnostic procedural TSL techniques, two families: **effects** (`noise` fbm/worley/ridged · `field`
domain-warp/polar/kaleido/log-spiral · `pattern` cell-edge/iso-line/contour · `finish` fresnel/iridescent → color/mask
nodes) and **objects** (`sdf` · `geometry` → forms). Each is a pure node-in/node-out builder — no material, uniform,
React, or DOM. Skins **compose** these into a look. Authoring is **TSL only** (transpiles to WGSL + GLSL) — never raw
GLSL — so one source serves web + native. (Rich artistic layering/mixing is later product work; the foundation makes
the effects library-shaped.)

### Emotion sky and the skin seam

The shipped backdrop is one **typed emotion sky**, not a flat background-type registry. `UniverseSkin = { key, label,
sky: { effect, night }, bloom, camera }` (`assets/skins/presets.ts`): `SkySphere` resolves `effect` through the
`SKY_EFFECTS` catalogue, while `UniverseCanvas.clearColor` owns the opaque bare-night color behind its translucent
surface. The old gradient/nebula node builders, `Background` layer, registry, and unused `UniverseScene` composition
were retired when the emotion sky became the product backdrop; a main scene cannot accidentally mount both systems.

Scene-level ambiance — `bloom` (post) and `camera` (fov) — stays at the skin top level. The active skin is the
build-time `rendering.active_skin` value (`spec/values.yaml` → `@cosimosi/config`), resolved through `SkinProvider` +
`useSkin()`. The seam stays typed for future ambiance variants, but only the shipped `emotion` skin is currently
authored. **Invariant:** a skin/sky is presentation-only — it never sets per-memory emotion, position, or strength
([I3][I11]).

**`rendering.active_skin` now means the SCENE DEFAULT, not the sky.** Two of the skin's contents became per-user
decoration choices (plan 71): which `SKY_EFFECTS` entry shades the sphere, and which `STAR_SHAPES` body the memory
stars are built from. The `SkinKey` union does **not** grow for either — a skin still owns `bloom`, `camera` and the
bare-night clear color, none of which is ever sellable, and the `emotion` skin's authored `sky.effect` is what the
default background ornament id mirrors (asserted from the fixture in `assets/ornament-ids.test.ts`).

### The two selection seams (plan 71)

Both apps' canvas widgets read the applied selection through `useAppliedOrnaments()` (`@cosimosi/store/react`) and hand
the two registry keys down as props:

- **Sky.** `SkySphere`'s `effect` prop takes a plain `string` rather than the narrow `SkyEffectKey` union, because the
  key arrives as an opaque decoration id from outside the renderer; `resolveSkyEffect` performs the resolution and the
  retired-key fallback here, where the registry lives (§3.4 — the visual vocabulary never crosses back out).
- **Star body.** `StarLayer` takes the shape to build (`createStarShapeBodySource(shape)`) instead of hardwiring
  `DEFAULT_STAR_SHAPE`, and a shape change remounts **only that layer** through its existing key
  (`star-${paletteVersion}-${shape}`). The renderer is never remounted (plan 14's rule); `InstancedNodeLayer` still owns
  and disposes the material. `StarShapeOptions` carries `animate` alone — the builder has **no writable handle** to
  tint, brightness, seed or the layer-applied scale, and `EMISSIVE_GAIN` is not a shape field, so a bought shape cannot
  lift a faded star back over the bloom threshold ([V2][F1][I11]).

Until the selection read lands, each kind shows its own default — the same picture an undecorated universe shows.

### Across the R3F reconciler

R3F runs its own reconciler, so context from the DOM/RN tree outside `<Canvas>` does **not** reach in-canvas children.
The active skin is read with `useSkin()` at the app composition boundary; the host passes `skin.sky.night` to
`UniverseCanvas`, `skin.sky.effect` to `SkySphere`, and `skin.bloom` to `PostFX` — never via context across the canvas.

### Camera (demo trackball)

`CameraControls` is the test-harness inspection rig: three's `TrackballControls` (drag = rotate, wheel/pinch = zoom,
inertial damping; pan off; distance clamped). Trackball rather than `OrbitControls` so rotation never blocks: it holds
no fixed up-vector, so the view tumbles past the poles and keeps spinning in any direction. Pointer motion is mapped
through the element's on-screen size, so canvas resizes are announced via `handleResize()` (the shared
`observeElementResize` seam in `layers/dom-controls.ts`). It updates before `PostFX`'s priority-1 render. Product
navigation remains the `NavigationRig` composed by the universe canvas widgets ([U3][V0]).

### Backdrop scale (one ordering, four numbers)

The backdrop nests, and every layer of it must stay in this order:

**camera zoom-out limit < `StarField` radius < `SkySphere` radius < `UniverseCanvas` far plane.**

Each `<` is load-bearing. A camera that outruns the star shell sees the field as a ball hanging in the middle of the
frame instead of a sky around it; a camera that leaves the sky sphere loses the background entirely (it is painted on the
sphere's inner face); and a sky beyond the far plane is clipped into a growing hole straight ahead as you pull back.
The far plane is therefore set explicitly on the canvas — R3F's own default (1000) is too near for an enclosing sky —
and the zoom-out limits live with the rigs (`UNIVERSE_CAMERA_RIG.maxDistance` for the product, the demo
`CameraControls`'s own clamp for `/test`).

`StarField` scatters from a seeded PRNG (Park-Miller, the latent field's precedent) rather than a Fibonacci lattice:
independent random draws give the clumps and voids a real sky has, where an index-driven spread leaves a traceable
spiral. Radius is volume-uniform (cube root) so the field doesn't pack onto its inner shells, star size rides its own
distance so every shell keeps roughly one on-screen size, and the twinkle's phase, rate, pulse shape, and steady glow
are each an independent per-instance hash — a shared rate or a smooth phase walk makes the whole field pulse as one
travelling wave. Reduced motion freezes both that twinkle clock and the field's slow spin.

### Post-processing

`PostFX` builds a three `PostProcessing` pipeline with a **TSL bloom pass** (`three/addons/tsl/display/BloomNode.js`)
over `pass(scene, camera)`, parameterized by the skin. It takes the render loop with a positive-priority `useFrame`;
`renderAsync()` per frame is the documented three WebGPU pattern (the renderer queues).

## Consumers

- **Web:** `apps/web/src/pages/universe` is the **main page (`/`)** — full-bleed `UniverseCanvas` (emotion sky + stars +
  bloom) with floating HUD buttons. The old design-system showcase page is retired; design-system primitives are
  verified via the `/test` harness `Design system` panel; the sky, star-form, and nebula panels exercise the shared
  product renderer independently.
- **Mobile:** `apps/mobile/src/pages/universe/ui/UniversePage.tsx` (registered by the app-layer `Universe` route
  adapter) renders the **same** package scene, error-boundaried so a WebGPU/native failure shows a fallback instead of
  crashing.
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
on the main page (`/` · mobile `UniversePage`). Its platform-agnostic core — the graph builder, the `UniverseSimBridge`,
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
- **Navigation** is the product `NavigationRig` (zoom · rotate · pan via `TrackballControls` where a DOM canvas exists
  — inert on native for the MVP — plus machine-driven focus/fly glides). Trackball, so free rotation is unbounded in
  every direction (no polar clamp, no pole stall); glides disable the controls and drive the camera directly. It replaces the demo `CameraControls` for the
  universe scene; the demo layer remains for `/test`/`UniverseScene`. The camera/selection modes live in the XState
  navigation machine (`@cosimosi/universe`, ids-only context), polled per frame via `getSnapshot()`. Arrival is a pure,
  unit-tested latch (`navigation-latch.ts`): it fires ARRIVED once when the camera settles inside the epsilon shell,
  re-arms when the camera drifts out **or the travel target changes** (so a retarget across an unobserved idle frame
  can't strand the glide), and force-arrives past `arriveTimeoutSeconds` so chasing a still-drifting target always
  returns control. Rig feel scalars (`UNIVERSE_CAMERA_RIG`) are code-level constants in `@cosimosi/universe` (no
  `rendering.camera.*` values group exists yet).

- **Cross-route fly hand-off (plan 47).** The diary-reader jump lives on a separate route from the canvas, so it cannot
  send the navigation actor a `FLY` directly. It parks the target in a shared one-slot `usePendingFlyTargetStore`
  (`@cosimosi/universe`) and navigates home; the canvas widget consumes it on mount — once the target node exists in the
  graph it sends `FLY` and clears the store. An episodic star's node id **is** its memory id, so the jump parks the first
  recalled `episodic_memory_id` with no translation. The reader never imports `three` or the rig (§3.4); the fly is a
  discrete navigation event, and the reinforced star already exists so the node always resolves.

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
  [V5]. `StarLayer` resolves `DEFAULT_STAR_SHAPE` through the same `star-shapes.ts` catalogue used by the test bench;
  the current shipped selection is the seed-form `orb`, so review and product cannot silently diverge. Motion follows
  the form instead of applying one turn to every body: fixed crystal geometry (cut facet,
  prism, eight-point spire) rotates in place about x/y/z with a seed-derived starting pose and brisk angular velocity,
  while procedural bodies (seed form, geode, bubble, urchin, plasma, contour, haze) keep their center and orientation
  and evolve their relief/noise field. The broad eight-point spire uses low crystalline pyramids rather than needle
  tips. The geode's warped seed-noise breaks up its travelling wave, while the urchin's quieter wave keeps every spike
  between 80–100% of its authored length; haze moves faster but remains low-amplitude. Reduced motion freezes either
  kind at its seed-derived pose. Time changes only the presentation phase; the seed value remains immutable input
  (rendered, never mutated/animated — the Epic-C `Reshape` seam). Four independent channels, each a pure function of
  stored facts (`entities/star/model`):
  **size** = `effectiveStrength` → per-instance matrix scale in `star_size_min…max` [V3]; **brightness** = the real
  read-time `effectiveBrightness` (forgetting fade:
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
  kernels**, not a full-screen uniform-array loop pass: one `InstancedMesh` of camera-facing unit-circle billboards with
  a TSL `MeshBasicNodeMaterial`. With `centeredUv = 2 × uv - 1`, each disc reconstructs the former sphere profile as
  `facing = sqrt(clamp(1 - dot(centeredUv, centeredUv), 0, 1))`, then applies
  `facing ^ falloff_exponent × smoothstep(0.35,0.95,facing)³ × base_intensity`. Cubing the broad feather moves the
  perceptual cutoff well inside each finite disc rim, so overlapping kernels read as a continuous gradient. Keeping the
  disc origin at its contributor coordinate and updating its instance rotation from the camera's world quaternion each
  frame makes the alpha peak project exactly over the star instead of drifting toward a sphere's front surface.
  `AdditiveBlending`,
  `depthTest`/`depthWrite` off, `renderOrder = -2`, so contributions **sum** in the framebuffer (many colors coexist and
  bleed, the tone emerges) and the latent field (-1) + every real body draw on top. Positions are read per frame from the
  coordinate buffer into centered billboard instance matrices (§3.3); the per-contributor tint is an instance attribute
  uploaded only when the read model changes. Colors in, pixels out — the layer holds no emotion, palette, or domain
  import. This reuses the
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
- **Layer coexistence.** The nebula (per-memory domain emotion color) composites over the emotion-sky ambiance and
  behind the latent field + bodies. The skin selects the sky effect but does not derive memory meaning; the nebula
  never sets ambiance — neither writes to the domain.
- **Optimistic-launch interaction (plan 27).** A just-launched memory enters the `episodic-memory` store before its
  force-sim node exists, so its nebula kernel and star keep their instance slots but collapse to zero scale until the next
  `GetUniverse` refetch rebuilds the graph and the sim positions them. The §2.8 optimistic degradation ("position fills
  on next read") therefore never flashes false geometry at the world origin.
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
  exported by the renderer as the coordinate-buffer contract's owner. A memoized `GistRenderSnapshot` owns the
  committed instance order, count, appearance arrays, and precomputed hippocampal slots; frame and pick callbacks close
  over that object. No render-phase ref publication can expose a work-in-progress ordering to the committed mesh.
- **One instance per risen stage.** `gist-star-channels.ts` (`@cosimosi/universe`, pure, shared web+mobile) emits N
  instances for `semanticStage = N` (risen stages persist [C7]): color = `moodColor(mood)` through the single palette
  seam and nothing else ([M3][I3]); size = `EffectiveStrength` lerped into `rendering.gist_star_size_*` (a quieter
  echo of the episodic range [V3]); softness = `rendering.gist_star_diffuse` at stage 1 deepening to fully diffuse at
  the ladder top ([V5]). The `GetUniverse` DTO carries `semantic_stage` (the plan-40 read premise, realized here —
  the server facts always had it; the wire field was added, no new RPC).
- **Abstraction is z + a diffuse look, never shape** ([V5]). `gist-star-body.ts` (`@cosimosi/3d-renderer`) is its own
  TSL `VisualBodySource` — a facing-falloff glow ball (additive, depth-tested but never depth-written) with
  per-instance tint + softness attributes; the episodic seed channel is untouched by stage.
- **The gap depth cue is `BandFog`** — a stack of horizontal `DoubleSide` additive glow discs across the z 18–27 gap,
  visible from above and below, raycast-invisible, and depth-write-free (peak at the gap center, zero at both band edges;
  intensity `rendering.gist_rise_layer_fog`): a rendering affordance marking the boundary, never a wall and never a
  click shield.
- **The neutral stage-rise is appearance-driven and one-way** ([V8][I10]). Consolidation is the sole stage writer, so
  a `(memory, stage)` instance newly appearing in the projection _is_ the advance's read landing: it eases from the
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
