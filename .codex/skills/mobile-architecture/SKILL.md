---
name: mobile-architecture
description: >-
  The React-Native placement gate — invoke BEFORE creating, moving, or naming ANY mobile-specific file (anything under
  apps/mobile/src, a *.native sibling, metro/babel/native build config, or an ios/·android/ touch), and when deciding
  whether code should be shared vs forked for native. Use when the user says "add the mobile screen", "make this work
  on RN", "add a native module", "wire navigation", or during /implement-job for any mobile surface. It carries the
  shared-vs-forked rule, the *.native sibling discipline, the RN renderer setup, and a self-audit checklist. Pair it
  with fe-architecture (mobile mirrors the web's FSD). Authoritative rules live in spec/ssot/ARCH.md ARCH-27–30 —
  this skill is the actionable procedure + audit. Read those decisions first when a case is ambiguous.
---

# Mobile architecture gate (React Native, ARCH-27–30)

**SSOT = [spec/ssot/ARCH.md](../../../spec/ssot/ARCH.md) ARCH-27–30** (mobile mirrors web FSD; shared via `packages/`;
`*.native` only where the platform forks). Mobile is **not** a second codebase — it is the web's FSD applied to RN.
**Invoke [fe-architecture](../fe-architecture/SKILL.md) too** — the layer/slice/segment procedure is identical; this
skill adds only the native-specific discipline. If ambiguous, **open ARCH-27–30 and read them**.

## When this fires
Before you create/move/rename a file under `apps/mobile/src`, add a `*.native.tsx` sibling, touch
`metro.config.js`/`babel.config.js`/`ios/`/`android/`, or add a native dependency. `/implement-job` invokes this for
mobile jobs (alongside `fe-architecture`).

## Shared vs forked — the core decision
`apps/mobile` has the **same layers and same slice names** as `apps/web`. For any file, ask:

- **Is it pure logic** (`model`/`api`, types, XState machines, proto↔domain mappers, deterministic compute)? → it is
  **shared verbatim** via `packages/` (free of `three`/DOM/native by rule). Do **not** re-implement it in
  `apps/mobile`; import it. If it currently lives in one app and mobile needs it, **promote it down to `packages/`**,
  don't copy it sideways.
- **Is it UI** (`ui` segment)? → shared by default (the mobile UI mirrors the responsive web). Create a
  **`*.native.tsx` sibling only where the primitive genuinely differs**: DOM ↔ RN `View`/`Text`/gesture, the web
  router ↔ RN navigation, the `<Canvas>` host wiring, auth token storage. A `*.native` file that merely re-states the
  web version is drift — delete it and share the web one.
- **Is it native plumbing** (navigation root, metro/babel config, native modules, `ios/`/`android/`)? → it lives in
  `apps/mobile` only (the `app` layer's `navigation/` segment for the router; config at the app root).

## The renderer (ARCH-25 / ARCH-28)
The 3D scene is the **same `@cosimosi/3d-renderer` package** on both platforms — one TSL shader source. Native hosts it
via `react-native-webgpu` (+ reanimated + worklets); metro maps `three`→`three/webgpu` and `@react-three/fiber`→its web
build; `pod install`; New Architecture, RN ≥ 0.81, custom dev client (no Expo Go). Never import `three`/R3F in a
mobile slice — only via the package. Caveat: `react-native-webgpu` is pre-1.0 — pin exact versions; test on a physical
device (emulators fall back to a slow software adapter).

## Self-audit (run before you call the mobile work done)
- [ ] Ran [fe-architecture](../fe-architecture/SKILL.md)'s procedure — layer/slice/segment placement is correct and
      mirrors the web slice names.
- [ ] No `model`/`api`/domain logic duplicated in `apps/mobile` that belongs in `packages/`.
- [ ] Every `*.native.*` file exists for a genuine platform fork (DOM↔RN, router↔navigation, canvas host, token
      storage) — none is a needless copy of the web sibling.
- [ ] `apps/mobile/src/app` is segmented (`providers/`, `navigation/`, `model/`), not a pile of loose files.
- [ ] No `three`/`@react-three/fiber` outside `@cosimosi/3d-renderer`; native deps pinned.
- [ ] Gates green: `pnpm --filter @cosimosi/mobile typecheck · lint · test`; `pnpm lint:fsd:layout` (segments + parity).
      On-device render confirmed with `pnpm ios` where a device is available (the gate CI can't see).
