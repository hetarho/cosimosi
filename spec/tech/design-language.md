# tech: design language

> The **visual language** of cosimosi — what the interface looks like and why. Its sibling
> [design-system.md](design-system.md) owns the _mechanism_ (the token pipeline, the primitive API,
> the a11y baseline); this doc owns the _decisions_ that mechanism carries. The architectural frame
> is [ARCHITECTURE.md](../ARCHITECTURE.md) §3.1 (`shared/ui`) and §3.4 (the 2D↔3D boundary).
>
> It comes in two parts. **§1–11 is the 2D language** — DOM chrome, on web and React Native.
> **§12–21 is the 3D universe** — the bodies, the sky, and the emotion colours those bodies wear,
> authored by [plan 57](../plan/57.3d-assets-and-background-design.md). Where the two meet — chrome
> floating over a live scene — each part carries its own side of the rule.
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
  value between two. The radius scale works the same way. Both reach React Native through the native
  token map (`tokens.radius.lg`, not a hand-written `12`) — a scale that a platform cannot read stops
  being a scale, because the screens quietly write the numbers themselves.
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
- **A bounded choice is a picker, and it wears the same well.** The affordance says the set is closed —
  the user chooses from what exists and cannot extend it — which is why a mood is a picker and not a
  free field. **The platform control is kept, deliberately**: on web the element is a real `<select>`, so
  the option menu is the OS's and its keyboard, type-ahead and assistive-tech behaviour are inherited
  rather than approximated. The design system supplies only the material, so a picker and a text field
  read as one family. React Native has no such element, so there the field opens a modal option list —
  ours, so it borrows the dialog's manners: dismissing changes nothing, and the current value is marked.
  Where a chip row would sprawl across a small screen, the picker collapses it.
- **Badges** are outline-first: colour lives in the rim, the text, and an optional dot; the fill
  stays a whisper. Over the raw universe they raise their fill (`data-on-scene`) so small text keeps
  its contrast.
- **Toggles** — a switch commits immediately, a checkbox waits for the form. Both light up from the
  border and the glow, never as a solid slab of accent.
- **Alerts** — the inline alert is a rim, a whisper of fill, and plain ink (§9). It is a primitive, not
  a recipe a screen writes out: the same news must not read four different ways in four slices.
- **Overlays** — tooltip explains, toast reports, dialog interrupts. All three are glass, portalled,
  and return focus where they found it. A dialog is **bounded by the viewport and scrolls its own
  body**: it hosts real editing surfaces, and a surface that interrupts must never push its own
  actions past the bottom edge.

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

**Failure has two altitudes, and one treatment each.** A whole screen that could not load is an
**error state**: a card with a status badge, what failed, why, and the retry. A failure _inside_
chrome that still works — a step that did not go through, a consequence being offered before it is
accepted — is the **inline alert** (`Alert`): one row, the status hue on the rim over a whisper of
the same hue, the copy in plain ink carrying the way out. `live="alert"` for something that already
failed, `live="status"` for a consequence being offered; the choice is about timing, not hue. The hue
stays out of the ink — a paragraph tinted with a status colour is harder to read than the thing it is
warning about, and the rim already said which kind of news this is. A toast reports a failure once;
the alert is what stays until the user acts on it.

**A pending phase keeps its shape.** When a step replaces content with a wait, the note says what is
happening and skeletons stand where the result will land, under `aria-busy` and a polite live region.
A panel that collapses to one line and snaps back moves everything the user was reading.

## 10. The showcase

`/design` in the web app (`apps/web/src/pages/design`, behind the diagnostics gate) renders this
document as a running surface: the token foundations read from the registry, every primitive in
every state, and the composed chrome the primitives build. It is the artefact a design review reads.

The 2D groups need no GPU and no domain read, so they open instantly and reproduce exactly. The
`Universe` group (§20) does need a GPU, and it is on the same page on purpose — see §20 for why.
`/test` is a different thing: it verifies platform wiring, and it is scaffolding that goes away.

The interaction states are shown with the design system's own rules, not with copies of them: the
`.state-hover` / `.state-pressed` / `.state-focus` wrappers in `base.css` are extra selectors on the
real rules, so a restyle can never leave the showcase advertising a state the product no longer has.

## 11. Sign-off

