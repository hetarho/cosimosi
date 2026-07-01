---
name: fe-architecture
description: >-
  The frontend placement gate — invoke BEFORE creating, moving, or naming ANY frontend file (anything under
  apps/web/src, apps/mobile/src, or a FE package in packages/), and when reviewing whether FE code sits in the right
  place. Use when the user says "add a page/feature/component", "where does this file go", "wire up a provider", "build
  the X screen", or during /implement-job for any FE surface. It carries the Feature-Sliced Design decision procedure
  (layer → slice → segment), the app-layer segment rule, the web↔mobile parity rule, and a self-audit checklist. The
  authoritative rules live in spec/ARCHITECTURE.md §3 — this skill is the actionable procedure + audit, not a second
  copy of the rules. Read §3 first when a case is ambiguous.
---

# Frontend architecture gate (FSD)

**SSOT = [spec/ARCHITECTURE.md](../../../spec/ARCHITECTURE.md) §3** (layers/segments/placement), **§3.4** (domain→visual
projection), **§3.5** (mobile/packages). This skill does **not** restate the rules to own them — it gives the
*procedure* to apply them and the *audit* to catch drift. If a placement is ambiguous or you're unsure a rule still
holds, **open §3 and read it** — don't guess from memory. That is the whole point: the last time this step was skipped,
`apps/web/src/app` drifted flat.

## When this fires
Before you create/move/rename **any** file under `apps/web/src`, `apps/mobile/src`, or a frontend `packages/*`, and
whenever you review FE structure. `/implement-job` invokes this for every FE job.

## The decision procedure — where does this file go? (§3.1)

Ask in order:

1. **Domain noun or its rendering?** → `entities/<domain-noun>` (pure model/api, no `three`) vs
   `entities/<visual-noun>` (renderer projection). The projection is one-way (§3.4).
2. **A user-facing action (a verb)?** → `features/<verb>`.
3. **A big self-contained block reused across pages?** → `widgets/<block>`.
4. **A whole route/screen?** → `pages/<screen>` (composes lower layers; holds no domain logic).
5. **Domain-agnostic & reused?** → `shared` (or `packages/` if pure & cross-app).

Then pick the **segment** by technical role — never `components/`/`hooks/`/`types/`:
`ui` (React/R3F, the only platform-aware code; `*.native.tsx` lives here) · `model` (types, Zustand, **XState
machines**, pure logic) · `api` (backend calls + proto↔domain mappers) · `lib` (slice-internal helpers) · `config`
(slice-local constants; tuning numbers come from generated config, never hardcoded).

**Imports go one way only:** `app → pages → widgets → features → entities → shared`. Same-layer cross-import is
forbidden (only `entities`↔`entities` via `@x`). Each slice exposes one `index.ts`. Enforced by `steiger` +
`eslint-plugin-boundaries`.

## The app layer is segmented, not flat (the rule that drifted)

`app` and `shared` are **not sliced** — but they are **still divided into segments**, never a pile of loose files.
The `app` layer's segments are its technical roles: **`providers/`** (data/transport/i18n/theme/error/observability
providers + their config), **`routes/`** or **`navigation/`** (router / RN navigation), **`model/`** (app-shell
machine, app-level pure logic), **`styles/`** (global CSS). Only the true entrypoint (`App.tsx`, `main.tsx`, global
`index.css`) may sit at the `app/` root. A provider or config file dropped directly in `app/` is a **placement bug** —
put it in `app/providers/`. (This is FSD-canonical and matches `apps/mobile/src/app`.)

## Web ↔ mobile parity (§3.5)

`apps/web` and `apps/mobile` are peer apps with the **same layers and same slice names**. `model`/`api` and everything
in `packages/` are **shared verbatim** (no `three`/DOM/native by rule) — never copy them sideways between apps; promote
**down** to `packages/`. `ui` is shared by default; a `*.native.tsx` sibling exists **only** where a primitive
genuinely differs (DOM↔RN `View`/`Text`/gesture, web router↔RN navigation, canvas host wiring, token storage).
`three`/`@react-three/fiber` are imported **only** via the `@cosimosi/3d-renderer` package — never in a slice.

## Naming
kebab-case singular slices; PascalCase component files; camelCase/kebab elsewhere; **named exports only**.

## Self-audit (run before you call the FE work done)
- [ ] Every new file lands in a `layer/slice/segment` per the procedure above (no generic `components/`/`hooks/`).
- [ ] No loose files under `apps/{web,mobile}/src/app` except `App.tsx`/`main.tsx`/`index.css` — providers/config/router
      sit in `app/providers|routes|navigation|model|styles`.
- [ ] Imports are one-way; no same-layer cross-import; slices expose a single `index.ts`.
- [ ] No `three`/`@react-three/fiber` outside `@cosimosi/3d-renderer`.
- [ ] Anything shared between web & mobile lives in `packages/` (pure), not duplicated per app; a `*.native` sibling
      exists only where the platform genuinely forks.
- [ ] Gates green: `pnpm --filter @cosimosi/web lint` (steiger + boundaries) and `pnpm lint:fsd:layout` (app-layer
      segments + parity). Same for `@cosimosi/mobile`.
