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

| Concern                                            | Location                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| Colour source + theme registry                     | `packages/ui/src/palette.ts`                                       |
| Canonical token source (DOM-free TS map)           | `packages/ui/src/tokens.ts`                                        |
| Generated Tailwind `@theme` (web + NativeWind)     | `packages/ui/src/theme.gen.css` (committed, via `pnpm gen:tokens`) |
| Web base styles (reduced-motion, pointer, sr-only) | `packages/ui/src/base.css`                                         |
| Web `@font-face` (Wanted Sans, dynamic subset)     | `packages/ui/src/fonts.css`                                        |
| Primitives                                         | `packages/ui/src/primitives/<name>.tsx` + `<name>.native.tsx`      |
| a11y helpers                                       | `packages/ui/src/a11y/*`                                           |
| Background seam                                    | `packages/ui/src/theme/*`                                          |
| Web entry (web barrel)                             | `packages/ui/src/index.ts` (`exports` `default`)                   |
| RN entry (native barrel)                           | `packages/ui/src/index.native.ts` (`exports` `react-native`)       |

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
  **The utility's name is the token's name, exactly** — the page ground is `--color-bg`, so the class
  is `bg-bg` — and a rule is generated only for a name the `@theme` block carries. A class spelled
  over a name no token has is not an error anywhere in the toolchain; it is simply absent, so the
  element keeps whatever was beneath it and a state that should have painted reads as no state at all.
- **Raw TS values** where utilities can't reach: contrast checks, React Native
  style/color props (e.g. `ActivityIndicator` color), and tests import `tokens`.

Only foundation tokens that should _not_ fight Tailwind's defaults are emitted
(`CSS_TOKEN_GROUPS` = color, container, font, radius, shadow, duration, ease, ring, z).
Spacing and font-size stay TS-only — Tailwind's built-in scales already cover those
utilities.

**`font` is the one group that deliberately replaces a Tailwind default, and the one group native
cannot read.** It emits `--font-sans`, so the built-in `font-sans` stack _becomes_ the Wanted Sans
stack and every element that never names a family inherits it through the web entry's `body` rule —
no slice opts in, and there is no second way to spell "the interface font". The faces load from
`fonts.css` (§3). React Native resolves `fontFamily` against a font asset linked into the native
build and silently falls back to the system face when it cannot, so a CSS fallback _stack_ would be
a token that reads as applied and does nothing; `native-styles.ts` drops the group rather than pass
it through, and `native-tokens.test.ts` holds that line. **Known gap:** Wanted Sans is not yet
linked into the RN app, so mobile still paints in the system face — when it is linked, `font`
returns to the native map as a converted group (a family name), exactly as colour and radius do.

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
  (`apps/web/src/app/styles/index.css`) imports `tailwindcss`, `@cosimosi/ui/theme.css`,
  `@cosimosi/ui/base.css` and `@cosimosi/ui/fonts.css` — the only place tokens enter the web app.
  Tailwind v4 auto-detects content under the app only, so the entry CSS also declares
  `@source '…/packages/ui/src/**/*.{ts,tsx}'` — without it the utility classes used
  _inside_ the design-system primitives are never generated and primitives render
  unstyled.
- **Web fonts:** `fonts.css` imports Wanted Sans from the `wanted-sans` npm package — self-hosted
  rather than the vendor's jsDelivr URLs, so the version sits in the lockfile, the bytes ship from
  the app's own origin, and no third party sees a reader's requests. It is the **variable dynamic
  subset** build: one face covers weight 400–1000, and 92 `unicode-range` slices mean the browser
  fetches only the glyphs on screen. The subset must be dynamic — star names and diary entries are
  user input, so the glyph set is unknowable at build time. Vite emits the slices as hashed assets;
  `font-display: swap` (from the vendor stylesheet) keeps the first paint off the font's critical
  path. `apps/blog` is a standalone Astro build that deliberately does not depend on
  `@cosimosi/ui`, so it imports the same package stylesheet directly and names the same stack.
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

**Shipped now:** Button, IconButton, TextField, TextArea, Select, Switch, Checkbox, Dialog, Sheet, Menu,
Tooltip, Toast, Badge, Skeleton, ObscuredText, VisuallyHidden, Tabs, SegmentedControl, BrandMark, and the icon set.
**Deferred** (added when a Phase-4 slice needs them, promote-on-use): Slider/Stepper, Drawer.

`BrandMark` is the one **web-only** entry, and the one exception to the sibling rule above: it draws the trademark's
solid to a `<canvas>`, which has no RN counterpart to honour the same props with, so it is exported from `index.ts` and
not from `index.native.ts`. A `.native` sibling arrives when a mobile surface asks for the solid. It lives here rather
than in a page because it needs the primary ramp's STEPS (design-language §2.5) and colour may not be named outside this package —
and because the mark is domain-agnostic and both apps will eventually want it. It is deliberately **not** built on
`@cosimosi/3d-renderer`: that package hosts the universe, where a body's channels mean stored facts and every canvas
costs a GPU device, a swapchain and a post chain. A brand mark asserts nothing about anyone's memories and needs none of
that machinery to draw eleven triangles. See design-language §2.5.