**2026-07-27 — signed off.** Three rounds under
[policy/ux/design-review.md](../policy/ux/design-review.md), read on the running `/design` and on the
native showcase (iPhone 17 Pro simulator). Every 2D rubric dimension **Meets**, zero open Blocking,
every ledger note closed — the ledger is in [job 38](../jobs/archive/38.2d-ui-design-language.md).
No deferred items.

**Reviewer: Claude (the implementing agent), acting as reviewer — no human designer was in the loop.**
That is a weaker gate than the protocol intends (§1: the reviewer decides, not the implementer), and it
is recorded plainly rather than dressed up: a human designer's round supersedes this sign-off and
should append its own rounds to the ledger.

What the rounds actually caught, all fixed before sign-off: the writing-flow chrome was only ever
reviewable as a lookalike mock; the inline alert existed as a recipe copied into four slices instead of
a primitive; React Native rendered **no theme colour at all** (OKLCH tokens, silently dropped by
`StyleSheet`); and the native contained button was a solid slab of accent where the web builds a
translucent lens. The last two were invisible on every gate the repo had — they needed a device.

---

# Part II — the 3D universe

> §12–21. The mechanism is [tech/rendering.md](rendering.md) (R3F, WebGPU, TSL, instancing); this part
> owns what the universe **looks like**. Everything here is presentation: it sets no coordinates, reads
> no clock, and writes nothing back to the domain.

## 12. The premise

The 2D language exists so you can read without covering the universe. This part is the universe.

- **A body says what it is.** Every shape, every brightness, every colour is a stored fact projected —
  never decoration laid on top of one. If you cannot name which fact a visual difference came from, the
  difference should not exist.
- **The scene is a place, not a picture.** The sky is a body that encloses you, the nebula is what a
  region looks like, the depth between layers is space. Nothing is a screen-space wash, because a wash
  moves with your head instead of staying where it is.
- **Emergence is not authored.** Constellations, the global tone of a nebula, the shape of a cluster —
  these come out of the parts and have no type, no table, and no place in this document. What is
  authored is each part.

## 13. The projection

Four channels, and each has exactly one owner. This is the load-bearing rule of the whole part,
because a channel with two owners is a channel that says nothing.

| Channel        | Carries                                                 | Owned by                        |
| -------------- | ------------------------------------------------------- | ------------------------------- |
| **size**       | `EffectiveStrength` — how much the memory is            | plan 24 [V3]                    |
| **brightness** | `EffectiveBrightness` — how recently it was returned to | plans 24 · 37 · 39 [V2][F1][F2] |
| **colour**     | the primary emotion, and nothing else                   | plan 17 [I3]                    |
| **shape**      | the stored `seed`, immutable                            | plan 24 [V5]                    |

Three consequences that look like small choices and are not:

- **Emotion may not spend brightness.** A star's rendered luminance is its colour's own lightness times
  its brightness channel, so a mood free to be very light or very dark would make two memories of equal
  strength read as unequal because of how they felt. This is why the palette (§16) is not "bright =
  happy" and why its lightness is fixed to a ladder.
- **A neuron has no emotion and no seed.** It carries information, not feeling, so the cell-star is one
  colour and one size for all of them [V5]. A latent neuron has no identity either — the field is one
  colour and one size throughout [E7a][V7].
- **A synapse has no direction.** It joins two neurons; there is no from and no to. Nothing may flow one
  way along a filament and invent an order the domain never stored.

## 14. The bodies

Ten star shapes are registered (`assets/bodies/star-shapes.ts`), every one reading the **same** four
per-instance channels, so a look can be swapped under a live universe without touching a layer. The
registry is the design, not a shortlist: [plan 71](../plan/71.ornament-catalog-model.md) widens this
seam into the `STAR_SHADER` ornament, so each row is a legitimate alternative rather than a candidate
that lost. **`facet` — 다듬은 별빛 — is the free entry point**; `orb` stays as the bench's baseline (it
_is_ the primitive body source) without being what a universe wears.

Form and motion are one decision per body, not two:

- **Fixed polyhedra may turn in place.** A silhouette that cannot deform has nothing else to do with
  time, so facet, prism and the eight-point compass carry a seed-varied rotation.
