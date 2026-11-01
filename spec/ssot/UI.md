# UI 2D UI design
> r1 | the 2D chrome of web and mobile: the criteria a surface is judged against, the design-review protocol, the design-system mechanism (`@cosimosi/ui`, tokens, primitives, accessibility) and the visual language it carries

## decisions
- UI-1 [o] the product is a universe you look into: 2D chrome exists to let the user read and act without covering it, under three commitments
  - the scene stays visible: chrome floating over the universe is glass, chrome carrying text the user must read is opaque; neither is a style choice
  - colour means something or is absent: a hue is a role or an emotion projected from the domain, never decoration
  - nothing announces itself: motion confirms, emphasis is the smallest amount that works; the interface is quiet so the universe is not
  - UI owns DOM and React Native chrome; bodies, sky and the emotion palette values →=VIS
- UI-2 [o] the design practice has four owners: criteria (UI-3–14), the review protocol (UI-15–22), the language's decisions (tokens, roles, materials) and the design-system mechanism
  - every criterion carries an evidence tier: research (empirical, never bends to preference), canon (decades of practitioner consensus, bends only with a stated reason), convention (current practice, bends knowingly)
  - a research criterion outranks a language decision: on conflict the language changes, through a review round; a convention bends to the language without ceremony
  - a review finding cites a criterion, never a taste
  - the criteria bind every composed 2D surface, product chrome and public pages alike
- UI-3 [o] hierarchy: every screen declares one most-important element and is built outward from it; two equally loud elements are zero hierarchy (canon)
  - one primary action per screen, at most two "big" elements per page; emphasis is a budget spent in one place, since competing highlights cancel (Von Restorff, research)
  - three volumes or fewer per screen: about three text sizes and three contrast levels, out of the six type roles (canon) →~UI-39
  - weight and colour do most of the work, size alone is weak; de-emphasizing the secondary is hierarchy work too (convention) →=UI-41
  - the squint test is the check: blurred until detail is gone, what still stands out must be the intended hierarchy (canon)
  - type sizes come from a modular scale, never local judgement (canon); a marketing surface runs a larger, fluid display scale →!UI-40
- UI-4 [o] grouping follows the Gestalt principles (research): proximity, similarity, common region, continuity, closure, common fate
  - whitespace is the first grouping tool, a border the last: every enclosure adds noise, and a wall of boxes creates false floors
  - unequal spacing is information: the gap inside a group is visibly smaller than the gap between groups
  - same thing, same look, everywhere, or it reads as a second kind of thing (canon); fewer alignment edges, harder commitment to each (canon)
- UI-5 [o] the first screenful is judged as a picture before any word lands: low clutter, one focal point, a genre-recognizable structure (research)
  - appeal is judged within about 50 ms and halos onto credibility; low-to-medium complexity and high prototypicality win, so novelty spends prototypicality →~UI-11
  - the first screenful carries the message and the primary action; headings carry their information in the first words, sections their point in the first sentence
  - the F-pattern is a symptom of missing hierarchy, not a layout →~UI-14
  - no false floors: a page that continues shows it (a cut-off element, a cue, a next heading rising into view)
  - five-second test (convention): a cold visitor shown the first screenful for five seconds can say what the product is and who it is for; poetry that costs this answer goes in the subhead
- UI-6 [o] Korean and Latin share one family but keep their own composition rules →~UI-37
  - Korean headlines and short display copy break at word boundaries: `word-break: keep-all`, `overflow-wrap: break-word` as the narrow-column escape, multi-line headings balanced (`text-wrap: balance`); long prose keeps syllable breaking (canon)
  - Korean measure is counted in Korean, about 35–45 characters against the Latin 50–75, since a Latin-tuned measure is a third too wide for Hangul (convention)
  - leading rises with the amount of text and falls with size: about 1.5 for body and long-form, 1.1–1.3 for headings (research)
- UI-7 [o] dark surfaces over a live scene are designed for their worst frame
  - contrast: WCAG 2.x AA is the conformance floor and the only claim (checked by the token gate →=UI-29); dark pairs are also designed with APCA (Lc 75+ body, Lc 60 other content text, Lc 45 headlines), never the reverse
  - the scene may be black, a text surface may not: text surfaces sit at `#121212`-class lightness and elevation is a lighter step ← white on black blooms, hardest on astigmatic readers
  - de-emphasized text on a tinted ground keeps its hue: hold OKLCH H, lower L and C (convention)
  - text-bearing glass declares a contrast floor (minimum tint opacity and rim) against the brightest state the scene behind it can reach, never a typical sky
  - every surface and control keeps a real border (transparent when the look demands), so `forced-colors: active` still draws an edge once glass and shadows are stripped
- UI-8 [o] one decision per moment: a step that asks two questions is two steps compressed into a worse one (Hick, research)
  - complexity is conserved: what the system does not absorb, the user does (Tesler, canon)
  - chunk into grouped, labelled structure; "seven items" is not a cap (research)
  - every element taxes every other: finished means nothing more can be removed (canon)