The **icon set** (`primitives/icons.tsx` + `.native`) is a primitive like any other, and the one place
a Phosphor glyph is named: it exports icons by product meaning (`DiaryIcon`, `TwinkleSmallIcon`, `DeleteIcon` for 지우기,
`ResetIcon` for 조건 초기화 — the way back out of a narrowed view, which restores nothing and destroys nothing —
`StarActionsIcon` for a star's own actions gathered behind one control, …), so
swapping a glyph or the whole family never reaches a slice. Two meanings may share a glyph and stay two exports —
`StarActionsIcon` and `SettingsIcon` are both the gear today, because a slice asks for the star's actions rather than for
a gear, and rebinding either one later is a change in this one file. Web takes ink from `currentColor`; native,
which has none to inherit, takes a token colour prop. Native imports per glyph — Metro does not
tree-shake, and the package root is ~25 MB of icons. See design-language §8.

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
caller bug can never leave the group keyboard-unreachable.

The held choice is carried by a **thumb** — a translucent raised lens with a specular hairline, sliding
beneath the labels — because ink weight alone cannot say _which one_ at a glance: the step from
`text-muted` to `text` is a fraction of a lightness unit at the top of the near-white range. It slides
rather than jumps because the movement is the answer; a thumb that jumped would repaint two segments
and leave the eye to work out which of them changed. The thumb is an **`aria-hidden` sibling** of the
radios, never a wrapper around them — an element between the radiogroup and its radios takes away the
ownership some assistive tech reads, and the group has to go on owning its own radios. Its geometry
rests on **equal-width segments** (`flex-1 basis-0` on web, `flex: 1` on native), which is what buys
the travel: on web the thumb is one transform over the `--segment-count` / `--segment-index` pair the
group carries, with nothing measured at all; on native, where a transform takes pixels, the track is
read once from `onLayout` and divided by the count. Neither measures a _label_, so a locale swap that
changes every label's width moves nothing. Reduced motion is honoured in each platform's own currency:
the web travel is a CSS transition, so `base.css`'s global rule collapses it to an instant landing with
no JS to gate, while React Native has no such layer and the native sibling asks `useReducedMotion()`
and sets the thumb's position outright. Promoted on use by the diary archive's newest/oldest order
control ([D7]).

`Tooltip` is **portalled to `document.body`**, as the dialog and the toast are. A tip is the smallest thing on
screen and the last thing that should lose a paint-order argument: rendered beside its trigger it is sealed inside
whatever stacking context an ancestor happens to open — and this product's chrome is built out of exactly those (glass is
a `backdrop-filter`, a lit label is a `filter`) — so any z-index it carried would only sort it against its own siblings.
Placement stays **stated** (`side` / `align`): nothing here flips a side or hunts for room, because only the composition
site knows which way there is space. What the portal gives up is the anchoring a sibling gets for free, so the TRIGGER's
rect is measured — and that is the whole of what the measurement is for, turning the caller's stated side into
`position: fixed` pixels. Those pixels go stale the moment anything moves, so an open tip re-places on `resize` and on
`scroll` in the **capture** phase: the trigger may sit in a list that scrolls under it, and a scroll on an element never
reaches a bubbling listener on `window`.

`Menu` is a short list of commands behind one control. The list is the caller's — the primitive owns only whether it is
showing, where the keyboard sits inside it, and the three ways out (a choice, Escape, a press elsewhere); every item
closes the list before it acts, so a command that opens another surface never leaves this one hanging over it. Placement
is **stated** (`side` / `align`) — the same stance `Tooltip` takes — and here nothing is measured at all, because the
list stays inside its trigger's own box: a menu is wider than the icon that opens it, and only the composition site knows
which way there is room. **Escape is stopped inside the list**, and bound with a NATIVE listener on the panel rather than
React's `onKeyDown`: a `Menu` composed inside a `Dialog` sits under that dialog's focus trap, whose own Escape closes the
whole surface, and React delegates from the tree's root, so a synthetic handler would run only after the trap's listener
on an ancestor had already closed the dialog. Dismissing returns focus to the trigger, the one element a caller is
guaranteed to have rendered. Promoted on use by the star-detail panel, which gathers a star's occasional actions behind
one control on its preview frame.

`ObscuredText` draws a passage some of which has stopped being legible. The runs arrive **already decided** — this
renders them and judges nothing: a legible run is plain text, an obscured one is the same characters under a blur strong
enough that no shape survives, which is what makes the loss something a reader SEES rather than something a label tells
them. Selection is disabled over the runs, since selecting is the one way a filter cannot follow the text; under forced
colours, where `filter` is stripped outright, a run becomes a solid bar of system ink instead — a different picture of
the same fact, losing exactly what the blur loses. React Native has no CSS `filter`, so the native sibling makes the
smear the way the platform can: transparent ink behind a wide zero-offset text shadow, the glyph's light without its
edges. The runs stay in the accessibility tree either way, so assistive tech is handed the sentence that is on screen
rather than a shorter, tidier one.

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

**A session-scoped owner is dropped at the session boundary, not by its own host.** An entry carries an `owner`, and
`packages/ui` declares both the tags that belong to one signed-in session (`ACHIEVEMENT_NOTICE_TOAST_OWNER`) and the list
of them (`SESSION_SCOPED_TOAST_OWNERS`, defined over the tags so the two cannot drift). Each app's client-cache provider
iterates that list in `SessionScopeBoundary`'s `onScopeChange` and calls `dropByOwner`. That placement is load-bearing:
the queue lives ABOVE auth (an auth error has to be able to toast), so unmounting a feature's host is not enough — an
entry waiting behind a long-dwelling error would surface for whoever signs in next. It is a change callback rather than
an effect keyed on the signed-in identity, so a development double-effect cannot discard notices the incoming session
just queued. Adding a session-scoped owner is one edit to the list plus the import at the pushing surface.