- **Irregular bodies must change their form instead.** A body whose surface can move and merely rotates
  reads as a prop on a turntable. Seed-form, geode, bubble, urchin, plasma, contour and haze hold still
  and let their relief, cells, swell, spikes, heat, terrain or opacity evolve.
- **Motion has a ceiling.** An animated feature stays within 80–100% of its authored form. Past that a
  living surface stops reading as alive and starts reading as grotesque.

The other four bodies each say what they are:

- **Cell-star (Neuron) — a membrane, and it does not move.** Its interior shades down under its own
  silhouette (a view-space grazing rim, so it holds from any angle with no light in the scene), which
  reads as a small cell holding something. Deliberately motionless: the memory body breathes, the neuron
  holds. What a universe feels is alive; what it knows is stable.
- **Filament (Synapse) — a cord of light, pulsing inward from both ends.** The ribbon's centre line
  carries the colour and both rims fall to nothing, so a thick synapse reads as a bright cord and a thin
  one as a thread. The shimmer travels inward from A and B **together**, per §13's no-direction rule.
- **Latent field — dust, not beads.** Each mote fades at its own silhouette and composites additively,
  so a clump pools into haze instead of stacking hard dots, and each breathes on its own slow phase. One
  colour, one size: the only thing distinguishing a mote is when it happens to be brightest.
- **Nebula — gas, not a lens flare.** The mid-band is multiplied by a low-frequency cloud sampled in
  **world space**, so the structure belongs to the region rather than to the screen — the camera moves
  through it and two neighbouring contributors agree where the cloud is thick. The band mask holds the
  cloud off both centre and rim, so the peak stays on the contributor's exact coordinate and the
  silhouette fades before its own edge. Its kernel is a camera-facing billboard at that coordinate, so
  camera movement cannot shift the field peak off its star.
- **Gist body — the same memory, softer and higher.** A risen stage is a diffuse glow, distinguished from
  its episodic star by z-height and softness only, never by reparameterizing the seed [V5].

## 15. The sky

The sky is a **body**: a sphere drawn on its inner surface, enclosing the scene. Not a background layer,
not a screen-space gradient — those move with the camera and read as a photograph you are standing in
front of.

Backgrounds are the product's core revenue surface and have to grow without bound, so the catalogue is a
set of **arrangements** rather than a set of hand-written shaders. Four composable axes, and a backdrop
is a recipe over them:

| Axis        | Module                             | Offers                                                     |
| ----------- | ---------------------------------- | ---------------------------------------------------------- |
| **domain**  | `assets/sky/sky-domain.ts`         | bands · angle-to-anchor · tangent patches · cells · clouds |
| **field**   | `shader-art/noise.ts` · `field.ts` | fbm · ridged · worley · gnoise · domain warp               |
| **emotion** | `assets/sky/sky-emotion.ts`        | anchors · territories · the full-chroma blend              |
| **finish**  | `assets/sky/sky-finish.ts`         | width · rings · quantize · mark size · headroom            |

A primitive added to an axis multiplies across every recipe; a trick inlined into one recipe helps one
recipe. That is where the work goes, and it is why twelve recipes ship without twelve bespoke shaders.

Five rules hold the axes honest:

- **No chart, ever.** Every domain is a function of the surface direction alone. A chart that flattens
  the sphere onto a plane must gather it somewhere, and the gather is visible as a pinch — a sheet of
  paper drawn to a point. Where a recipe needs local 2D coordinates it uses a tangent patch around its
  own anchor, whose one degenerate point is the antipode, a hemisphere from the feature it describes.
- **Weight buys area.** A cap of angular radius `acos(1 − 2w)` covers exactly `w` of the sphere, and
  those radii sum to the whole sphere across a normalized weight set. A feeling's territory **is** its
  share.
- **Weight never buys depth.** A faint feeling is a narrow stripe of its own true colour, never the same
  region rendered paler. A hue diluted toward the night is a hue nobody can name, and naming it is the
  whole job of a palette.
- **Weight buys size, never opacity.** A mark drawn at low alpha does not read as faint; it reads as
  absent, and then as flickering when it crosses the threshold of visibility. Thin at full colour reads
  as what it is: a small amount of something.
- **A feature's place is a lattice, not a ring.** Features spread by the Fibonacci lattice, and a
  feature's size comes from its own weight — never from the count, never from the gap to its neighbours.
  Thirteen feelings are thirteen ordinary places, not one crowded circle.

