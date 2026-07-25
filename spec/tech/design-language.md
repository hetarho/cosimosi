# tech: design language

> The **visual language** of cosimosi — what the interface looks like and why. Its sibling
> [design-system.md](design-system.md) owns the _mechanism_ (the token pipeline, the primitive API,
> the a11y baseline); this doc owns the _decisions_ that mechanism carries. The architectural frame
> is [ARCHITECTURE.md](../ARCHITECTURE.md) §3.1 (`shared/ui`) and §3.4 (the 2D↔3D boundary).
>
> This is the **2D section** — DOM chrome, on web and React Native. The 3D universe (star bodies,
> the sky, the emotion palette values) is authored by [plan 57](../plan/57.3d-assets-and-background-design.md)
> and documented in the 3D section of this file when that job lands. Where the two meet — chrome
> floating over a live scene — the rule below is the 2D side of it.
>
> The review protocol that gates changes to this document is
> [policy/ux/design-review.md](../policy/ux/design-review.md).

## 1. The premise

The product is a universe you look into. Everything in 2D exists to let you read and act without
covering the thing you came for, so the language is built on three commitments:

- **The scene stays visible.** Chrome that floats over the universe is glass; chrome that carries
  text you have to read is opaque. Neither is a style choice — it is what the content needs.
- **Colour means something or it is absent.** A hue in the interface is either a role (primary,
  danger, …) or an emotion projected from the domain. There is no decorative colour.
- **Nothing announces itself.** Motion confirms, it does not perform. Emphasis is the smallest
  amount that works. The interface is quiet so the universe is not.

## 2. Colour

### 2.1 The two layers

Colour is authored once, in `packages/ui/src/palette.ts`, in two layers:

1. **Primitive ramps** — OKLCH scales (`navy`, `lavender`, `chartreuse`, `mint`, `gold`, `red`,
   `green`), each 11 steps on one shared perceptual lightness scale. These are the only raw colour
   literals in the codebase.
2. **Semantic roles** — a theme maps every role to a ramp _step_, never to a literal. Two roles that
   should match cannot drift, because they reference the same step.

Nothing below the palette names a colour. `base.css`, the primitives, and every product slice read
`var(--color-<role>)` or a Tailwind utility over it. Three gates hold that line:
`packages/ui/src/palette.test.ts` (no literal in `base.css`/`tokens.ts`),
`scripts/lint-style-escapes.mjs` (no literal in `features`/`widgets`/`pages`), and
`pnpm check:gen` (the generated CSS matches the source).

### 2.2 The roles

| Role                                  | Carries                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `bg` · `surface` · `surface-raised`   | the three ground planes: page, panel, raised panel                         |
| `text` · `text-muted` · `text-subtle` | primary copy, secondary copy, labels and metadata                          |
| `border`                              | hairline separation between surfaces                                       |
| `primary` · `secondary` · `tertiary`  | the three accents, each with a `-foreground` pair for text on top of it    |
| `danger` · `success` · `warning`      | status, each with a `-foreground` pair                                     |
| `focus-ring`                          | the keyboard focus indicator, one colour for every control                 |
| `overlay`                             | the scrim behind a modal surface                                           |
| `specular`                            | the lit edge of the glass material — physical light, owned by the theme    |
| `depth`                               | the colour every shadow is mixed from — the theme's ground pushed to black |

`specular` and `depth` are roles rather than raw white and black on purpose: they are the two places
a theme's light and darkness were previously hardcoded, and a universe with a different ground needs
both to move with it.

### 2.3 Applying colour

- **Surfaces** step up, never out: a panel is `surface` on `bg`, a raised element is
  `surface-raised`. Depth comes from the step plus a shadow, not from a border colour.
- **Accents are for action and identity**, not for filling area. A large field of `primary` reads as
  a warning in a dark interface; the accent belongs on a control, a rim, or a single word.
- **Status colour never travels alone.** A red rim or a coloured dot is always accompanied by text —
  colour-blind users must lose nothing.
