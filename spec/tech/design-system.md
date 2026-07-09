# tech: design system

> As-built rules for cosimosi's design-system foundation (tokens, accessible UI
> primitives, theme/background seam) shared by web and mobile. The architectural
> frame lives in [ARCHITECTURE.md](../ARCHITECTURE.md) §3.1 (`shared/ui`), §3.4
> (the rendering projection seam), and §5 (i18n'd copy); this doc is the detailed
> rulebook the foundation (plan/09) installed. Product colors, the universe
> renderer, and customization are **not** part of this layer.

## 1. Where it lives

The `shared/ui` role from ARCHITECTURE §3.1 is realized as one cross-app package,
`@cosimosi/ui` (`packages/ui`), so a single primitive source renders on both apps.
It is the **platform-aware exception** to the "packages are DOM/native-free" rule:
it ships DOM (`*.tsx`) and React Native (`*.native.tsx`) siblings, selected by the
package's `exports` conditions.

| Concern                                        | Location                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| Canonical token source (DOM-free TS map)       | `packages/ui/src/tokens.ts`                                        |
| Generated Tailwind `@theme` (web + NativeWind) | `packages/ui/src/theme.gen.css` (committed, via `pnpm gen:tokens`) |
| Web base styles (reduced-motion, sr-only)      | `packages/ui/src/base.css`                                         |
| Primitives                                     | `packages/ui/src/primitives/<name>.tsx` + `<name>.native.tsx`      |
| a11y helpers                                   | `packages/ui/src/a11y/*`                                           |
| Theme/background seam                          | `packages/ui/src/theme/*`                                          |
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
(`CSS_TOKEN_GROUPS` = color, radius, shadow, duration, ease, ring, z). Spacing and
font-size stay TS-only — Tailwind's built-in scales already cover those utilities.

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

**Shipped now:** Button, IconButton, TextField, TextArea, Switch, Checkbox, Dialog,
Tooltip, Toast, Badge, Skeleton, VisuallyHidden. **Deferred** (added when a Phase-4
slice needs them, promote-on-use): Select/Menu, Tabs, SegmentedControl,
Slider/Stepper, Drawer.

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
- Reduced motion: `base.css` neutralizes CSS transitions/animations under
  `prefers-reduced-motion`; `useReducedMotion` (web `matchMedia`, native
  `AccessibilityInfo`) lets components drop JS-driven motion.
- Token text pairs meet WCAG AA (4.5:1); `tokens.test.ts` checks every documented
  pair via `a11y/contrast.ts`.

## 6. Theme / background seam

`theme/theme-store.ts` is **presentation state only**: theme name + a non-domain
background descriptor (`tone`, optional palette `accent`), with subscribe/get/set
and a `useTheme` hook. It cannot mutate domain, cache, emotion, engram strength,
recall state, or graph layout — it imports none of those. Future universe-background
parameters attach behind this same seam; domain→visual mapping (e.g. emotion→color)
belongs to the rendering projection (ARCHITECTURE §3.4), never here.