**The light budget.** The stars, the nebula field and the bloom pass all ADD their light over the sky,
and addition over an already-bright surface passes 1 in every channel at once — which is white. So each
recipe states the ceiling it holds itself under (`rendering.emotion_sky_headroom.*`), applied as a soft
roll-off so structure survives at the top of the range rather than flattening onto it. The wider and
brighter a recipe fills the frame, the lower its ceiling. **The headroom is the sky's alone** — the
shared compositing path is untouched, so the bodies keep the brightnesses they were tuned at.

**No recipe caps how many feelings it takes.** The emotion axis already divides the sphere by weight, so
a sky handed thirteen feelings shows thirteen smaller territories rather than a muddier version of five.

**`grainient` is what a universe opens on** — one feeling washed over everything, the quietest the
registry can be and the floor the richer skies are bought up from.

## 16. The emotion palette values

Thirteen colours (`packages/emotion/src/palette.ts`), authored in OkLCH on the **2D language's own
perceptual lightness scale** (§2.1). Every one lands on step `300` (L 0.80), `400` (0.72) or `500`
(0.63). That is what makes the 2D↔3D match structural rather than a promise: chrome and bodies read the
same table through the one `moodColor` seam, and the emotion colours sit on the same ladder the chrome's
ramps do.

Three channels, one job each:

- **Hue is identity.** The warm arc (rose → coral → amber → gold → green) is pleasant, the cool arc
  (teal → blue → violet → magenta) unpleasant — the reading `checkPaletteAxisConsistency` guards, as a
  warning and never a block [P3].
- **Chroma is vividness.** ANGER is the most saturated colour in the table; NEUTRAL is almost
  colourless; TIRED and EMPTINESS are deliberately muted.
- **Lightness follows the hue, never the feeling.** Each hue sits on the step where it is most itself —
  yellow is only gold when light, magenta only crimson when deep. §13's brightness rule is why.

Two properties are guarded in `palette.test.ts` so the design cannot drift silently: every colour is on
one of the three steps, and no pair is closer than the authored minimum separation in OkLab. Thirteen
feelings have to stay thirteen colours against a dark ground.

## 17. Depth, and the two layers

The universe has two bands on z — the hippocampal layer where episodic stars live (0–18) and the
neocortical layer a risen gist rises into (from 27) — with a deliberate gap between them.

The gap is read as **atmosphere, not as a wall**: a depth haze across 18–27 marks the boundary while
leaving what sits in front of it legible. A layer boundary you cannot see through is a ceiling, and the
point is that the same memory exists on both sides of it.

## 18. State treatments

§13 leaves forgetting almost nothing to spend. Size is strength's, hue and chroma are the emotion's,
brightness it already has. What is spoken for by no stored fact is **movement** — and that turns out to
be the honest channel, because a body that has stopped moving reads as one that has stopped being
returned to.

- **Forgetting takes light, and it takes the breath.** A star's motion amplitude and rate follow its
  brightness (`starLife`), so a memory long unvisited sits almost still beside one still turning. Three
  boundaries hold it: the **form keeps its amplitude** at both ends — the breath shallows around its own
  mean rather than toward zero, because the seed-form is identity and identity does not fade; the floor
  is **not** zero, so a silent engram keeps a whisper of movement rather than becoming a prop (it is
  dimmed, never deleted [F2]); and it reaches every body through the three shared motion helpers, so a
  turn, a swell and a travelling wave all quiet by the same rule.

  Desaturation was considered and rejected. Chroma is the emotion's vividness (§16) — ANGER is the most
  saturated colour in the table and NEUTRAL almost colourless — so a faded ANGER would read as a fresh
  NEUTRAL. A channel with two owners says nothing.

- **Word-loss says nothing in 3D, deliberately.** Brightness already carries that the memory has
  eroded; _which_ words went is read up close, in the 2D hover glimpse and the star panel. Words are
  read, not seen from across a universe, and a star that tried to spell out its erosion would be
  claiming a resolution the medium does not have.