- **Emotion colour is domain output, not palette.** Mood → colour comes from `@cosimosi/emotion`
  (`moodColor`), which plan 57 owns the values of. A 2D surface may _show_ an emotion colour — a dot
  beside a memory's name, a star-body preview — but it never mixes an emotion into chrome, and it
  never invents its own mapping. Emotion colour is data on the page; the role palette is the page.

### 2.4 Themes

A theme is a complete role map registered in `palette.ts`. **Adding one is a data change in that
file and nothing else** — `pnpm gen:tokens` emits its `[data-theme='<key>']` block, `ThemeKey` and
the showcase's theme list derive from the registry, and the WCAG suite covers it the moment it
exists. The active theme is `defaultThemeKey`, applied to the document root at the web composition
boundary so portalled chrome re-skins with the page; React Native resolves the same registry
statically through `native-styles.ts`.

**Shipped:** `aurora` — cool borealis; navy ground, lavender, chartreuse, mint.

## 3. Typography

Six roles, one rhythm. Size carries hierarchy, weight carries emphasis, colour carries nothing but
importance (`text` → `text-muted` → `text-subtle`).

| Role    | Web                                                              | Used for                          |
| ------- | ---------------------------------------------------------------- | --------------------------------- |
| display | `text-4xl font-semibold tracking-tight`                          | a page's one title                |
| title   | `text-2xl font-semibold tracking-tight`                          | a section heading, a dialog title |
| section | `text-lg font-semibold`                                          | a block heading inside a panel    |
| body    | `text-base leading-7`                                            | prose the user reads              |
| small   | `text-sm leading-6 text-text-muted`                              | secondary copy, descriptions      |
| eyebrow | `text-xs font-semibold uppercase tracking-wide text-text-subtle` | a category label above a group    |

- **Measure.** Any column of prose is capped with `max-w-measure` (the `container.measure` token).
  Past that width the eye loses the start of the next line.
- **Line height rises with the amount of text and falls with size:** `leading-7` for body prose,
  `leading-6` for secondary copy, default for single-line labels.
- **An eyebrow is not a heading.** It labels a group and stays out of the document outline; a real
  heading uses a heading element.

## 4. Spacing, density, hierarchy

- One scale (`tokens.spacing`, 4px-based). Density is chosen by picking a step, never by inventing a
  value between two.
- **Inside a control** 2–3 · **inside a panel** 4–5 · **between panels** 6–8 · **between page
  sections** the section rhythm (a heading, a rule, then its content).
- Hierarchy is built in this order, and each is used only when the one before it is not enough:
  **position → size → weight → colour → surface → border**. A border is the last resort, because
  every border added shrinks the space the content has.
- A group of controls reads left to right by decreasing emphasis: the committing action last on the
  right, the way out beside it as `text`.

## 5. Elevation and material

Two materials, one depth model. Both cast the theme's `depth` colour, so elevation reskins.

| Material        | Class                           | For                                                    |
| --------------- | ------------------------------- | ------------------------------------------------------ |
| Opaque surface  | `card-surface` / `Card` `solid` | content that must stay readable — lists, forms, panels |
| Glass — ambient | `glass-subtle`                  | HUD chrome that sits on the universe permanently       |
| Glass — panel   | `glass` / `Card` `glass`        | a floating panel over the scene                        |
| Glass — focused | `glass-strong`                  | dialogs and popovers, the surface that interrupts      |
| Bloom           | `bloom-soft`                    | an element that reads as a light source, not a surface |

- **Glass is for chrome over the universe, never for a content page.** On a flat background glass is
  a translucent grey box; it earns its cost only when something is moving behind it.
- The glass recipe is a theme-tinted fill + backdrop blur/saturate + a specular rim + a depth
  shadow. Small, numerous controls (buttons, chips, fields) get the _look_ without `backdrop-filter`
  — real blur on many elements costs a GPU pass each and seams on hover.
- Shadow steps encode distance, not importance: `sm` resting, `md` a panel, `lg` a floating surface.

## 6. Component style

The primitive API is plan 09's and does not change here; this is how those primitives look.

