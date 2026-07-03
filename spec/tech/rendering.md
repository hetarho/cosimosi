# Rendering (as-built)

As-built rules for the 3D rendering substrate (built by [plan/14](../plan/14.rendering-foundation.md) /
[job/17](../jobs/17.rendering-foundation.md)). Owner doc for renderer/shader/skin rules; other docs reference it.

> **Status.** Web is built and verified (typecheck · lint · test · build). Mobile is wired and verified at the
> source-gate level (typecheck · lint · test · `pod install`); the **on-device/simulator render is pending
> verification** — run `pnpm ios` (this is the one thing CI can't see). The 3D scene, shader toolkit, and skins are **shared
> verbatim** across web and React Native — only the native *build setup* forks, not the code.

## The package — `@cosimosi/3d-renderer`

A **platform-aware** package (like `@cosimosi/ui`): it owns `three` + `@react-three/fiber` (peer deps) and is the
single 3D library both apps consume. The exports map forks only the entry — `react-native` → `src/index.native.ts`,
default → `src/index.ts` — and `index.native.ts` re-exports the web entry (the code is shared; only the *build setup*
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
change). A **skin** is a *typed instance* of non-domain ambiance: `UniverseSkin = { key, label, background: {type, props},
bloom, camera }` (`assets/skins/presets.ts`). Type-specific params live in `background.props` (nebula:
palette/pattern/clear); **scene-level** ambiance — `bloom` (post) and `camera` (fov) — stays at the skin top level, so
`PostFX`/`UniverseCanvas` never index a type-specific props bag. The **active skin** is one build-time constant —
`rendering.active_skin` (`spec/values.yaml` → `@cosimosi/config`). The seam is `SkinProvider` + `useSkin()`
(`resolveActiveSkin` maps the constant); a future end-user runtime switcher ([P4]) replaces the source with no consumer
change. **Invariant:** a skin/background is presentation-only — it never sets per-memory emotion/position/strength ([I3][I11]).

**Generic core vs assets.** The toolkit (`shader-art`), scene layers (`layers/`), canvas host, skin seam, and
asset-source port name **no** concrete background type; the type→node-builder dispatch and the concrete looks
(`nebula`/`gradient`/skins/`UniverseScene`) live in `assets/`, which depends on the core — not vice-versa. `Background`
takes a resolved `node`; `PostFX` takes `bloom` params. (The seam reads the skin *table* from `assets/skins` — its
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
- **The read model** is the domain-mirror `entities/{episodic-memory,neuron,synapse}` (Zustand stores; populated once
  per `GetUniverse` fetch) over `@cosimosi/memory` — the shared FE domain types + proto→domain mappers (strict at the
  boundary: unknown mood/neuron-type or a non-canonical synapse fails loud). The pages/screens wrap the widget in an
  error boundary — reset-wired through react-query's `QueryErrorResetBoundary` so its Retry actually refetches the
  failed `GetUniverse` read — so a corrupt row or read failure contains to the canvas area and recovers in place.
- **Scene primitives** are package layers, the only three importers: `InstancedNodeLayer` (one `InstancedMesh` sized to
  the active node count — bodies resolved through the `VisualBodySource` port, `createPrimitiveBodySource` binding
  generic unlit spheres until the real bodies land) and `EdgeLineLayer` (a plain `THREE.LineSegments` +
  `LineBasicNodeMaterial` over a `position` BufferGeometry, 2 verts per edge, raycast disabled so picking stays on
  nodes). Both READ the latest coordinate buffer in `useFrame` — coordinates never enter React state or a store, and
  nothing persists them [I5]. **WebGPU note:** a mesh is kept `visible = false` until it has ≥1 instance/segment to
  draw — a 0-count geometry inside the PostFX `pass()` makes the WebGPU backend build an invalid object bind group and
  wedges the device. **Deferred to plan 24:** the fat-line `Line2`/`Line2NodeMaterial` (width/brightness = synapse
  strength — its transparent path reads the opaque viewport texture, which the custom PostFX pipeline doesn't expose)
  and `instance_bucket_size` bucketing for graphs beyond one InstancedMesh; both are unused by this scaffold, which
  renders generic 1px lines and a single node mesh.
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

## Config
`spec/values.yaml → rendering`: `active_skin` (preset key), `max_pixel_ratio` (DPR cap), `instance_bucket_size`
(instancing bucket capacity). Generated to `@cosimosi/config` (`VALUES.rendering.*`) + Go constants via
`pnpm gen:values` — never hardcoded.