- **Gist rising reads by height alone.** A risen stage leaves its episodic star where it was, so one
  memory sits as two bodies over the same x and y; that a second one exists above **is** the
  relationship, and §17's band haze already marks the crossing. A tether was considered and rejected: it
  would be a new visual concept with no name in the ubiquitous language (a filament is a synapse, which
  this is not), and it would crowd a sky whose whole premise is space. Dimming the original was rejected
  too — the only channel available for it is brightness, which belongs to forgetting, so a consolidated
  memory would read as a forgotten one.

- **Awakening is a flare, and it carries no feeling.** A grey latent mote is replaced by a white-gold
  flare that grows and hands off to the real cell-star. It is emotion-free on purpose, which is §13's
  rule about neurons, not an omission. Whether its 1.1 seconds reads is an on-device question, not a
  design one.

## 19. Choreography

**Time passing happens to the place, not to the screen.** So the sky says it: while an acceleration
plays, the sky's own seconds run fast and ease back to rest on the transition's envelope. There is no
veil. A translucent sheet over the canvas — which is what this used to be — reads as something happening
to the viewer, and worse, it hides the very consequences the acceleration exists to show.

**The consequences are watched, not discovered.** An acceleration is the only moment a user can see
_why_ time matters, so two of them play inside it:

- **The stars quiet.** The scene projects at the sweep's **sampled** clock rather than the committed one,
  so brightness — and with it the breath of §18 — walks down across the sweep. Months of absence are
  watched happening instead of found already done. The sampled clock opens on the date the viewer last
  saw, never on the new one, because opening on the new one would brighten every star for a frame before
  dimming it back.
- **A gist is seen rising.** The rise already animates over its own beat and already publishes when a
  stage newly rises; what the choreography adds is that it belongs inside the sweep rather than
  whenever its data happened to land.

**A slept synapse thinning is deliberately not shown.** Filaments are numerous, and many of them
changing width at once turns a legible consequence into a screen that stirs. The `Downscale` is real and
readable afterwards, on the strand itself.

**Reduced motion skips the transition rather than slowing it** — it lands on the final clock and lets the
settled frame speak, because the sweep carries nothing the settled frame does not already hold.

**Both platforms drive it identically.** The sweep once forked (a DOM layer on web, an `Animated.View`
on native) precisely because each was rendering a veil. With the scene doing the talking, both hosts
write the same two channels and render nothing, so §3.5's parity here is real rather than mirrored.

The two channels leave the transition at very different rates, which is why they are two mechanisms: the
sampled clock is store state (a handful of updates per sweep, the budget the HUD already spends), and the
sky's rate is a plain ref written every frame, read inside the canvas's own frame loop — a per-frame
value may never be React state.

## 20. The showcase

The `Universe` group on `/design` — a fourth group beside Foundations · Primitives · Patterns, on both
apps. It is on the same page as the chrome on purpose: the rubric asks whether the two look like one
product, whether the glass is lit by the sky it floats on, and that cannot be answered from two separate
surfaces.

It cannot live on `/test`. The test harness is scaffolding that is removed once development is done, and
a sign-off surface has to outlast it.

- **Web** — the candidate bodies at one size and one brightness so only form and feeling differ; a
  recipe switcher over the enclosing sphere with a free emotion count; the colour field with its
  forced-WebGL2 remount.
- **Mobile** — the sky off the same TSL source, so a difference between the surfaces is a real parity
  finding rather than two authors' idea of the same sky. The frame budget is only real on a device.

The emotion count on the showcase is a **review convenience**, not a property of any sky (§15).

**Known gaps, recorded rather than left to be rediscovered:** the forgetting row is on the web surface;
the gist pair and the awaken flare are reviewed on the live universe rather than in the showcase, because
both read from the episodic store and the showcase does not seed it. The mobile group carries the sky
without the body types.

## 21. Sign-off (3D)

**Not signed off.** The gate is [policy/ux/design-review.md](../policy/ux/design-review.md) §7: every 3D
rubric dimension **Meets**, zero open Blocking, recorded as a dated sign-off with its ledger.

Where it stands: six working rounds (S1–S6) are in [job 39](../jobs/39.3d-assets-and-background-design.md),
all of them on the star bench rather than the full rubric, with their notes open pending a re-check on the
running surface. No round has yet scored all seven dimensions, and no on-device GPU pass has been run —
so §15's recipes and headroom values, and the bodies of §14, are unverified by eye at the time of writing.
Both §18 and §19 are now designed, so all seven dimensions are scoreable.