- **Button** is two independent axes — appearance (`contained` · `outlined` · `text`) carries
  emphasis, colour (`primary` · `secondary` · `tertiary` · `neutral` · `danger`) carries meaning.
  Any appearance composes with any colour, so a screen never needs a one-off button. One contained
  button per group; everything else is outlined or text.
- **Contained** is a filled liquid-glass lens: a role tint, a directional specular rim, a gloss, and
  a coloured glow. **Outlined** is a rim plus a soft glow ring, no fill. **Text** is a bare label
  that blooms on hover.
- **Fields** are recessed wells: a carved inner shadow, a hairline rim, the scene faintly readable
  through them. Colour never enters the fill — validation rides the border and the focus ring.
- **Badges** are outline-first: colour lives in the rim, the text, and an optional dot; the fill
  stays a whisper. Over the raw universe they raise their fill (`data-on-scene`) so small text keeps
  its contrast.
- **Toggles** — a switch commits immediately, a checkbox waits for the form. Both light up from the
  border and the glow, never as a solid slab of accent.
- **Overlays** — tooltip explains, toast reports, dialog interrupts. All three are glass, portalled,
  and return focus where they found it.

## 7. Motion

- `duration.fast` (120ms) state feedback · `duration.base` (200ms) chrome entering or leaving ·
  `duration.slow` (320ms) a surface crossing the screen.
- `ease.standard` everywhere; `ease.emphasized` only where something should feel picked up (a
  checkbox tick, a control that springs).
- Motion confirms a change that already happened. It never delays the user, never loops, and never
  carries information that is not also in the static frame.
- **Reduced motion is honoured globally** — `base.css` collapses transitions and animations under
  `prefers-reduced-motion`, and `useReducedMotion` lets a component drop JS-driven motion. Nothing
  is lost when it is on; if something would be, the motion was carrying meaning it should not have.

## 8. Iconography

- One geometry: a 20-unit viewBox rendered at `size-4`, `currentColor` so the icon inherits the
  control's ink, 2-unit strokes so weight matches the text beside it.
- `aria-hidden` on every icon. An icon-only control carries its name in `label`; an unlabeled icon
  is a guess the user has to make.
- Icons clarify a label, they do not replace one — except in a dense toolbar, where the tooltip is
  then mandatory.

## 9. State treatments

Every feature designs five states, not one. A feature without them is unfinished.

| State    | Treatment                                                                               |
| -------- | --------------------------------------------------------------------------------------- |
| default  | the resting design                                                                      |
| hover    | a step up in fill/rim density — never a size or position change                         |
| focus    | the shared ring: `ring-width` of `focus-ring`, offset `ring-offset` from the control    |
| pressed  | the surface settles inward (inner shadow), the glow tightens                            |
| disabled | 50% opacity, pointer events off, semantics set (`disabled` / `accessibilityState`)      |
| loading  | disabled + `aria-busy` + a spinner in place of the leading icon                         |
| empty    | what is missing, why it is missing, and the one action that fixes it                    |
| error    | what failed, in the user's terms, and the way to retry — never an apology, never a code |

Hover, focus and pressed are design decisions like any other, and the ones most often left
unreviewed because a static mock cannot hold them. The showcase holds them (§10).

## 10. The showcase

`/design` in the web app (`apps/web/src/pages/design`, behind the diagnostics gate) renders this
document as a running surface: the token foundations read from the registry, every primitive in
every state, and the composed chrome the primitives build. It is the artefact a design review reads.

It is deliberately separate from `/test`, which verifies platform wiring and the live 3D universe.
The showcase needs no GPU and no domain read, so it opens instantly and reproduces exactly.

The interaction states are shown with the design system's own rules, not with copies of them: the
`.state-hover` / `.state-pressed` / `.state-focus` wrappers in `base.css` are extra selectors on the
real rules, so a restyle can never leave the showcase advertising a state the product no longer has.

## 11. Sign-off

_Pending — the 2D language has not yet been through a review round under
[policy/ux/design-review.md](../policy/ux/design-review.md). The dated sign-off is recorded here._
