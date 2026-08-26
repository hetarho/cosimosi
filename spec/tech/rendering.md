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

### The five selection seams (plan 71)

Both apps' canvas widgets read the applied selection through `useAppliedOrnaments()` (`@cosimosi/store/react`) and hand
the registry keys down as props. There is one seam per `OrnamentKind`, and the same three rules hold at every one of
them: the prop is a plain `string` (the key arrives as an opaque decoration id from outside the renderer), the
resolution and the retired-key fallback happen **inside** the registry that owns the look (§3.4 — the visual vocabulary
never crosses back out), and the builder gets no writable handle to anything meaning-bearing.

- **Sky.** `SkySphere`'s `effect` prop takes a plain `string` rather than the narrow `SkyEffectKey` union, because the
  key arrives as an opaque decoration id from outside the renderer; `resolveSkyEffect` performs the resolution and the
  retired-key fallback here, where the registry lives (§3.4 — the visual vocabulary never crosses back out).
- **Star body.** `StarLayer` takes the shape to build (`createStarShapeBodySource(shape)`) instead of hardwiring
  `DEFAULT_STAR_SHAPE`, and a shape change remounts **only that layer** through its existing key
  (`star-${paletteVersion}-${shape}`). The renderer is never remounted (plan 14's rule); `InstancedNodeLayer` still owns
  and disposes the material. `StarShapeOptions` carries `animate` alone — the builder has **no writable handle** to
  tint, brightness, seed or the layer-applied scale, and `EMISSIVE_GAIN` is not a shape field, so a bought shape cannot
  lift a faded star back over the bloom threshold ([V2][F1][I11]).
- **Gist body.** `GistStarLayer` takes `shape` and builds `createGistShapeBodySource(shape)`, remounting only itself
  through `gist-${paletteVersion}-${shape}`. It is **one choice for the whole layer**, never one per memory ([V5]), and
  every entry reads the same tint + softness channels — so a swap changes how a summary is lit and nothing about which
  summaries there are or how deep they have risen.
- **Backdrop.** `StarField` takes `mote` and `field`, the two halves of a backdrop, and rebuilds its geometry, material
  and scatter from them. What it does **not** take from a selection is `count` and `radius`: those come from
  `UNIVERSE_BACKDROP.<platform>`, because they are this device's budget and the backdrop nesting invariant, not a
  taste. A mote field can empty the sky (`mote_field.empty`, density 0) but cannot raise the instance ceiling.

Until the selection read lands, each kind shows its own default — the same picture an undecorated universe shows.

### Across the R3F reconciler

R3F runs its own reconciler, so context from the DOM/RN tree outside `<Canvas>` does **not** reach in-canvas children.
The active skin is read with `useSkin()` at the app composition boundary; the host passes `skin.sky.night` to
`UniverseCanvas`, `skin.sky.effect` to `SkySphere`, and `skin.bloom` to `PostFX` — never via context across the canvas.

### Camera (demo trackball)

`CameraControls` is the test-harness inspection rig: three's `TrackballControls` (drag = rotate, wheel/pinch = zoom,
inertial damping; pan off; min/max distance **required as props**, fed `UNIVERSE_CAMERA_ENVELOPE` at every mount so the
inspection surfaces and the product share one zoom envelope). Trackball rather than `OrbitControls` so rotation never blocks: it holds
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
and the zoom-out limit lives with the rig — one `UNIVERSE_CAMERA_ENVELOPE` (`packages/universe/src/camera-rig.ts`)
that both the product `NavigationRig` and the demo/design `CameraControls` wear, the latter through required props so
no second copy can drift. The four numbers live in four packages, so the ordering is **tested**, not
just documented: `SKY_SPHERE_RADIUS` (700) and `UNIVERSE_CANVAS_FAR` (1400) are named in
`3d-renderer/src/backdrop-scale.ts` — one far plane for the web host and its `.native` sibling — and
`universe-render/src/backdrop-scale.test.ts` walks `UNIVERSE_CAMERA_RIG.maxDistance` (420) → the profile's shell radius
→ sky → far for **both** platform profiles. That is why `star_field_radius_mobile` exists even though it equals the web
value: the shell radius is bound by this ordering rather than by the fidelity budget, and a mobile-only camera envelope
must have somewhere to break the test.

