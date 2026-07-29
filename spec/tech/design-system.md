# tech: design system

> As-built rules for cosimosi's design-system foundation (tokens, accessible UI
> primitives, the background seam) shared by web and mobile. The architectural
> frame lives in [ARCHITECTURE.md](../ARCHITECTURE.md) §3.1 (`shared/ui`), §3.4
> (the rendering projection seam), and §5 (i18n'd copy); this doc is the detailed
> rulebook the foundation (plan/09) installed. The universe renderer and
> customization are **not** part of this layer.
>
> This doc owns the **mechanism**. What the interface actually looks like — the colour, type,
> spacing, material, motion and state decisions the mechanism carries — is
> [design-language.md](design-language.md).

## 1. Where it lives

The `shared/ui` role from ARCHITECTURE §3.1 is realized as one cross-app package,
`@cosimosi/ui` (`packages/ui`), so a single primitive source renders on both apps.
It is the **platform-aware exception** to the "packages are DOM/native-free" rule:
it ships DOM (`*.tsx`) and React Native (`*.native.tsx`) siblings, selected by the
package's `exports` conditions.

| Concern                                        | Location                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| Colour source + theme registry                 | `packages/ui/src/palette.ts`                                       |
| Canonical token source (DOM-free TS map)       | `packages/ui/src/tokens.ts`                                        |
| Generated Tailwind `@theme` (web + NativeWind) | `packages/ui/src/theme.gen.css` (committed, via `pnpm gen:tokens`) |
| Web base styles (reduced-motion, sr-only)      | `packages/ui/src/base.css`                                         |
| Primitives                                     | `packages/ui/src/primitives/<name>.tsx` + `<name>.native.tsx`      |
| a11y helpers                                   | `packages/ui/src/a11y/*`                                           |
| Background seam                                | `packages/ui/src/theme/*`                                          |
| Web entry (web barrel)                         | `packages/ui/src/index.ts` (`exports` `default`)                   |
| RN entry (native barrel)                       | `packages/ui/src/index.native.ts` (`exports` `react-native`)       |

Apps depend on `@cosimosi/ui`; the package depends only on React (+ `react-dom` /
`react-native` as platform peers). It imports **no** domain, cache, transport, or
i18n package — enforced by `packages/ui/src/guards.test.ts`.

## 2. Tokens — one source, two outputs

`tokens.ts` is the single source of truth for token values. `scripts/gen-tokens.mjs`
emits `theme.gen.css` (a Tailwind v4 `@theme` block) from it; never hand-edit the
generated file (`pnpm check:gen` enforces freshness). Two consumers:

- **Tailwind utilities** (both platforms): the `@theme` block makes
  `--color-*`/`--radius-*`/`--shadow-*`/… available as classes (`bg-surface`,
  `text-text-muted`, `ring-focus-ring`) and as `:root` CSS variables. Web loads it
  through `@tailwindcss/vite`; mobile through NativeWind's Metro transform.
- **Raw TS values** where utilities can't reach: contrast checks, React Native
  style/color props (e.g. `ActivityIndicator` color), and tests import `tokens`.

Only foundation tokens that should _not_ fight Tailwind's defaults are emitted
(`CSS_TOKEN_GROUPS` = color, container, radius, shadow, duration, ease, ring, z).
Spacing and font-size stay TS-only — Tailwind's built-in scales already cover those
utilities.

**Colour is a layer above the token map.** `tokens.color` _is_ the active theme's role map, resolved
from the registry in `palette.ts` (ramps → semantic roles → themes). The generator emits the active
theme into `@theme` **plus one `[data-theme='<key>']` override block per registered theme**, so
adding a theme is a data change in `palette.ts` and nothing else — no generator, CSS, app, or type
edit. `defaultThemeKey` selects the active one; the web boundary (`apps/web/src/main.tsx`) stamps it
on the document root so portalled chrome re-skins with the page, and React Native resolves the same
registry statically through `native-styles.ts`.

Every value in the theme-invariant groups is either geometry or timing. The one exception used to be
elevation, which hardcoded a near-black; shadows now mix `var(--color-depth)`, and the glass
material's lit edge mixes `var(--color-specular)`, so both follow the theme.
`packages/ui/src/palette.test.ts` fails the build if a colour literal reappears below the palette
layer, and `scripts/lint-style-escapes.mjs` fails it if one appears in a product slice.

Design tokens / theme CSS are **not** `spec/values.yaml` config (values.yaml is for
numeric product tuning). Tokens live in code, as a token map + generated CSS.

## 3. Styling engines

- **Web:** Tailwind CSS v4 via `@tailwindcss/vite`. The entry CSS
  (`apps/web/src/app/index.css`) imports `tailwindcss`, `@cosimosi/ui/theme.css`,
  and `@cosimosi/ui/base.css` — the only place tokens enter the web app. Tailwind v4
  auto-detects content under the app only, so the entry CSS also declares
  `@source '…/packages/ui/src/**/*.{ts,tsx}'` — without it the utility classes used
  _inside_ the design-system primitives are never generated and primitives render
  unstyled.
- **Mobile:** plain React Native `StyleSheet`, built from the same token map via
  `packages/ui/src/native-styles.ts` (rem→px, color/spacing/font-size scalars).
  No NativeWind/Tailwind runtime on native.

> **Why not NativeWind on native.** NativeWind v5's engine (`react-native-css`)
> transforms through `@expo/metro-config`, and Expo SDK 56 vendors its own Metro
> fork (`@expo/metro`). The app bundles with the React Native community CLI's
> upstream `metro`, so the two Metro engines collide at serialization — NativeWind
> v5 can't run here without adopting Expo's full run/prebuild toolchain. The token
> StyleSheet bridge keeps the **single token source** (tokens.ts → web `@theme` +
> native StyleSheet) while letting mobile bundle on bare RN unchanged.

Web and native primitives are separate files by necessity (DOM vs RN elements; web
uses `hover:`/`focus-visible:`/`ring` Tailwind utilities that have no RN form).
Shared **types** (prop fragments, variant/size unions) live in `primitives/types.ts`;
shared **web** style constants in `primitives/button-styles.ts`; shared **native**
token scalars in `native-styles.ts`.

**Class composition.** `lib/cx.ts` joins class fragments (no conflict resolution);
the design-system's own variant/size maps are disjoint, so it suffices. The visual
axes are set through `variant`/`size` props; a consumer `className` (web) is for
_additive_ utilities (layout, spacing), not for overriding a variant's color — two
conflicting Tailwind utilities resolve by stylesheet order, not class-attribute
order, so an override is not reliable without `tailwind-merge`. If reliable
overrides are needed later, promote `cx` to a `cn` (clsx + tailwind-merge) with the
custom token scales registered via `extendTailwindMerge`. Native overrides already
win deterministically through the `style={[base, …, props.style]}` array.

> Mobile bundling note: `@cosimosi/i18n`'s Paraglide output uses `export * as`, which
> Metro's RN preset doesn't transform by default, so `apps/mobile/babel.config.js`
> enables `@babel/plugin-transform-export-namespace-from`.

## 4. Primitive rules

- Domain-agnostic, named exports only, kebab-case files. They take copy through
  props (`ReactNode`/`string`), never embedded literals — consumers pass i18n
  message output. `scripts/lint-raw-strings.mjs` scans `packages/ui/src` for raw
  user-facing strings.
- Cross-platform by construction: a `*.tsx` (DOM) and `*.native.tsx` (RN) sibling
  per primitive, both honoring the same props. The web and native barrels export
  the same API.
- Controlled/uncontrolled where conventional (Switch, Checkbox). A control with no
  visible `label` must be given `ariaLabel` so it is never unnamed.

**Shipped now:** Button, IconButton, TextField, TextArea, Select, Switch, Checkbox, Dialog, Sheet,
Tooltip, Toast, Badge, Skeleton, VisuallyHidden, Tabs, SegmentedControl. **Deferred** (added when a
Phase-4 slice needs them, promote-on-use): Menu, Slider/Stepper, Drawer.

`Sheet` is the surface that opens **beside** what it is about, and it is a separate primitive rather than a `Dialog`
setting: it renders no backdrop, traps no focus and is not a portal, so the thing behind it stays visible and
interactive. That is why it has **no `scrim` / `overlay` / `modal` prop at all** — the forbidden thing has no field, so
"a sheet that dims the universe" cannot be configured into existence. A surface that must interrupt is a `Dialog`; the
two are different promises, not two settings of one. Escape is unbound for the same reason (nothing is dimmed to escape
from), and `closeDisabled` lets a host block the one way out while a commit is in flight. Promoted on use by the
decoration panel, which exists to be watched against the running universe.

`SegmentedControl` is a **radiogroup**, not a second Tabs: its segments select a value and swap no
panel, so it carries no `aria-controls` and a reader hears a checked state rather than a tab position.
All options stay visible, which is what separates it from `Select`. Roving focus keeps the group to one
tab stop; a `value` outside the item set falls back to the first segment as the focus anchor, so a
caller bug can never leave the group keyboard-unreachable. Promoted on use by the diary archive's
newest/oldest order control ([D7]).

Slider/Stepper stays deferred for a reason worth stating: a continuous scalar has no place on the
writing flow's editable surface ([W4a][I3]), so the one obvious consumer must never exist. Promoting it
on use means it arrives only if something else genuinely needs one.

## 5. Accessibility baseline

Hand-rolled (no headless-UI dependency):

- All interactive primitives are keyboard reachable; focus rings are visible via the
  shared `FOCUS_RING` utilities and `--color-focus-ring`.
- Modal surfaces trap focus and restore it: `useFocusTrap` (web) cycles Tab/Shift+Tab,
  honors Escape, restores the previously-focused element, and ignores elements pulled
  from tab order (`tabIndex < 0`). React Native `Dialog` uses RN `Modal` (it manages
  its own focus), so `useFocusTrap` is web-only.
- Disabled controls are conveyed visually and semantically (`disabled` / RN
  `accessibilityState`). A loading control is disabled and `aria-busy`.
- Select is a **bounded choice**, and the platform control is kept rather than rebuilt: web renders a real
  `<select>`, so the option menu, type-ahead, keyboard model and every assistive-tech affordance are
  inherited and correct. It carries the same field contract as TextField — label association, one
  `aria-describedby` carrying description then error, `aria-invalid` when invalid, and `ariaLabel` for a
  labelless control. RN has no such element, so the native sibling is a field-shaped Pressable
  (`accessibilityState.expanded`, `accessibilityValue` for the current label) opening an RN `Modal`
  option list whose options carry `accessibilityState.selected`; `Modal` manages its own focus, exactly
  as `Dialog` does, so `useFocusTrap` stays web-only. Dismissing the list leaves the value unchanged.
- Tabs are controlled (`value` + `onValueChange`) so navigation state remains in the app layer. Web exposes a
  labelled `tablist`, `tab`/`tabpanel` relationships, selected state, roving focus, ArrowLeft/ArrowRight wrapping,
  and Home/End movement. Native exposes the same values and labels as a horizontally scrollable
  `tablist`/`tab` row with selected accessibility state.
- Reduced motion: `base.css` neutralizes CSS transitions/animations under
  `prefers-reduced-motion`; `useReducedMotion` (web `matchMedia`, native
  `AccessibilityInfo`) lets components drop JS-driven motion.
- Token text pairs meet WCAG AA (4.5:1); `tokens.test.ts` checks every documented
  pair via `a11y/contrast.ts`, for **every registered theme** — a theme is contrast-gated the
  moment it is added, before anything can ship it.

## 6. Background seam

`theme/background-store.ts` is **presentation state only**: a non-domain background descriptor
(`tone`, optional palette `accent`), with subscribe/get/set and a `useBackground` hook. It cannot
mutate domain, cache, emotion, engram strength, recall state, or graph layout — it imports none of
those. Future universe-background parameters attach behind this same seam; domain→visual mapping
(e.g. emotion→color) belongs to the rendering projection (ARCHITECTURE §3.4), never here.

The colour theme is deliberately **not** in this store. A theme is static data resolved once at the
composition boundary (§2); routing it through a runtime store would give the codebase a second,
drifting answer to "which theme is active".

## 7. Review surfaces

Two dev-only routes, both behind the diagnostics gate, with different jobs:

| Route     | Answers         | Contents                                                                       |
| --------- | --------------- | ------------------------------------------------------------------------------ |
| `/design` | "is it right?"  | the design showcase — tokens, every primitive in every state, composed chrome  |
| `/test`   | "does it work?" | the platform harness — transport, auth, cache, values, i18n, the live universe |

`/design` reads no domain data and needs no GPU, so it opens instantly and reproduces exactly; it is
the surface [policy/ux/design-review.md](../policy/ux/design-review.md) scores. Its static
interaction states come from `base.css`'s `.state-hover` / `.state-pressed` / `.state-focus`
wrappers, which are extra selectors on the real rules rather than copies of them.

## 8. The `Progress` primitive and the one-Toast contract

A **determinate** meter, and only that: `value` and `max` are the two server integers an achievement row carries, read
verbatim. There is no indeterminate mode and no precomputed-ratio prop, because a meter whose fill the caller computes is
a meter that can disagree with the number printed beside it. `role="progressbar"` on web and
`accessibilityRole="progressbar"` + `accessibilityValue` on native announce the same pair, so the two platforms report
identically. The width is an inline style deliberately — it is data, not a style choice, and there is no utility class for
"however far this user has got".

### The one-Toast contract

`packages/ui` owns a **queued** toast seam (`ToastQueueContext` · `usePushToast` · `ToastEntry`), platform-pure: React
only, no DOM and no i18n, and `message` is an already-resolved string. Each app's `app/providers/toast-provider.tsx`
holds the queue and renders **the head entry only** through the shipped `Toast`, shifting on dismiss or timeout.

**Exactly one `Toast` element exists in the tree, and that is the contract a new surface joins rather than works around.**
Two owners push today — the error path and the achievement unlock notice — and two independently-rendered toasts overlap
into something unreadable. The error provider therefore no longer holds its own state and `Toast`; it pushes. Because
`ErrorToastContext` and `presentAppError` are untouched, no `useErrorToast` consumer knows this moved.