- UI-9 [o] every action reports back: a feature without its states is unfinished (canon) →!UI-58
  - under 400 ms, or show why not: skeletons that hold the shape, progress that moves (Doherty, research)
  - hit areas: floor 24×24 CSS px (WCAG 2.5.8 AA), design target 44–48 px for primary controls; the hit area counts, not the drawing, on-scene targets included (research)
  - focus is designed, never suppressed: `:focus-visible`, never fully covered by sticky chrome or a toast (WCAG 2.4.11); the AAA appearance (≥2 px perimeter, 3:1 state change) is the design target, AA the claim
  - recognition over recall: the interface remembers so the user does not (canon)
  - exits are marked: every flow can be left without ceremony, and only destructive paths ask (canon)
- UI-10 [o] reduced motion means reduced, not removed: under `prefers-reduced-motion` camera travel, parallax and large transforms stop, while small local opacity-level life may stay (research) →=UI-56
  - a surface that freezes entirely has removed meaning the preference never asked to lose
  - motion a gesture can start, redirect or cancel is a spring with velocity continuity; scheduled chrome motion uses the token duration and curve (convention)
  - a scroll-linked DOM effect ships inside `@supports (animation-timeline: scroll())`, and the page reads whole without it
- UI-11 [o] the chrome works like the web the visitor already knows, and the novelty budget is spent on the universe alone (Jakob's law, research)
  - navigation, forms, links and scroll stay platform-conventional; distinctiveness is bought with conventional surroundings, never with a second novelty
  - a control looks like a control: an aesthetic that erases the signifier hides the control (canon)
  - content is never styled like advertising nor placed where ads sit (banner blindness, research)
  - persuasion never deceives →=UI-12
- UI-12 [o] persuasion never deceives: deceptive patterns are a banned list, never a toolkit ← for a product holding someone's private feelings, one manufactured urgency would end the trust it runs on (research, and law: FTC, EU DSA Art. 25)
  - banned: fake urgency or scarcity, countdowns that reset, confirmshaming ("no, I prefer to lose my memories"), asymmetric exits (one click in, a maze out), preselected extras
  - it binds product chrome and public pages alike; the public-copy honesty rules are its copy-side twin →~MKT-14
- UI-13 [o] a long surface has one designed peak and a composed ending, never uniform spectacle ← experiences are remembered by their peak and their end, negative moments most vividly (Kahneman, research)
  - the exit moment is part of the design
  - emotional fit is audited at three levels, and a note names its level: visceral (the first frame), behavioural (the feel of use), reflective (what the product lets someone believe about themselves) (canon)
  - beauty buys tolerance and hides defects: a review scores hierarchy and legibility through the beauty, not as it (research)
- UI-14 [o] four folklore rules are never cited as law; only their true core counts
  | folklore | true core | false part |
  |---|---|---|
  | 60-30-10 colour rule | dominant, secondary, single accent, in that order | the literal percentages |
  | "7 items max" | chunk into groups | seven as a cap on menus |
  | Z-pattern layout formula | zigzag scanning exists on image-heavy pages | the hero → diagonal → CTA prescription |
  | "whitespace = +20% usability" | whitespace is the primary grouping tool | the 20% figure |
- UI-15 [o] a design review round is required for any change that alters what the product looks like; in doubt, the reviewer decides, not the implementer
  - required: a token value, a colour role or a theme; a primitive's visual style or a new primitive; the visual design of a composed screen or of the 3D scene; a state treatment (hover, focus, pressed, disabled, loading, empty, error)
  - not required: behaviour, copy, layout that follows an approved pattern, a refactor that provably changes no pixels
- UI-16 [o] a review reads a running surface, never a screenshot deck or a description: the 2D rubric on `/design`, the 3D rubric on its `Universe` group →=UI-59
  - anything the rubric scores must be reachable there: a dimension that cannot be seen cannot be scored, and adding the missing specimen is part of the work
- UI-17 [o] the 2D rubric: eight dimensions, each scored on its own and judged against its criteria
  | # | dimension | the question | judged against |
  |---|---|---|---|
  | 1 | hierarchy & focus | does the eye reach the most important thing first, and the way out last? | →=UI-3/5 |
  | 2 | typographic rhythm | do the type roles stay distinct, is measure respected, does line height match the amount of text? | →=UI-3/6 |
  | 3 | spacing & density | is spacing on the scale, and density consistent at each altitude (control, panel, page)? | →=UI-4 |
  | 4 | colour application & contrast | is every hue a role or an emotion, nothing decorative, every text pair AA? | →=UI-3/7 |
  | 5 | component consistency | does one primitive look the same everywhere, and does each state read as that state? | →=UI-4/11 |
  | 6 | motion coherence | do durations and easings match the size of the change, and is nothing lost under reduced motion? | →=UI-9/10 |
  | 7 | emotional & brand fit | does it feel like this universe (quiet, lit, unhurried) rather than a generic dark dashboard? | →=UI-11/12/13 |
  | 8 | web ↔ mobile parity | does the same screen read the same way on both, allowing for platform convention? | →=UI-11 |
- UI-18 [o] the 3D rubric: seven dimensions for the universe scene, scored the same way; what the scene must be →=VIS
  | # | dimension | the question |
  |---|---|---|
  | 1 | body form & material | is each body type identifiable at a glance, at every distance it is seen from? |
  | 2 | emotion legibility | does the palette read on a body and in the field without collapsing into mush? |
  | 3 | background & depth | do the sky, the layers and the atmosphere give depth without hiding what sits in front? |
  | 4 | state legibility | do dimming, word loss, gist rising and awakening read as what they are? |
  | 5 | choreography | do time acceleration and consolidation read as one motion, not a jump cut? |
  | 6 | 2D ↔ 3D coherence | do chrome and scene look like one product: is the glass lit by the sky it floats on? |
  | 7 | performance floor | does it hold the frame budget on the reference device, at the reference pixel ratio? |
- UI-19 [o] scoring: Meets (ships; any note is preference, not defect), Needs-work (a real defect; ships once resolved or deferred), Blocking (cannot ship; never deferred)
  - a round scores every dimension, including untouched ones ← a change that degrades an untouched dimension is what a per-change review misses
- UI-20 [o] every note of every round is a ledger row (round, dimension, score, note, status) in the change's own task file
  - a note closes as `resolved` or `deferred`, never silently dropped
  - `deferred` needs a reason and a home (an SSOT decision or a task) and is listed in the sign-off
  - a note is resolved by a change the reviewer sees on the surface, or withdrawn by the reviewer in the next round; never by argument
- UI-21 [o] rounds loop until the gate holds: build or fix → score every dimension and log every note → repeat while any Needs-work or Blocking stays open; there is no fixed number of rounds
  - sign-off requires every dimension Meets, zero open Blocking, every note closed (deferred ones listed), and the objective deliverables true: the decision recorded, the showcase rendering it, the contrast and style-escape gates passing
  - the sign-off names its reviewer and its deferred items
  - an implementing agent may drive the rounds, but a round by an independent designer is the stronger gate and supersedes an agent-reviewed sign-off
- UI-22 [o] a signed-off language is not frozen: a change touching a scored dimension re-opens that dimension and anything downstream of it for one round, in the change's own ledger
  - the full rubric re-runs only when the language itself is revised
- UI-23 [o] the design system is one cross-app package, `@cosimosi/ui` (`packages/ui`), the platform-aware exception to the DOM/native-free packages rule →=ARCH
  - each primitive is a DOM `*.tsx` and an RN `*.native.tsx` sibling selected by the package `exports` conditions; the web barrel `index.ts` and the native barrel `index.native.ts` export the same API
  - it imports no auth, client-cache, api-client, state-machine or i18n package (guard `packages/ui/src/guards.test.ts`); copy arrives through props
  - generated config is the one exception: only `lib/sheet-geometry.ts` reads it, and only the `ui` values group
- UI-24 [o] `packages/ui/src/tokens.ts` is the single token source: `pnpm gen:tokens` (`scripts/gen-tokens.mjs`) emits the committed Tailwind v4 `@theme` file `theme.gen.css`, which is never hand-edited (`pnpm check:gen` holds it fresh)
  - emitted groups (`CSS_TOKEN_GROUPS`): color, container, font, radius, shadow, duration, ease, ring, z; spacing and font-size stay TS-only, covered by Tailwind's own scales
  - a utility's name is the token's name exactly (`--color-bg` ⇒ `bg-bg`); a class over a name no token has is silently absent and paints nothing
  - React Native reads the same map through `native-styles.ts`; `native-tokens.test.ts` keeps every theme colour parseable by `StyleSheet`, which silently drops an OKLCH string
- UI-25 [o] design tokens and theme CSS are code, never `values.yaml`; interaction geometry and timing that change behaviour are values: `ui.sheet_*` (breakpoint, dismiss and flick thresholds, height bounds, settle clock) through `@cosimosi/config` →=ARCH
  - a chain test pins the Tailwind and CSS syntax that cannot import TypeScript to those values
- UI-26 [o] styling engines: web uses Tailwind CSS v4 through `@tailwindcss/vite`; mobile uses plain RN `StyleSheet` from the token map, with no NativeWind and no Tailwind runtime ← NativeWind v5 needs Expo's Metro fork, which collides with the bare RN CLI
  - the web entry CSS (`apps/web/src/app/styles/index.css`) is the only place tokens enter the web app; it declares `@source` over `packages/ui/src`, or the classes used inside primitives are never generated
  - visual axes are set through `variant` / `size` props; a consumer `className` adds layout and spacing only, never a colour override, because `cx` resolves no utility conflicts
- UI-27 [o] the interface font is self-hosted from the `wanted-sans` npm package as the variable dynamic subset with `font-display: swap` ← no third party sees a reader's requests, and user-written names and entries make the glyph set unknowable at build time
  - `--font-sans` replaces Tailwind's default sans, so every element inherits it and nothing opts in
  - `apps/blog` imports the same stylesheet directly and names the same stack, without depending on `@cosimosi/ui`
  - React Native drops the `font` group and paints the system face until Wanted Sans is linked into the native build; then `font` returns to the native map as a family name
- UI-28 [o] primitives are domain-agnostic: named exports, kebab-case files, copy only through props (`scripts/lint-raw-strings.mjs` scans `packages/ui/src`), no data fetching
  - both siblings honour the same props; `BrandMark` (a canvas solid) is the one web-only primitive, exported from the web barrel only
  - a control with no visible label takes `ariaLabel`, so nothing is unnamed; controlled and uncontrolled where conventional
  - promote on use: a primitive is pulled up the moment a second slice grows its own copy, and the barrels are the catalog
  - deferred until a slice needs them: Slider/Stepper and Drawer; the obvious Slider consumer must never exist, since a continuous scalar has no place on the writing flow's editable surface →~WRITE-8
- UI-29 [o] the accessibility baseline is hand-rolled (no headless-UI dependency) and binds every primitive
  - keyboard reachable; focus visible through the shared `FOCUS_RING` utilities and `--color-focus-ring`
  - modal surfaces trap and restore focus (`useFocusTrap` on web; RN `Modal` manages its own)
  - disabled is visual and semantic (`disabled`, `accessibilityState`); loading is disabled plus `aria-busy`
  - field contract (TextField, Select): label association, one `aria-describedby` carrying description then error, `aria-invalid`, `ariaLabel` when labelless
  - Tabs are controlled (`value` + `onValueChange`) so navigation state stays in the app: web `tablist`/`tab`/`tabpanel` with roving focus, wrapping arrows and Home/End; native a horizontally scrolling `tablist` row of pressable `tab`s with selected state
  - reduced motion: `base.css` neutralizes CSS motion; `useReducedMotion` (web `matchMedia`, RN `AccessibilityInfo`) drops JS motion
  - every documented token text pair meets WCAG AA 4.5:1 in every registered theme (`tokens.test.ts` via `a11y/contrast.ts`), so a theme is gated the moment it is added
- UI-30 [o] the background seam (`packages/ui/src/theme/background-store.ts`) is presentation state only: a tone and an optional palette accent, which can never mutate domain, cache, emotion, strength, recall state or layout →~INV-11
  - domain-to-visual mapping (emotion to colour) belongs to the rendering projection, never here →=VIS
  - the colour theme is not in this store: it is static data resolved once at the composition boundary ← a runtime store would give a second, drifting answer to "which theme is active"
- UI-31 [o] every visual change is expressed inside `packages/ui` (tokens, primitives, `base.css`); app slices consume tokens and primitives only and carry no style escape
  - guard `pnpm lint:style-escapes` scans `features`, `widgets` and `pages` of both apps for raw colour literals and arbitrary Tailwind values that hardcode geometry or colour; structure-only arbitrary values stay allowed; a line opts out only with `style-escape-ignore` and a reason
  - a colour literal below the palette layer fails `packages/ui/src/palette.test.ts`
  - shared domain chips (mood, neuron) live in each app's `entities/episodic-memory`, promoted down rather than copied sideways →=ARCH
  - mobile chrome reads device insets through the `shared/native` safe-area seam (`useScreenInsets`), never through guessed absolute offsets
- UI-32 [o] colour is authored once, in `packages/ui/src/palette.ts`, in two layers, primitive OKLCH ramps and semantic roles; nothing below the palette names a colour
  - ramps `navy`, `lavender`, `chartreuse`, `mint`, `gold`, `red`, `green`, 11 steps each on one shared perceptual lightness scale, are the only raw colour literals in the codebase
  - a role maps to a ramp step, never a literal, so two roles that should match cannot drift
  - `base.css`, primitives and slices read `var(--color-<role>)` or a utility over it
  - the emotion palette sits on the same lightness ladder →~MOOD
- UI-33 [o] the semantic roles
  | role | carries |
  |---|---|
  | `bg`, `surface`, `surface-raised` | the three ground planes: page, panel, raised panel |
  | `text`, `text-muted`, `text-subtle` | primary copy, secondary copy, labels and metadata |
  | `border` | hairline separation between surfaces |
  | `primary`, `secondary`, `tertiary` | the three accents, each with a `-foreground` pair for text on it |
  | `danger`, `success`, `warning` | status, each with a `-foreground` pair |
  | `focus-ring` | the keyboard focus indicator, one colour for every control |
  | `overlay` | the scrim behind a modal surface |
  | `specular` | the lit edge of the glass material, physical light owned by the theme |
  | `depth` | the colour every shadow is mixed from, the theme's ground pushed to black |
  - `specular` and `depth` are roles, not raw white and black, so a theme's light and darkness move with its ground
- UI-34 [o] colour application
  - surfaces step up, never out: depth is the step plus a shadow, not a border colour
  - accents are for action and identity, on a control, a rim or a single word, never filling an area: a large field of `primary` reads as a warning on dark
  - status colour never travels alone: a red rim or a dot always comes with text
  - emotion colour is domain output (`moodColor` from `@cosimosi/emotion`): a surface may show it (a dot beside a name, a body preview), never mixes it into chrome and never invents its own mapping →=MOOD
- UI-35 [o] a theme is a complete role map registered in `palette.ts`; adding one is a data change in that file and nothing else
  - `pnpm gen:tokens` emits one `[data-theme='<key>']` block per theme; `ThemeKey` and the showcase's theme list derive from the registry; the contrast suite covers it at once →~UI-29
  - the active theme is `defaultThemeKey`, stamped on the document root at the web composition boundary (`apps/web/src/main.tsx`) so portalled chrome re-skins; RN resolves the registry statically
  - shadows mix `var(--color-depth)` and the glass rim `var(--color-specular)`, so elevation follows the theme
  - shipped theme: `aurora` (navy ground; lavender, chartreuse, mint)
- UI-36 [o] `primaryRamp` is the one ramp visible above the palette, for a shaded solid that needs the ladder a role's step sits on; its consumer picks steps and still names no colour
  - a theme whose `primary` moves to another hue family must move `primaryRamp` with it
  - consumer: `BrandMark`, the trademark as a turning icosahedron on its own canvas, never on `@cosimosi/3d-renderer`; its ladder spans nearly the whole ramp, because a solid reads through the spread between its faces, and its highlight mixes toward `specular`
- UI-37 [o] one family, Wanted Sans (OFL-1.1, variable, weight 400–1000), is the only `font-family` ← it carries Korean and extended Latin in one cut, and the product's copy mixes the two inside one line
  - type over the dark lit canvas reads heavier: one weight step down from a light mock, never below `font-normal`
  - a label placed directly on the scene gets legibility from the ground behind it (a shadow or a faint dark halo), not from family or weight
- UI-38 [?] a second, serif family for the diary reading surface stays unclaimed until that surface is real enough to judge ← each family costs a second Korean download beside a live 3D scene, a second RN asset link and a second face to tune
  - the case for it: a Korean serif (such as Maru Buri) would make the trace-versus-record contrast physical →~DIARY-4
  - when it arrives: a `font.serif` token plus an `@font-face`, named by the reading route; nothing else moves
- UI-39 [o] six type roles, one rhythm: size carries hierarchy, weight emphasis, colour only importance (`text` → `text-muted` → `text-subtle`); every heading and text uses a role recipe verbatim
  | role | web recipe | used for |
  |---|---|---|
  | display | `text-4xl font-semibold tracking-tight` | a page's one title |
  | title | `text-2xl font-semibold tracking-tight` | a section heading, a dialog title |
  | section | `text-lg font-semibold` | a block heading inside a panel |
  | body | `text-base leading-7` | prose the user reads |
  | small | `text-sm leading-6 text-text-muted` | secondary copy, descriptions |
  | eyebrow | `text-xs font-semibold uppercase tracking-wide text-text-subtle` | a category label above a group |
  - every prose column is capped with `max-w-measure` (the `container.measure` token)
  - leading: `leading-7` body prose, `leading-6` secondary copy, the default for single-line labels
  - an eyebrow labels a group and stays out of the document outline; a real heading uses a heading element
  - a locally invented `text-*` / `font-*` combination is a finding, not a style
- UI-40 [?] a display tier for public pages above the chrome roles is required (→=UI-3) but not yet decided: a larger ratio at desktop widths (≥1.333) interpolated with `clamp()` between a phone and a desktop scale, not stepped at breakpoints
  - until it exists, a public page uses the chrome roles and never invents type treatments locally →~MKT
- UI-41 [o] spacing, density and hierarchy come from scales and a fixed channel order
  - one 4px-based spacing scale (`tokens.spacing`) and one radius scale: density is a step, never a value between two; both reach RN through the native map (`tokens.radius.lg`, never a hand-written number)
  - altitudes: inside a control 2–3, inside a panel 4–5, between panels 6–8, between page sections the section rhythm (a heading, a rule, then its content)
  - hierarchy channels, each used only when the one before is not enough: position → size → weight → colour → surface → border; a border is the last resort
  - a group of controls reads left to right by decreasing emphasis: the committing action last on the right, the way out beside it as `text`
- UI-42 [o] two materials, opaque and glass, share one depth model, and both cast the theme's `depth` colour
  | material | class | for |
  |---|---|---|
  | opaque surface | `card-surface`, `Card` `solid` | content that must stay readable: lists, forms, panels |
  | glass, ambient | `glass-subtle` | HUD chrome that sits on the universe permanently |
  | glass, panel | `glass`, `Card` `glass` | a floating panel over the scene |
  | glass, focused | `glass-strong` | dialogs and popovers, the surface that interrupts |
  | bloom | `bloom-soft` | an element that reads as a light source, not a surface |
  - glass is for chrome over the universe, never for a content page ← on a flat ground glass is a translucent grey box
  - small numerous controls (buttons, chips, fields) get the glass look without `backdrop-filter`, because real blur costs a GPU pass each and seams on hover
  - shadow steps encode distance, not importance: `sm` resting, `md` a panel, `lg` a floating surface
- UI-43 [o] glass is a CSS material only; chrome never renders glass through WebGL or a canvas ← refraction and blur barely read over the emotion-gradient sky, so a WebGL glass layer costs far more than it shows
  - `.glass-subtle`, `.glass`, `.glass-strong` in `base.css`'s `@layer components`: theme-tinted fill, `backdrop-filter` blur and saturate, specular rim, depth shadow
  - where `backdrop-filter` is unsupported, the `@supports not` fallback raises the fill so text stays readable
  - glass tuning happens inside this CSS material; a WebGL or canvas glass for chrome is not proposed again
- UI-44 [o] `Button` is two independent axes: appearance (`contained`, `outlined`, `text`) carries emphasis, colour (`primary`, `secondary`, `tertiary`, `neutral`, `danger`) carries meaning; any appearance composes with any colour, so no screen needs a one-off button
  - one `contained` button per group; everything else is outlined or text
  - contained is a filled liquid-glass lens in CSS (role tint, directional specular rim, gloss, coloured glow); outlined is a rim plus a soft glow ring; text is a bare label that blooms on hover
  - an outlined control's rim and halo are drawn in its ink, never its fill colour (a `neutral` fill tint would glow as a dark smudge)
  - every icon control over the universe is round, borderless and lit only by a shadow, a dark halo hugging the strokes: no rim, no plate ← over a live sky a bordered circle reads as a hole punched in the universe, and a column of them as a widget tray
  - the transparent border every control keeps for `forced-colors` stays: it is structure, not look →~UI-7
  - parity gap: the mobile HUD toolbar and the universe view toggle still use `IconButton variant="outlined"`, where web uses round `text` controls in a `drop-shadow` column
  - the HUD toolbar carries no contained button; the home screen's committing action, writing a diary, is outlined at the largest size →~WRITE-1
- UI-45 [o] the way back out of a place has one form everywhere: a bare left arrow and the destination's name (`variant="text"`, `color="neutral"`, `BackIcon` leading), no fill and no rim ← a filled or bordered control there reads as an action on this page, competing with the title
  - pulled left by its own padding so the glyph lines up with the content beneath; the arrow points left on every surface, since every back navigation returns the way it came
  - the label names the destination, never the gesture
- UI-46 [o] a supporting surface's header has three parts: the way back on the left, the title centred on the header, and a right cell holding the surface's one view control or nothing ← leaving any supporting surface is the same gesture in the same corner →!UI-45
  - a three-cell grid, never `justify-between`, so the title stays centred while the controls beside it change width
  - the title names where the reader is: on the account home, the open tab rather than the account in general →~ACCT-9
  - surfaces: the diary archive, with its list/calendar switch on the right →~DIARY-18, and the account home, whose right cell stays empty because nothing belongs opposite the way out
- UI-47 [o] fields are recessed wells (carved inner shadow, hairline rim, the scene faintly readable through); colour never enters the fill, validation rides the border and the focus ring
  - a bounded choice among fields is a picker in the same well, because the affordance says the set is closed (a mood is a picker, not a free field); a chip row that would sprawl on a small screen collapses into one
  - the web picker is a real `<select>`, inheriting the platform menu, keyboard, type-ahead and assistive behaviour; RN opens a modal option list that changes nothing on dismiss and marks the current value
  - among buttons (a toolbar) the bounded choice is a `Menu` behind a `Button` that shows what it holds, its accessible name the field's name plus the held choice ← a recessed well on a row of buttons is the one borrowed object on the line
- UI-48 [o] a choice between exactly two visible options is one switch, `SegmentedControl`'s `toggle` shape: a press anywhere lands on the other option ← aiming at a half is work a binary choice never needs, and a press on the held half did nothing
  - `role="switch"`, with the held option carried in the accessible name
  - three or more options (or one) stay a radiogroup: no `aria-controls` (it selects a value, swaps no panel), one tab stop, an out-of-set `value` focusing the first segment
  - the held choice is a sliding thumb, an `aria-hidden` sibling of the radios and never a wrapper, because ink weight alone cannot say which is held; no label is measured, and reduced motion lands it instantly
  - consumer: the diary archive's list/calendar switch →~DIARY-24
- UI-49 [o] badges, toggles and alerts light from rim and glow, never from a solid slab of accent
  - badges are outline-first (colour in the rim, the text and an optional dot, the fill a whisper); over the raw universe they raise their fill (`data-on-scene`) so small text keeps its contrast
  - a switch commits immediately, a checkbox waits for the form
  - the inline alert is the `Alert` primitive (a rim, a whisper of fill, plain ink), never a recipe a screen writes out ← the same news must not read four ways in four slices
- UI-50 [o] overlays: a tooltip explains, a toast reports, a dialog interrupts; all three are glass, portalled, and return focus where they found it
  - a `Dialog` is bounded by the viewport and scrolls its own body, so it never pushes its actions past the bottom edge
  - it is a centred modal at `md` and above and a bottom sheet below (`ui.sheet_breakpoint_rem`): the breakpoint changes where it sits, never what it promises (same scrim, focus trap and Escape); the bottom form adds a swipe-down exit (`lib/use-sheet-drag.ts`)
  - every bottom-anchored surface adds its control room on top of the safe-area inset: web `calc(env(safe-area-inset-bottom) + …)`, RN two spacing steps
  - stacking order (`tokens.z`, read as `var(--z-*)`, never a raw number): base → dropdown → overlay → modal → guide → toast → tooltip
  - `z.guide` holds the guided-step chrome, above `modal` so a caption and its always-available skip stay readable over the dialog they point at, below `toast` so an error still speaks over guidance; where a caption sits →=ONB-12
- UI-51 [o] `Sheet` opens beside what it is about: no backdrop, no focus trap, not a portal, and no `scrim`, `overlay` or `modal` prop at all ← a forbidden thing with no field cannot be configured into existence; a surface that must interrupt is a `Dialog`
  - Escape is unbound (nothing is dimmed to escape from); `closeDisabled` blocks every way out, the dismissing throw included, while a commit is in flight, and resizing stays
  - on its bottom-edge shape a handle resizes it: a tap collapses and restores it (no drag-only function, WCAG 2.5.7), a pull past the short end dismisses it; a sheet whose content never filled the short end is never grown
- UI-52 [o] `Menu` is a short command list behind one control; the primitive owns only showing, the keyboard position and the three ways out (a choice, Escape, a press elsewhere)
  - every item closes the list before it acts; dismissal returns focus to the trigger
  - placement is stated (`side` / `align`) and nothing is measured: a trigger near the right edge must pass `align="end"`
  - Escape is stopped inside the list, so a menu inside a `Dialog` never closes the dialog
  - a popover row answers the pointer by getting brighter, a specular wash plus its rim (a destructive row in its red), through one `.menu-row` class ← a darker wash on raised glass is too small to see
- UI-53 [o] `Tooltip` is portalled to `document.body` with stated placement, re-placing itself on resize and scroll ← glass and lit labels open stacking contexts that would trap a tip rendered beside its trigger
  - a hover-only tip is the default for a name the control already carries
  - a tooltip that is the content (an explanation behind ⓘ) also opens on press, stays held until a press elsewhere, Escape or blur, and gives up width at a screen edge
- UI-54 [o] `Progress` is determinate only: `value` and `max` are server integers read verbatim, with no indeterminate mode and no ratio prop ← a fill the caller computes can disagree with the number beside it
  - web `role="progressbar"` and RN `accessibilityRole` plus `accessibilityValue` announce the same pair
  - `ObscuredText` renders runs decided elsewhere: an obscured run keeps its characters under a blur no shape survives (selection disabled; a solid system-ink bar under forced colours; a text-shadow smear on RN), and every run stays in the accessibility tree →=FORGET
- UI-55 [o] exactly one `Toast` exists in the tree ← two independently rendered toasts overlap into something unreadable
  - `packages/ui` owns the queued seam (`ToastQueueContext`, `usePushToast`, `ToastEntry`; React only, messages already resolved); each app's `app/providers/toast-provider.tsx` holds the queue and renders only its head entry
  - a new surface joins the queue as an owner rather than adding a portal; the error path →=ERR
  - session-scoped owners (`SESSION_SCOPED_TOAST_OWNERS`) are dropped at the session boundary by each app's client-cache provider: the queue lives above auth so an auth error can toast, and a queued notice must never surface for the next user
- UI-56 [o] motion confirms a change that already happened: it never delays the user, never loops and never carries information absent from the static frame
  - durations by the size of the change: `duration.fast` state feedback, `duration.base` chrome entering or leaving, `duration.slow` a surface crossing the screen
  - `ease.standard` everywhere; `ease.emphasized` only where something should feel picked up (a checkbox tick, a springing control)
  - reduced motion is global (`base.css` collapses transitions and animations, `useReducedMotion` drops JS motion); if something would be lost, the motion carried meaning it should not have →~UI-10
- UI-57 [o] icons are one family, Phosphor, named in one place: `packages/ui/src/primitives/icons.tsx` and its `.native` sibling bind each glyph to a product meaning (`DiaryIcon`, `BackIcon`, …); a slice imports the meaning and never draws its own SVG
  - two meanings may share a glyph and stay two exports (`StarActionsIcon`, `SettingsIcon`), so rebinding one is one edit; RN imports per glyph, because Metro does not tree-shake
  - size `ICON_SIZE` in `currentColor` (RN: an explicit token colour, default neutral text); `ICON_SIZE_LG` only for a glyph standing alone with no rim or plate, where only the ink grows, never the touch target
  - `aria-hidden` on every icon; an icon-only control carries its name in `label`; icons clarify a label and never replace it, except in a dense toolbar, where the tooltip is then mandatory
  - the showcase's own outline glyphs are anatomy specimens, imported by nothing outside it
- UI-58 [o] every feature designs its states; a feature without them is unfinished
  | state | treatment |
  |---|---|
  | default | the resting design |
  | hover | a step up in fill or rim density, never a size or position change |
  | focus | the shared ring: `ring-width` of `focus-ring` at `ring-offset` from the control |
  | pressed | the surface settles inward (inner shadow), the glow tightens |
  | disabled | 50% opacity, pointer events off, semantics set |
  | loading | disabled + `aria-busy` + a spinner in place of the leading icon |
  | empty | what is missing, why, and the one action that fixes it |
  | error | what failed in the user's terms and the way to retry; never an apology, never an error code as the explanation |
  - failure has two altitudes: a screen that could not load is an error state (a card with a status badge, what failed, why, the retry); a failure inside chrome that still works is the inline `Alert` (one row, status hue on the rim, plain ink carrying the way out)
  - `Alert` takes `live="alert"` for something that already failed and `live="status"` for a consequence being offered; the hue stays out of the ink
  - a toast reports a failure once, the alert stays until the user acts; the internal bucket's reference id →=ERR
  - a pending phase keeps its shape: a note says what is happening and skeletons stand where the result will land, under `aria-busy` and a polite live region
- UI-59 [o] the design showcase `/design` is the review surface: web `apps/web/src/pages/design` and mobile `apps/mobile/src/pages/design` (`cosimosi://design`), both behind the diagnostics gate
  - groups Foundations, Primitives and Patterns render the tokens from the registry, every primitive in every state and the composed chrome; the `Universe` group →=VIS
  - it renders the shipped components, never lookalikes; static states come from the `.state-hover` / `.state-pressed` / `.state-focus` wrappers in `base.css`, extra selectors on the real rules
  - the 2D groups read no domain data and need no GPU, so they open instantly and reproduce exactly; the mobile screen sits in both navigation stacks, so a review needs no session
  - `Sheet` and `Dialog` sit together in the Overlays group, so what stays visible behind each reads on one screen
  - `/test` verifies platform wiring and never hosts a sign-off surface →=ARCH
- UI-60 [o] when UI explains proximity in the universe, it names shared meaning or shared neurons, never similar feelings or chronological order →!INV-3
  - position means connectivity, never date, emotion, palette, wording or customization →=VIS-1
- UI-61 [o] product copy is plain, restrained and honest in both languages, addressed to the reader: no exaggeration, no flattery, no office-speak, and meaning is carried by words ← decoration and performance in copy read as machine-written
  - no decorative emoji in labels, buttons or status lines; meaning goes into the words
  - restraint holds on screen too: few always-visible controls over the universe, occasional functions behind a menu or a non-blocking surface →~UI-1
  - the brain-model denial sentences are an exact-match allowlist (`REVIEWED_DENIALS` in `apps/web/src/pages/landing/model/copy-honesty.test.ts`): re-voicing one updates the list →=MKT
  - copy lives in `packages/i18n/messages/*.json` and reaches primitives through props →=CLIENT
- UI-62 [o] user-facing Korean copy speaks one register, the friendly `해요체` of the Toss blog voice (`-어요`, `-죠`, `-거든요`), talking to the reader the way a person would →!UI-61
  - forbidden: literary question endings (`~왔나`, `~인가`); the stiff `-습니다` style; calling the reader `당신` (drop the subject, or use `직접` / `내`); translation-ese (`~를 통해`, `가지다`, `~에 있어`, `하기 위하여`); heavy nominalization; office-speak (`매핑된다`, `동작한다`)
  - actions use the product's own verbs (`별 쪼개기`, `별 띄우기`), never terse functional labels →~WRITE-2/3
  - dev-only diagnostic surfaces (`/test`) are not user copy
- UI-63 [o] both languages are signed off and run in re-review mode →!UI-22; the 2D sign-off left no deferred note, the 3D sign-off carries three, and the next 3D round reads them first
  - no React Native device pass yet: the mobile frame budget, the nebula's cloud in particular, is unmeasured (web measured 260729: 8.3 ms median at 2880×1800 with four live canvases); its home is the mobile `Universe` group read on hardware →~VIS
  - the specimens added at the 3D close (ambient bodies, the gist pair, the awaken flare, the mobile group) have not been read on screen
  - `muted-dusk` draws ANGER and STRESS at ΔE 0.024, one colour for two feelings →=MOOD
  - neither sign-off had an independent designer at the keyboard, so a designer's round supersedes both →~UI-21
  - the 3D rubric's performance floor keeps the rendering floors (instancing, the frame budget, TSL rendering) and the web + RN parity path →=VIS

## flow
- design change: decide in the language → express in `packages/ui` (`tokens.ts` → `pnpm gen:tokens`, primitives, `base.css`) → render on `/design` → review round(score every dimension, log every note) → (any Needs-work or Blocking: fix → round | all Meets: sign-off)

## constraints
- the only `values.yaml` group UI owns is `ui.sheet_*`; tokens, theme CSS, motion timing and copy are never values →=UI-25
- every string reaches a primitive through props from `packages/i18n`; no copy lives in `packages/ui` →=CLIENT

## chg
- r1 261102 initial