`StarField` scatters from a seeded PRNG (Park-Miller, the latent field's precedent) rather than a Fibonacci lattice:
independent random draws give the clumps and voids a real sky has, where an index-driven spread leaves a traceable
spiral. Radius is volume-uniform (cube root) so the field doesn't pack onto its inner shells, star size rides its own
distance so every shell keeps roughly one on-screen size, and the twinkle's phase, rate, pulse shape, and steady glow
are each an independent per-instance hash — a shared rate or a smooth phase walk makes the whole field pulse as one
travelling wave. Reduced motion freezes both that twinkle clock and the field's slow spin.

**A backdrop is two choices, not one.** `BACKDROP_MOTES` says what one particle is — its form and its colour —
and `BACKDROP_FIELDS` says what space they fill: where they sit, how many there are, and how their light moves
(a life mode plus two scalars over it, how fast it twinkles and how far, so "barely twinkling" and "frantic"
are rows rather than more modes). Neither constrains the other, so the set of possible backdrops is their
**product**, and there is no third catalogue of named pairs: a row that is only "mote 7 in field 3" would have
to be maintained alongside the two things it names. Anything neither catalogue offers goes into an axis, where
it multiplies across every pair, rather than into a row. How big a mote is drawn belongs to NEITHER catalogue and
is not a choice at all: `dealBackdropMoteSizes` gives every field all four steps of `BACKDROP_MOTE_SIZE_MIX`
(1·2·3·4, whole multiples of the geometry's own size) on fixed shares — 50 / 30 / 15 / 5 % — shuffled on a seed
of their own so the step never correlates with where the mote landed (a block deal comes out as bands under the
index-driven `lattice` mode). The grade is the point: one size reads as a printed texture instead of as depth,
and four in equal numbers read as two layers of dots rather than as one sky with a few near motes in it. The mix
is free — it is an instance scale, so it costs no triangles.

**Backdrop budget.** Count and radius are `rendering.star_field_count[_mobile]` / `star_field_radius[_mobile]`, taken as
one bundle (`STAR_FIELD_PROFILE.web` / `.mobile`, re-exported with the latent tessellation as `UNIVERSE_BACKDROP`) so a
surface can never wear one platform's count with the other's radius. `UniverseSceneLayers` REQUIRES that bundle — a host
that forgets would silently put the web budget on a phone — and the standalone mobile design/test mounts pass
`STAR_FIELD_PROFILE.mobile` / `LATENT_FIELD_SEGMENTS.mobile` for the same reason: diagnostics must measure the device's
budget. `BACKDROP_TRIANGLE_CEILING` (128k at the web count) is checked against the pair an undecorated universe wears,
because cost is `density × the mote's own topology` and neither catalogue can promise it alone. The design bench
combines the two freely and **reports** the number instead, flagging a pair that would exceed the ceiling: a form of
four times the topology poured into the densest field is a real answer to "why not both", and seeing the cost is how
that answer arrives. The plain mote form is an `IcosahedronGeometry` at
`star_field_mote_detail` (0 → 20 triangles), not a UV sphere: a mote covers a handful of pixels, so tessellation buys
only the silhouette, and a UV sphere of equal count crowds most of its triangles at the poles. The `orb` form is the one
that pays a subdivision more (4× the triangles) because it is bought for its ROUNDNESS rather than its silhouette — it is
drawn large, and at that size facets show — which is exactly why it belongs to the fields that place few motes. A camera-facing impostor quad (2 triangles) was spiked and **rejected** — it renders correctly,
but spreading each mote's light over a soft additive disc changes the sky's grain and would need the twinkle re-tuned to
match, and it converts the backdrop from an opaque depth-writing draw into a sorted transparent one. The latent field
keeps its sphere mote at `latent_star_segments[_mobile]` (web 6, mobile 4).

### Post-processing

`PostFX` builds a three `PostProcessing` pipeline with a **TSL bloom pass** (`three/addons/tsl/display/BloomNode.js`)
over `pass(scene, camera)`, parameterized by the skin. It takes the render loop with a positive-priority `useFrame`;
`renderAsync()` per frame is the documented three WebGPU pattern (the renderer queues).

### Canvas host device lifecycle

R3F v9 predates WebGPU, so **the host owns the device — R3F does not.** Its teardown path
(`unmountComponentAtNode`) reaches only for `renderLists?.dispose()` and `forceContextLoss?.()`, both WebGL-shaped and
both absent from `WebGPURenderer`; the optional chaining makes that a silent no-op. Each host therefore releases its own
renderer, and the two hosts differ only in how React hands them the unmount:

- **Web** (`UniverseCanvas.tsx`) hands the scene to R3F's `<Canvas>`, so a mount-scoped effect's cleanup releases the
  renderer created by the `gl` factory. It is deferred one macrotask and cancelled by a re-mount, because R3F keeps its
  root — and with it `state.gl` — across StrictMode's simulated unmount, and re-`configure` skips the `gl` factory
  whenever a renderer already exists: an inline dispose would leave the dev build holding a released device.
- **Native** (`UniverseCanvas.native.tsx`) drives a manual root, so it splits the work across three effects —
  **device** (keyed on `forceWebGL` alone), **children** (`root.render`), and **live config** (everything else). Only a
  backend switch may cost a device: `WebGPURenderer` cannot move to the WebGL2 path in place. Note that `getContext`
  mints a _new_ `GPUCanvasContext` on every call, so a device effect that re-keys on ordinary props leaks one native
  surface context per change on top of the visible black frame.

Everything else hot-applies to the running renderer: `toneMapping`/`toneMappingExposure`/`clearColor` by assignment
(three's `RenderPipeline` diffs them off the renderer each frame), `fov`/`far` on the live camera followed by
`updateProjectionMatrix()`, and the pixel ratio through the R3F store's `setDpr` — whose subscription answers with
`gl.setPixelRatio` + `gl.setSize`, resizing the backing store in place. Two traps live here:

- **Re-calling `configure` does not move the camera.** Its camera block is guarded on `state.camera === lastCamera`,
  which is false once a camera exists, so `fov`/`far` passed to a second `configure` are silently dropped. Reach the
  camera captured by `onCreated` instead.
- **Writing `canvas.width`/`height` by hand does not survive.** The same store subscription recomputes them from
  `size × dpr`, so the pixel ratio must go through `setDpr` (native resolves the `dpr` range itself — R3F's
  `calculateDpr` reads `window.devicePixelRatio`, which React Native does not have).

Both hosts carry lifecycle tests beside them (§3.5). They mock the platform modules rather than a GPU, because what
needs pinning is which effect re-runs on what — the regression that hides behind a working screenshot.

### Frame loop & adaptive quality

The loop runs **`always`** whenever the scene is visible, and that is a decision, not an omission: the ambient sky and
the twinkle animation ARE the product, so `frameloop="demand"` would render a still image of it. The levers are
therefore (a) do less per frame, and (b) render fewer pixels.

- **Nothing renders that nobody is looking at.** Web inherits rAF's hidden-tab pause. React Native has none, so
  `UniverseCanvas.native.tsx` subscribes to `AppState` and sets the root's frameloop to `never` while the app is
  backgrounded or inactive — which also stops the inline sim, since `FrameTick` pumps it from the same loop. It is
  imperative (straight to the running root, keyed on nothing) so backgrounding costs no React render and can never
  reach the device effect. `AppState.currentState` reads `null` before RN resolves it on an Android cold start; that
  counts as running, or a cold-started app would sit on a blank canvas.
- **Pixel ratio adapts to sustained fps.** `AdaptiveDprLayer` (shared, mounted by `UniverseSceneLayers`) averages
  frame time over `adaptive_dpr_window_seconds` and steps the ratio by `adaptive_dpr_step` between
  `ADAPTIVE_DPR_FLOOR` (1) and `max_pixel_ratio`: down below `adaptive_dpr_down_fps`, up above `adaptive_dpr_up_fps`,
  nothing in between. The decision is a pure function (`adaptive-dpr.ts`), unit-tested; only the closed-window STEP
  may reach React, never a per-frame sample (§3.2). drei's `PerformanceMonitor`/`AdaptiveDpr` are the stock answer
  and are not adoptable — drei's WebGPU line is unfinished.
  - **The fps dead band alone does NOT stop oscillation**, and that is the non-obvious part. Dropping the ratio is
    what raises the frame rate, so a device reading 44 fps at ratio 2 reads 58 at 1.75, climbs back to 2, falls to 44,
    and resizes every window forever — every measurement honest, every threshold respected. Nothing measurable
    separates it from a device with real headroom, because vsync caps both at 60. So the walk counts direction
    REVERSALS and settles after `adaptive_dpr_max_flipflops`, always on the lower of the two ratios (refuse the
    reversing step up, take the reversing step down) — drei's flip-flop idea, kept. A step swallowed by a bound is not
    a direction taken, so it cannot spend a flip-flop. Settling lasts the sampler's life; a scene remount starts over.
  - **Both hosts take the step through their `dpr` prop**, not through R3F's `setDpr`. R3F re-runs `configure` on every
    `<Canvas>` render and resets the store whenever `viewport.dpr` disagrees with what that prop resolves to, and the
    native host's live-config pass does the same — so a `setDpr` from inside the scene is undone by the next host
    re-render. Each shell owns the ceiling in state and injects a step callback (`onPixelRatio`, required, not
    optional) into the scene; the step travels up and re-enters as a prop, reaching the renderer through the in-place
    resize path and never the device effect.
  - The step is computed from the ratio **actually in force** (`viewport.dpr`), not from a remembered one, so a
    host-side clamp is never argued with — a sampler holding its own idea would drift above the clamp and spend
    windows walking back down to a step the device could see.
- **A dev-only measurement HUD** (`r3f-webgpu-perf`, the one maintained R3F panel that reads a WebGPU renderer) mounts
  in the web shell behind the diagnostics flag. It is a `devDependency`, so the import sits behind `import.meta.env.DEV`
  — a build-time constant, which eliminates it from production bundles rather than merely never taking the branch.

## Consumers

- **Web:** `apps/web/src/pages/universe` is the **signed-in main page (`/universe`)** — full-bleed `UniverseCanvas` (emotion sky + stars +
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
  That stub is why the mobile arm cannot see the native canvas host at all — its lifecycle test lives in the package's
  own vitest arm, with `react-native` / `react-native-webgpu` / `three/webgpu` mocked per file.

## The universe canvas (plan 23 as-built)

The first real consumer of the substrate: `widgets/universe-canvas` (web + mobile) renders the per-user memory graph
on the main page (`/` · mobile `UniversePage`). Its platform-agnostic core — the graph builder, the `UniverseSimBridge`,
the XState navigation machine, and the camera-rig scalars — is shared verbatim through **`@cosimosi/universe`**.
Sharing the core through a package — rather than copy-mirroring it into each app — is what keeps web and
mobile byte-identical (a copy-mirror drifts on formatting alone).

**The host itself is shared too, and that is a rule, not a convenience.** `@cosimosi/universe-render` owns the pair:

- **`useUniverseScene()`** — all the app-context work (the read, the graph and node index, the sim bridge lifecycle, the
  navigation actor, pick/fly/gist callbacks, the sky slices, the decoration→rendering translation, the latent field, the
  awaken anchors). It runs **outside** the canvas because React context does not cross the R3F reconciler.
- **`<UniverseSceneLayers>`** — the layer composition, in the one order that works, taking that result as props.

Each app widget is then a thin shell holding only what genuinely forks: its canvas host (web wraps the canvas in a
positioned DOM element, native mounts the surface itself), its sim spawner (web spawns a module Worker, native returns
null and the bridge runs the sim inline), and its fidelity budget (`latentStarCountMobile`, `fieldResolutionMobile`).
**This is what the `ui`-segment platform-marker exemption to promote-on-reuse (§3.1) does not cover:** two files
that each carry a platform marker are never compared to each other, so a duplicated host can sit there indefinitely.
It did, for ~330 lines, and drifted twice before being caught by review rather than by a gate — once on pick resolution
(native resolved through the graph, dropping the optimistic-launch tail) and once on `antialias`. When a shell grows
logic that is not platform-specific, that logic belongs in the shared pair.

- **Mount, never re-bootstrap.** Presentation units mount `UniverseCanvas` + `SkinProvider` + `PostFX` from the
  package and compose their scene inside; they add no renderer lifecycle, skin system, or post pipeline of their own.
  React context does **not** cross the R3F reconciler — app-context hooks (query/skin/machine) run outside the canvas
  and pass data in as props.
- **Antialiasing is the post chain's, on both platforms.** Both hosts construct their `WebGPURenderer` with
  `antialias: false`: a swapchain MSAA color buffer fights the post pipeline's resolve target, and both hosts mount
  `PostFX`, so requesting MSAA buys a multisampled buffer the composite never resolves from.
- **The read model** is three Zustand stores (episodic-memory / neuron / synapse; populated once per `GetUniverse`
  fetch), promoted to **`@cosimosi/universe`** (job 35) and shared verbatim by both apps, over `@cosimosi/memory` — the
  shared FE domain types + proto→domain mappers (strict at the boundary: unknown mood/neuron-type or a non-canonical
  synapse fails loud). The pages/screens wrap the widget in an
  error boundary — reset-wired through react-query's `QueryErrorResetBoundary` so its Retry actually refetches the
  failed `GetUniverse` read — so a corrupt row or read failure contains to the canvas area and recovers in place.
- **Scene primitives** are package layers, the only three importers: `InstancedNodeLayer` (one `InstancedMesh` sized to
  the active node count — bodies resolved through the `VisualBodySource` port, `createPrimitiveBodySource` binding
  generic unlit spheres until the real bodies land) and `FatLineLayer` (the shipped edge renderer — batched ribbons,
  raycast disabled so picking stays on nodes). Both READ the latest coordinate buffer in `useFrame` — coordinates never
  enter React state or a store, and nothing persists them [I5]. **WebGPU note:** a mesh is kept `visible = false` until
  it has ≥1 instance/segment to draw — a 0-count geometry inside the PostFX `pass()` makes the WebGPU backend build an
  invalid object bind group and wedges the device. `InstancedNodeLayer`/`createPrimitiveBodySource` remain generic
  package primitives; the universe scene composes the plan-24 star/cell-star/filament bodies over them (below). Bucket
  capacity is not a declared scalar — each body kind renders as one InstancedMesh / one batched ribbon, sized to the
  live count.
- **A clean frame recomposes nothing.** `InstancedNodeLayer` keys each frame on everything that can move an instance —
  the published coordinate version, the channels' identity, the slot window (`count` + `firstNodeIndex`), the flat
  scale, and an optional `animationRevision` ref a layer bumps when it animates through its own arrays — and when none
  moved it leaves last frame's matrices on the GPU instead of rewriting `count` of them and flagging an upload. The
  comparison is a pure function (`instance-frame-gate.ts`). Two rules keep it honest: a layer supplying
  `getInstancePosition` **opts out entirely** (a projection mapper derives from the clock, so nothing outside the clock
  says whether it moved — the gist rise), and a `CoordinateBufferRef` with **no** version writes NaN, which matches
  nothing and so always recomposes. Fail-open is deliberate: a wrongly skipped frame is a frozen scene with nothing on
  screen to say why. The cache is dropped whenever the matrices it vouches for are gone — a fresh `InstancedMesh`
  (which is why the mesh ref callback is stable, not an inline arrow: React re-attaches an inline ref every render) or
  a frame that hid the mesh for want of coordinates. `AwakenNeuron` is the animation-revision consumer: its flare pool
  early-outs while idle rather than rewriting its full `awaken_capacity` in zeroes every frame, and bumps the revision
  only on a frame that moved a scale.
- **The sim runs off the render thread**: `packages/force-sim` in a module Web Worker behind a `UniverseSimBridge`
  (`@cosimosi/universe`), two buffers ping-ponging as transferables; `FrameTick` pumps it once per frame. React Native
  has no standard Worker, so its per-app spawner returns null and the bridge runs the sim inline on the JS thread — the
  bridge/sim/scene stay shared and a future RN worker primitive slots in behind the spawner seam. On a refetch the
  bridge resizes the coordinate buffer to the new graph and carries existing node coordinates across the swap, so a
  growth refetch never flashes stale/origin geometry — and when the refetch brought the same graph back
  (`sameForceSimGraph`: every force/placement input, ordered), it keeps the running worker rather than respawning to
  reach the layout it is already producing. Plan 23 owns the full content-vs-identity rule and its other two seams. A worker/sim error terminates the bridge and reads as an
  **empty** universe (never a zero-stacked one); the shared graph builder coerces out-of-range **and non-finite**
  stored magnitudes into the sim's finite domain so a skewed or corrupt row cannot kill the scene, and structurally
  emits neuron↔neuron edges only [I4][I6] from connectivity alone [I3].
- **The coordinate seam publishes a version, and the version means the picture.** `bridge.coordinates` carries a
  monotonic `version` alongside `current`. It moves on start/remap and on a tick whose coordinates moved past
  `coordinate_publication_epsilon` — and NOT merely because the worker's `onmessage` fired or the inline `pump`
  ticked. So an unchanged version means an unchanged picture, which is the contract `InstancedNodeLayer`'s clean-frame
  skip rests on (below). A candidate is compared against the last **presented** buffer, never the last candidate, so
  drift that stays under the epsilon every tick still publishes once it accumulates past it. The inline arm ping-pongs
  two buffers it OWNS through `tick(dt, output)` rather than presenting `sim.coordinates`: that array is rewritten in
  place by every tick, so presenting it would make the version's claim false. The epsilon is sub-pixel at the closest
  framing the camera rig allows, so what it withholds cannot be seen. It does not silence a settled universe outright
  — `force_sim.min_alpha` deliberately keeps a little residual motion — it roughly halves how often one publishes.
- **Navigation** is the product `NavigationRig` (zoom · rotate · pan where a DOM canvas exists — the control families
  are inert on native for the MVP — plus machine-driven focus/fly glides). Glides disable the controls and drive the
  camera directly. It replaces the demo `CameraControls` for the
  universe scene; the demo layer remains for `/test`/`UniverseScene`. The camera/selection modes live in the XState
  navigation machine (`@cosimosi/universe`, ids-only context), polled per frame via `getSnapshot()`. Arrival is a pure,
  unit-tested latch (`navigation-latch.ts`): it fires ARRIVED once when the camera settles inside the epsilon shell,
  re-arms when the camera drifts out **or the travel target changes** (so a retarget across an unobserved idle frame
  can't strand the glide), and force-arrives past `arriveTimeoutSeconds` so chasing a still-drifting target always
  returns control. Rig feel scalars (`UNIVERSE_CAMERA_RIG`) are code-level constants in `@cosimosi/universe` (no
  `rendering.camera.*` values group exists yet).

- **Two ways to hold the universe, two control families.** What the two modes promise a viewer is
  [policy/ux/universe-view.md](../policy/ux/universe-view.md); this is the rig that keeps the promise.
  `useUniverseViewStore` (`@cosimosi/universe`) carries a view
  preference — `pinned` (the default a viewer arrives in) or `free` — and the rig wears the controls that mode needs:
  - **free** = `TrackballControls`, so rotation is unbounded in every direction (no polar clamp, no pole stall).
  - **pinned** = `OrbitControls` with `camera.up` set to the world's **+z** (the axis the two memory bands are stacked
    along, [V9]), `enablePan = false`, and the polar angle clamped to `[90° − pinnedTiltUp, 90° + pinnedTiltDown]` — the
    clamp trackball exists to avoid, wanted on purpose here. `camera.up` must be set BEFORE construction:
    OrbitControls reads it once, as the axis it orbits. The clamp is **asymmetric** — a larger rise above the flat than
    dip below it, because the rise is the view the band separation reads from — so the polar angle is bounded by the UP
    allowance at its minimum and the DOWN allowance at its maximum; the opening pose is levelled to elevation 0 rather
    than merely clamped, because the scene hands the rig a camera looking straight down and clamping alone would seat
    the view against the top of its own allowance with nothing left to rise into.

  The mode is a **preference, not a lifecycle** (no ordering, nothing to enter or leave), so it is Zustand rather than a
  second region in the navigation machine, and it is a rig **prop** rather than a polled value because swapping controls
  belongs to the effect that owns them. What is polled is `getPinnedView()`: the world point the flat camera orbits and
  whether something is holding it there (travel target → selection → spotlight → otherwise the stars' centre of mass,
  measured off the live coordinate buffer each frame, since positions are emergent [I5]).

  The pinned frame loop keeps the camera inside one bounded offset (azimuth · tilt off the flat · distance —
  `pinned-pose.ts`, pure and unit-tested). Inside the envelope it hands the camera to OrbitControls and keeps reading
  the pose back out as the home to return to; outside it (a glide just let go, or the mode was only now turned on) it
  eases position and **slerps orientation** toward the goal with the controls off — a lookAt would snap a rolled camera
  level on the first frame, and letting OrbitControls take a camera outside its clamp would snap it too. While a star
  holds the frame the home pose is left untouched, which is what makes closing a star's panel (`CLEAR_SELECTION`) glide
  the camera back to where the viewer was looking from rather than to wherever the glide ended.

- **Cross-route fly hand-off (plan 47).** The diary-reader jump lives on a separate route from the canvas, so it cannot
  send the navigation actor a `FLY` directly. It parks the target in a shared one-slot `usePendingFlyTargetStore`
  (`@cosimosi/universe`) and navigates home; the canvas widget consumes the request **only once the graph carries the
  node** — it sends `FLY` and clears the slot then, and leaves the request parked while the node is still missing, so
  the read already in flight gets its turn at resolving it. Consuming an unresolved target would drop the hand-off for
  good: the slot holds one request and nothing re-sends it. An episodic star's node id **is** its memory id, so the jump
  parks the first recalled `episodic_memory_id` with no translation. The reader never imports `three` or the rig (§3.4);
  the fly is a discrete navigation event.
- **Arriving is lit, not merely flown to (plan 47).** A glide toward one anonymous star inside a universe that is
  re-settling behind it reads as a page load, so the jump also names every memory it recalled in `useSpotlightStore`
  (`@cosimosi/universe` — ids only, no coordinate, no `three` type: which stars matter is the app's to say, how a scene
  shows that is the renderer's). While a spotlight holds, `SpotlightDim` eases the scene's light down toward
  `SPOTLIGHT_SCENE_DIM` and `StarLayer` multiplies the named memories' brightness channel by `SPOTLIGHT_STAR_LIFT`, so
  those stars come out brighter than they began rather than merely un-dimmed. The lift is drawn brightness only — it
  reads no stored fact and writes none, and `starLife` clamps at 1, so a lifted star keeps its own motion and forgetting
  stays the only thing that can still a body. **The dim is taken at the exposure, not at the materials and not over the
  finished picture:** `SpotlightDim` owns the easing and hands its level to `3d-renderer`'s `SceneExposure`, which
  scales `renderer.toneMappingExposure` — the multiplier the tone curve reads **before** it maps accumulated light onto
  the display. That is what makes a scene-wide dim behave like less light rather than like a grey sheet: sky, colour
  field, filaments, bodies and the bloom halo descend together, hues hold as they descend, and `StarLayer`'s lift on a
  spotlit body composes with it multiplicatively instead of the two acting on opposite sides of the curve. Scaling the
  composited output would do neither — the curve would never see the darkness, and the alpha would go with it.
  `SceneExposure` reads the host's exposure once at mount, so a level of 1 restores whatever the host chose, and a level
  that has not moved writes nothing, so a scene that never dims never touches the renderer. The
  hold runs on its own clock (`SPOTLIGHT_HOLD_SECONDS`, eased at `SPOTLIGHT_FADE_LAMBDA`) rather than on the camera's
  arrival, because `NavigationRig` can force-arrive while chasing a star that is still settling and tying the dark to
  that would let a timeout strand the universe in it. Per §3.2 the light is a per-frame ref, so the layer subscribes to
  the id list once and eases inside the frame callback; reduced motion gets the same darkness with no ramp, and the
  layer gives the light back on unmount. Its store cleanup is deferred one macrotask and cancelled by an immediate
  remount, so React StrictMode's development cleanup cannot erase a diary-armed spotlight before its first frame; the
  cleanup also compares the observed id-list identity before clearing, so it cannot erase a newer arm. Hold/fade/dim/
  lift are generated `rendering.spotlight_*` values; the store re-exports the established constant names so rendering
  consumers share the seam without owning a copy.

## Star / neuron / filament bodies (plan 24 as-built)

The three **rendering entities** turn the domain-mirror graph into bodies. Their body is a `VisualBodySource` from
`@cosimosi/3d-renderer/assets/bodies/` — so `three` stays inside the package.

> **As-built (job 35 — write vertical promoted to packages).** The rendering entities are no longer duplicated app
> slices. Their **pure channel projections** (`starChannels`/`cellStarChannels`/`filamentChannels`, nebula
> `buildContributors`, `latentField`) + the read-model stores live in **`@cosimosi/universe`**; their **R3F bindings**
> (`StarLayer`/`CellStarLayer`/`FilamentLayer`/`LatentStarField`/`NebulaField`/`AwakenNeuron`) live in
> **`@cosimosi/universe-render`** (depends on `@cosimosi/3d-renderer` + `@cosimosi/universe`). Both apps import them
> verbatim — one source, no `*.native` fork (nothing here uses a DOM/RN primitive). The apps keep only the forked
> DOM/RN sheets (`WritingFlowSheet`, `ReviseControls`, `LaunchButton`, …) and their session stores.

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
- **One body, away from the universe (plan 35).** `StarPreview` (`@cosimosi/universe-render`) draws a single episodic
  memory's star on its own canvas — the same `createStarShapeBodySource` body, the same `starChannels` projection, the
  same skin and `PostFX` the sky uses — so a panel shows the star rather than a swatch of its colour. Two channels
  differ, and only these two: **scale** is a fixed preview size, because size in the universe means strength _by
  comparison_ and one star alone has nothing to be bigger than (the panel states strength as a number instead), and the
  body is wrapped in `SpinGroup` so a still frame does not flatten a shape that is not flat. Tint, brightness and seed
  stay the real ones. Reading is not writing: the preview reads no stored fact it does not already receive and writes
  none.
- **`SpinGroup`** (`@cosimosi/3d-renderer`) turns its children about the vertical axis at a fixed seconds-per-turn,
  mutating the object3D per frame rather than through React state (§3.2/§3.3) and wrapping the angle so a surface left
  open for hours keeps its float precision. The rotation is a display device, not a fact about the thing shown —
  nothing reads the angle back, which is why `paused` (reduced motion) changes only what the eye gets.
- **`SceneExposure`** (`@cosimosi/3d-renderer`) is the one place a scene-wide dim is allowed to touch the renderer: it
  scales `renderer.toneMappingExposure` from a per-frame ref, restores the host's own exposure on unmount, and writes
  nothing while the level has not moved. Its consumer is `SpotlightDim` (plan 47, above), which owns the easing.
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
  A pool-limited overflow stays unclaimed and remains eligible on a later effect run. Once a pool-sized batch is
  attempted, the whole batch is claimed even if the latent field has fewer distinct unconsumed points: the represented
  subset flares, while the shortfall stops instead of retrying an exhausted field on every dependency change. The
  flare's duration, peak scale, and maximum resumed-frame step are generated `rendering.awaken_*` values; the
  `sin(πp)` envelope formula and visual body remain rendering code.
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
  with `firstNodeIndex = neuronCount` (memories share the star layer's buffer slots). The read model is read from the
  shared `@cosimosi/universe` episodic-memory store. The honest-mirror definition is told by the landing walkthrough and
  the demo, not by an affordance over the sky — the universe screen carries no disclosure component (plan 26).
- **Layer coexistence.** The nebula (per-memory domain emotion color) composites over the emotion-sky ambiance and
  behind the latent field + bodies. The skin selects the sky effect but does not derive memory meaning; the nebula
  never sets ambiance — neither writes to the domain.
- **Optimistic-launch interaction (plan 27).** A just-launched memory enters the `episodic-memory` store before its
  force-sim node exists, so its nebula kernel and star keep their instance slots but collapse to zero scale until the next
  `GetUniverse` refetch rebuilds the graph and the sim positions them. The §2.8 optimistic degradation ("position fills
  on next read") therefore never flashes false geometry at the world origin.
- **Mobile (§3.5).** The projection (`buildContributors`) + the `NebulaField` layer are the shared package modules; the
  mount passes `nebula.field_resolution_mobile` (coarser kernels). The `ColorField` TSL layer is shared — no `*.native`.

## Gist-star / z-layer rendering (plan 42 as-built)

The universe renders its **two z-layers as one navigable 3D depth** ([V9][V0]): the origin-centered hippocampus lens
(`force_sim.hippocampus_z_*`; episodic stars + latent field) below, the gist layer — the lens's per-stage z-offset
copy (`force_sim.gist_z_offset_*`) — above, with `BandFog` filling the guaranteed gap between the lens top and the
lowest gist reach (`hippocampus_z_min + gistZOffset(1)`); one scene, the plan-23 camera rig, no mode toggle, no
second camera.

- **A gist star copies the episodic live `(x, y, z)` and adds only a stage offset** ([C6][I5]). The neocortex runs
  **no force-sim**: `GistStarLayer` (`@cosimosi/universe-render`) derives each instance's position per frame — the
  full (x, y, z) read live from the memory's hippocampal sim slot, plus the memory-logic golden-parity
  `gistZOffset` lift for the instance's stage — via `InstancedNodeLayer`'s optional `getInstancePosition` mapper
  (per-frame, allocation-free; the default contiguous-slot path is unchanged). A rise eases only the offset delta
  (previous stage's lift → current), so the body keeps shadowing its drifting memory mid-rise and the lift itself is
  one-way. No absolute gist coordinate is ever stored, server-derived, or reverse-projected. `COORDINATE_STRIDE` is
  exported by the renderer as the coordinate-buffer contract's owner. A memoized `GistRenderSnapshot` owns the
  committed instance order, count, appearance arrays, and precomputed hippocampal slots; frame and pick callbacks close
  over that object. No render-phase ref publication can expose a work-in-progress ordering to the committed mesh.
- **One instance per risen MEMORY — the trace transforms, it does not stack.** `gist-star-channels.ts`
  (`@cosimosi/universe`, pure, shared web+mobile) emits exactly one instance for any `semanticStage ≥ 1`, whose z
  lift and softness read that current stage; a rise moves that one body upward rather than adding a rung beside it
  (CLS: one gradually-consolidated neocortical representation). Color = `moodColor(mood)` through the single palette seam and
  nothing else ([M3][I3]); size = `EffectiveStrength` lerped into `rendering.gist_star_size_*` (a quieter echo of the
  episodic range [V3]); softness = `rendering.gist_star_diffuse` at stage 1 deepening to fully diffuse at the ladder
  top ([V5]). The body's selection id is `gist:<memoryId>` — a function of the memory alone, stable across every rise,
  so no pick can address a rung the memory has already left. Because the id no longer changes when a stage does, the
  rise choreography diffs the **stage** per body (`GistRiseState.stageSeen`), not the presence of a new id. The
  `GetUniverse` DTO carries `semantic_stage` (the plan-40 read premise, realized here — the server facts always had
  it; the wire field was added, no new RPC). The four pregenerated `semantic_stages` texts and every `memory_provenance`
  row are untouched: 변천사 still lists one entry per crossed rung, free — what changed is how many bodies the sky
  shows, not what is remembered [I1].
- **Abstraction is z + a diffuse look, never shape** ([V5]). `gist-star-body.ts` (`@cosimosi/3d-renderer`) is its own
  TSL `VisualBodySource` — a facing-falloff glow ball (additive, depth-tested but never depth-written) with
  per-instance tint + softness attributes; the episodic seed channel is untouched by stage.
- **Which diffuse look is a worn ornament, not a layer decision.** `GistStarLayer` builds its body from
  `createGistShapeBodySource(shape)` — one key out of the `gist-shapes.ts` catalogue the design bench renders, sold as
  the `GIST_SHADER` kind, so a look chosen by eye reaches a universe by being picked in 꾸미기 rather than by re-typing
  a TSL graph into the layer. It is **one choice for the whole universe** ([V5] again — a gist has no shape identity of
  its own) and every entry reads the same tint + softness channels, so the worn key is the only thing that moves. The
  undecorated look is **not** a value: like `DEFAULT_SKY_EFFECT` and `DEFAULT_STAR_SHAPE`, it is owned by its own
  registry as `DEFAULT_GIST_SHAPE`. The two "the universe as it is" design panels (web `states-panel`, mobile
  `universe-panel`) take that same default, so they cannot drift from what an undecorated universe renders.
- **The gap depth cue is `BandFog`** — horizontal `DoubleSide` additive glow discs across the z 18–27 gap,
  visible from above and below, raycast-invisible, and depth-write-free (peak at the gap center, zero at both band edges;
  intensity `rendering.gist_rise_layer_fog`): a rendering affordance marking the boundary, never a wall and never a
  click shield. **One instanced draw, one material**: the discs' node graphs differed only by the slice strength
  constant, and a distinct graph is a distinct pipeline compile — the currency a WebGPU frame hitches on. Strength rides
  an instanced attribute (`aFogStrength`), so another slice costs an instance rather than a compile. The radial falloff
  reads `positionGeometry`, not `positionLocal`: an instanced disc measuring `positionLocal` would fade from the field's
  axis instead of from its own center.
- **The neutral stage-rise is appearance-driven and one-way** ([V8][I10]). Consolidation is the sole stage writer, so
  a stage change in the projection _is_ the advance's read landing. A memory's first gist appearance eases from that
  memory's hippocampal sim z into its first band z. A body deepening from stage N to N+1 instead eases from stage N's
  canonical `gistCoordinate` band z; it never snaps back to the sim layer and therefore never reverses. Both origins
  are fixed for the duration of the ease, so live sim motion cannot bend the rise downward. The first non-empty
  projection seeds silently (no page-load mass rise) and an empty interval adds no instance, so nothing plays. The layer
  guards the EASE against a stale read (its seen stage never goes down, so a rise cannot replay); the rendered POSITION
  is one-way because the read model it projects from holds the stage at its high-water mark — the invariant lives in the
  domain mirror, not as a second copy in the renderer ([policy/domain/semanticization](../policy/domain/semanticization.md)). The
  per-interval rise events surface on `GistStarLayer.onStageRise` — the **booked [V8] slot** the later-authored
  pulled-upward/relate-star replay choreography consumes; nothing more is built.
- **A gist star is read-only** ([R8][I8]). Its pick payload is `gistNodeId(memoryId)`; a pick sends the navigation
  machine SELECT only (a gist body is not a sim node — no camera glide), the star-detail resolver routes it through the
  injected `parseGistNodeId` recognizer as `{kind: 'gist', episodicMemoryId}`, and the panel forwards `memoryId` to the
  ViewSemantic surface seam. The server decides which current rung the read reaches — no 회고하기, no rewrite
  affordance, no un-rise/placement/stage control ([I10][I11]).
- **Mobile (§3.5).** Channels, body, fog, and layer are the shared package modules — no `*.native` fork; the mobile
  widget composes them identically (source-gate verified; on-device render pending).

## Config

`spec/values.yaml → rendering`: `active_skin` (preset key), `max_pixel_ratio` (the DPR CEILING the adaptive walk
climbs to, not a fixed ratio), `adaptive_dpr_window_seconds`/`adaptive_dpr_down_fps`/`adaptive_dpr_up_fps`/
`adaptive_dpr_step`/`adaptive_dpr_max_flipflops` (the adaptive-quality walk, below),
`coordinate_publication_epsilon` (the published-coordinate threshold, below),
the plan-24 visual ranges `star_size_min`/`star_size_max`,
`star_brightness_min`/`star_brightness_max`, `filament_width_min`/`filament_width_max`,
`filament_brightness_min`/`filament_brightness_max`, `cell_star_point_size`, plus the plan-25 latent-field scalars
`latent_star_count`, `latent_star_count_mobile`, `latent_star_segments`, `latent_star_segments_mobile`,
`latent_field_radius`, `latent_star_size`, `awaken_capacity`, `awaken_duration_s`, `awaken_peak_size`, and
`awaken_max_step_s` (the awaken pool and its choreography tuning; the envelope formula stays in code),
`spotlight_hold_s`, `spotlight_fade_lambda`, `spotlight_scene_dim`, and `spotlight_star_lift` (the diary-arrival
spotlight clock and pre-tone-map light factors), and the
plan-42 gist scalars `gist_star_size_min`/`gist_star_size_max` (the quieter `EffectiveStrength` → size range),
`gist_star_diffuse` (the base softness of the diffuse gist body), `gist_rise_layer_fog` (the gap depth-cue haze).
(Which gist look, which mote and which field a universe wears are **not** values — they are per-user ornament
selections, and each kind's undecorated look is its own registry's `DEFAULT_*`.)
(The stage→z map is **not** a value — it is the memory-logic `gistCoordinate` derivation over the reused
`force_sim.{hippocampus,neocortex}_z_*` bands; the rise duration stays a code-level layer constant.)

The backdrop and the body budget are config too: `star_field_count[_mobile]`, `star_field_radius[_mobile]`,
`star_field_mote_detail` (the star backdrop, above), and `star_shape_triangle_budget` — the per-instance triangle
ceiling every entry in the star-shape catalogue must build under, enforced over the whole registry by
`star-shapes.test.ts`. A star shape is a purchasable decoration multiplied by every memory in a universe, so a new look
that reaches for raw subdivision fails the gate instead of shipping a per-instance cliff. The displaced looks are carved
out of an **indexed icosphere** (`icosphere(segments)` in `star-shapes.ts`, 20 × segments² triangles): three builds
polyhedra non-indexed and uv-seamed, which would trade triangles for vertices, and a UV sphere spends most of its
budget at the poles where a uniformly-sampled relief has nothing to gain. `facet`/`prism` keep three's polyhedra
directly — their flat per-face normals ARE the look.

`spec/values.yaml → nebula` (plan 26, its own group): `bleed_radius_coefficient` (`EffectiveStrength` → bleed radius),
`min_bleed_radius` (floor), `falloff_exponent` (kernel density sharpness), `max_contributors` (kernel budget cap),
`field_resolution_web`/`field_resolution_mobile` (per-platform kernel tessellation), `base_intensity` (ambient
amplitude). Generated to `@cosimosi/config` (`VALUES.rendering.*` / `VALUES.nebula.*`) + Go constants via
`pnpm gen:values` — never hardcoded. (The star seed-form shader graph, the latent-field drift/flare motion, the nebula
falloff/blend graph, the compositing/blend mode, and the filament/cell-star/latent/nebula tint colors are code/content,
not values.)
