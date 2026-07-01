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
packages/3d-renderer/src/
├── shader-art/   noise · field · pattern · finish · sdf · geometry (+ tsl helper)  — pure TSL building blocks
├── skin/         presets (data) + background-node (composes the toolkit into a skin)
├── layers/       Background · StarField · PostFX                                    — shared R3F scene layers
├── canvas/       UniverseCanvas (web R3F + WebGPURenderer)                          — the only platform-forked surface
├── skin-context · SkinProvider · asset-source                                       — seam + §3.4 port
└── index.ts / index.native.ts / jsx-elements.ts
```

### Shader-art toolkit (the composable effect library)
Domain-agnostic procedural TSL techniques, two families: **effects** (`noise` fbm/worley/ridged · `field`
domain-warp/polar/kaleido/log-spiral · `pattern` cell-edge/iso-line/contour · `finish` fresnel/iridescent → color/mask
nodes) and **objects** (`sdf` · `geometry` → forms). Each is a pure node-in/node-out builder — no material, uniform,
React, or DOM. Skins **compose** these into a look. Authoring is **TSL only** (transpiles to WGSL + GLSL) — never raw
GLSL — so one source serves web + native. (Rich artistic layering/mixing is later product work; the foundation makes
the effects library-shaped.)

### Skins
A **skin** is non-domain ambiance: `UNIVERSE_SKINS` presets (palette + pattern params + bloom + camera) + a
`nebulaBackgroundNode` that composes the toolkit. The **active skin** is one build-time constant —
`rendering.active_skin` (`spec/values.yaml` → `@cosimosi/config`). The seam is `SkinProvider` + `useSkin()`
(`resolveActiveSkin` maps the constant); a future end-user runtime switcher ([P4]) replaces the source with no consumer
change. **Invariant:** the skin is presentation-only — it never sets per-memory emotion/position/strength ([I3][I11]).

### Across the R3F reconciler
R3F runs its own reconciler, so context from the DOM/RN tree outside `<Canvas>` does **not** reach in-canvas children.
The active skin is read with `useSkin()` at the boundary and **passed as a prop** to `Background`/`PostFX` — never via
context across the canvas.

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

## Config
`spec/values.yaml → rendering`: `active_skin` (preset key), `max_pixel_ratio` (DPR cap), `instance_bucket_size`
(instancing bucket capacity). Generated to `@cosimosi/config` (`VALUES.rendering.*`) + Go constants via
`pnpm gen:values` — never hardcoded.
