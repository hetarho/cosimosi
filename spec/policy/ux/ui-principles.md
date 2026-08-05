# policy/ux: ui principles

> The **criteria layer** of the design practice. [design-review.md](design-review.md) owns the protocol — who
> scores, when, and what gate a round must pass. [tech/design-language.md](../../tech/design-language.md) owns
> the product's own decisions — the tokens, roles and materials. This document owns what sits between them:
> the established principles a rubric dimension is judged **against**, so that "does the eye reach the most
> important thing first" is answered by a criterion rather than by taste. It binds every composed 2D surface —
> product chrome and public pages alike — and it is the baseline a surface must meet before the language's own
> decisions even apply.
>
> Each principle carries its evidence tier, because they are not equally strong and a reviewer weighing a
> conflict needs to know which one bends:
>
> - **[research]** — empirical findings (eyetracking, controlled studies). These do not bend to preference.
> - **[canon]** — practitioner principles with decades of consensus (Nielsen, Norman, Bringhurst). Bend only
>   with a stated reason.
> - **[convention]** — current professional practice. Bend freely, but knowingly.
>
> Sources are named inline so a rule can be re-examined at its origin instead of argued from memory.

## 1. Hierarchy

The failure mode this section exists to prevent: a screen where everything is stated at the same volume, which
reads as designed by no one.

- **Every screen declares one most-important element, and the screen is built outward from it.** [canon] One
  primary action per screen (Joshua Porter, _Principles of User Interface Design_); NN/g's visual-hierarchy
  guidance caps it at **two "big" elements per page** (Kelley Gordon, NN/g 2021). Two elements shouting equally
  is zero hierarchy, not double.
- **Emphasis is a budget, spent in one place.** [research] The Von Restorff effect: the one item that differs
  from the rest is remembered — and competing highlights cancel each other. A surface that emphasizes a second
  thing has taxed the first.
- **Hierarchy is read at three volumes or fewer.** [canon] NN/g: at most ~3 text sizes and ~3 contrast levels
  per screen. The design language's six type roles are the product-wide vocabulary; a single screen speaks with
  about three of them.
- **Size alone is a weak lever; weight and colour do most of the work.** [convention] Refactoring UI (Wathan &
  Schoger 2018): de-emphasizing the secondary is as much hierarchy work as emphasizing the primary. The
  channel order — position → size → weight → colour → surface → border — is decided in
  [design-language](../../tech/design-language.md) §4; this principle is why the order exists.
- **The squint test is the check.** [canon] Blur the screen (or the eyes) until detail is gone; whatever still
  stands out is the de-facto hierarchy, and it must match the intended one. NN/g endorses it; it is the
  operational test for design-review dimension 1, and it costs nothing.
- **Type sizes come from a scale, not from judgement calls.** [canon] A modular scale — base size × a ratio
  (Bringhurst; Tim Brown, _More Meaningful Typography_, A List Apart 2011). A page whose sizes were each chosen
  locally reads as tuned by committee even when every individual choice was reasonable.
- **A marketing surface runs a larger scale than chrome, and runs it fluidly.** [convention] Chrome is read at
  arm's length inside a working session; a public page's headline is a poster read cold, and it earns a
  display tier above the chrome roles — a larger ratio at desktop widths (≥1.333, the "perfect fourth" and up)
  interpolated continuously between a phone scale and a desktop scale with `clamp()` (Utopia — Gilyead &
  Mudford, 2020) rather than stepped at breakpoints. The tier is a design-language decision this principle
  requires to exist; a public page that finds the chrome roles too small must not answer by inventing type
  treatments locally.

## 2. Grouping and space

The Gestalt principles (Wertheimer, Koffka, Köhler, 1920s) — all [research], a century old and still the
mechanics of how a layout is parsed before a single word is read:

| Principle         | What the eye does                                                                  |
| ----------------- | ---------------------------------------------------------------------------------- |
| **Proximity**     | things near each other are read as one group sharing purpose                       |
| **Similarity**    | things that look alike are read as the same kind of thing                          |
| **Common region** | a shared boundary or background groups harder than proximity does                  |
| **Continuity**    | the eye follows lines and alignment edges and assumes they mean something          |
| **Closure**       | a partially visible element is completed in the mind — a cut-off row says "scroll" |
| **Common fate**   | things that move together are read as one thing                                    |

What they bind:

- **Whitespace is the first grouping tool; a border is the last.** [research] NN/g (Harley 2020): proximity
  can overpower colour and shape similarity, and common region — a border, a card — should be reached for only
  when spacing has failed, because every enclosure adds noise and a wall of boxes creates false floors. This
  is the evidence behind design-language §4's "border is the last resort."
- **Unequal spacing is information.** [research] The gap inside a group must be visibly smaller than the gap
  between groups, or proximity reports the wrong structure. A layout with one uniform gap everywhere has
  disabled its own grouping channel.
- **Same thing, same look — everywhere.** [canon] Nielsen heuristic #4 (consistency and standards) and the
  similarity principle are two statements of one rule: a second visual treatment for the same kind of thing is
  read as a second kind of thing.
- **Alignment is continuity.** [canon] Elements on a shared edge are read as related; a page with many
  alignment edges is read as many unrelated things. Fewer edges, harder commitment to each.

## 3. Scanning, and the fold

All [research] unless marked — NN/g eyetracking and first-impression studies, and the numbers are worth
keeping because they are counter-intuitive:

- **The page is judged before it is read.** Visual appeal is assessed within ~50 ms and the judgement halos
  onto credibility and perceived usability (Lindgaard et al. 2006); at exposures as short as 17 ms,
  **low-to-medium visual complexity** and **high prototypicality** — looking like what this kind of page
  normally looks like — are what predict a good impression (Tuch et al. 2012). The first screenful competes as
  a picture before any word lands: low clutter, one focal point, a genre-recognizable structure. Novelty
  spends prototypicality, which is why it is budgeted (§9).
- **Attention is front-loaded even among people who scroll.** 57% of viewing time is above the fold, 74%
  within the first two screenfuls (Fessenden, NN/g 2018); content above the fold gets roughly twice the
  attention of content just below it (Schade, NN/g 2015). The first screenful carries the message and the
  primary action, or most visitors never meet them.
- **The F-pattern is a symptom, not a layout.** Users F-scan — heavy first lines, then down the left edge —
  precisely when a page **lacks** hierarchy (Pernice, NN/g 2017). Formatted pages get the layer-cake pattern
  instead: headings and subheadings read, body entered where a heading earned it. A page whose right side is
  being missed is a page whose headings failed. The prescriptive "Z-pattern layout" formula is folklore (§11).
- **Front-load everything.** Headings carry their information in the first words; sections carry their point
  in the first sentence. Scanning eyes touch beginnings.
- **No false floors.** A screen that looks finished stops the scroll (the "illusion of completeness"). A page
  that continues must show it continues — a cut-off element, a cue, a next heading rising into view. Closure
  (§2) is the mechanism.
- **Five seconds is the acceptance test.** [convention] A cold visitor shown the first screenful for five
  seconds can say what the product is and who it is for (the five-second test — Perfetti; Lyssna/Maze). Poetry
  that costs this test its answer belongs in the subhead, not the headline.

## 4. Type in two scripts

The copy mixes Korean and Latin inside one line; the single family is a design-language decision (§3.1 there),
but the two scripts keep their own composition rules and most Latin guidance does not transfer unadjusted.

- **Korean display copy breaks at word boundaries.** [canon] Korean line-breaks at any syllable by default
  (W3C klreq) — right for prose, wrong for a headline, where a mid-word turn reads as a typo. Headlines and
  short display copy take `word-break: keep-all`, with `overflow-wrap: break-word` as the narrow-column
  escape; a multi-line heading balances its lines (`text-wrap: balance`). Long prose keeps the default
  syllable breaking.
- **Korean measure is counted in Korean.** [research for the Latin numbers, convention for the transfer] The
  Latin measure is 50–75 characters (Baymard 2022; past ~100 readers fatigue and skip). Hangul's full-width
  blocks make the comfortable equivalent roughly 35–45 characters — a measure tuned on English prose is a
  third too wide for the Korean it will actually carry.
- **Leading rises with the amount of text and falls with size.** [research] ~1.5 line-height for body and
  long-form (WCAG 1.4.12's test value); heading leading falls toward 1.1–1.3; a longer measure needs more
  leading, never less. The design language's role table (§3.2 there) carries the product's chosen values.

## 5. Dark surfaces, and glass over a live scene

Dark-first over a moving scene is this product's home regime — and the one where the common rulebooks are
least reliable.

- **Two rulebooks for contrast, one job each.** [convention, on research grounds] WCAG 2.x AA is the
  conformance floor — it is what the token gate checks ([design-system](../../tech/design-system.md) §5) and
  the only claimable standard (WCAG 3 remains a draft whose contrast algorithm is undecided). But the 2.x
  ratio **overstates** contrast between dark pairs — a passing 4.5:1 near black can be functionally unreadable
  — so dark pairs are additionally _designed_ with APCA (Somers/Myndex): Lc 75+ for body, Lc 60 for non-body
  content text, Lc 45 for headlines, the required Lc falling as size and weight rise. APCA informs the
  design; WCAG 2.x AA remains the claim. Never the reverse.
- **The scene may be black; a text surface may not.** [convention] Material's dark-theme guidance: surfaces
  that carry text sit at `#121212`-class lightness, never pure black — maximum-contrast white-on-black blooms
  (halation), hardest on astigmatic readers — and elevation on dark is expressed as a _lighter_ surface, which
  is what the `bg → surface → surface-raised` steps already are (design-language §2.3). The universe is
  imagery, not a surface, and keeps its true night.
- **De-emphasized text keeps the hue.** [convention] Refactoring UI: grey on a coloured ground reads as washed
  out, not as quiet. Secondary text over a tinted dark ground holds the ground's hue and gives up lightness
  and chroma — in OKLCH terms, hold H, lower L and C. The muted/subtle text roles are theme decisions; this is
  the criterion they are checked against.
- **Glass guarantees its worst frame.** [convention, with a year of public evidence] NN/g's glassmorphism
  critique and Apple's Liquid Glass walk-backs (2025–26: opacity raised across betas, then a "Tinted" mode,
  then a user slider) agree on the mechanism: translucency over a variable background is only as legible as
  its **brightest** frame, and a live scene cannot be hand-checked frame by frame. A glass surface that
  carries text therefore declares a contrast floor — a minimum tint opacity and rim chosen against the
  brightest state the scene behind it can reach — rather than being tuned on a typical night sky.
- **Structure survives forced colours.** [convention] Under `forced-colors: active` the browser strips
  backgrounds, shadows and backdrop blur — glass vanishes entirely, and a surface whose edge was carried by
  fill or shadow becomes invisible. Every surface and control keeps a real border (transparent in normal
  rendering where the look demands it), so the OS palette has something to draw.

## 6. Choice and complexity

- **Decision time grows with options.** [research] Hick's law (Hick & Hyman, 1952). One decision per moment;
  a step that asks two questions is two steps compressed into a worse one.
- **Complexity is conserved — someone absorbs it.** [canon] Tesler's law: what the system does not absorb, the
  user does. A simpler-looking screen that pushes a choice onto the user is a cost moved, not removed.
- **Chunk; do not count to seven.** [research] Miller's 7±2 is about working memory, and Laws of UX itself
  warns against reading it as "menus may have seven items." The real instruction is chunking — grouped,
  labelled, scannable structure. Working-memory capacity is closer to four (Cowan).
- **Every element is a tax on every other element.** [canon] Nielsen heuristic #8 (aesthetic and minimalist
  design): each unit of information competes with the relevant units. Occam's razor as design practice:
  finished means nothing more can be removed, not nothing more can be added.

## 7. Feedback and latency

- **Every action reports back.** [canon] Nielsen #1 (visibility of system status), Norman's feedback principle.
  The design language's state table ([design-language](../../tech/design-language.md) §9) is this principle
  made mandatory: a feature without its states is unfinished, not unstyled.
- **Under 400 ms, or show why not.** [research] The Doherty threshold (IBM, 1982). Past it, perceived
  performance is design work: skeletons that hold the shape, progress that moves.
- **Targets obey Fitts's law, with numbers.** [research] Time-to-acquire is a function of distance and size
  (Fitts 1954). The floor is WCAG 2.2's 24×24 CSS px (2.5.8, level AA); the design target is the platforms'
  44–48px for primary controls. What must meet the number is the **hit area**, not the drawing — a small
  visual target with a generous hit region satisfies both the law and the look, on-scene targets included.
- **Focus is designed, not suppressed.** [canon] `:focus-visible` shows the ring to keyboards without flashing
  it at pointers, which removes the last excuse for hiding it. WCAG 2.2 adds that the focused element may not
  be fully covered by author content (2.4.11, AA — sticky chrome and toasts are the usual offenders); the AAA
  appearance recipe (≥2px perimeter, 3:1 change between states) is the design target even though only AA is
  claimed, because on a dark ground a faint default ring simply vanishes. The shared `focus-ring` role
  (design-language §2.2) is how one decision covers every control.
- **Recognition over recall.** [canon] Nielsen #6: the interface remembers so the user does not — visible
  options, visited states, context carried forward rather than re-asked.
- **Exits are marked.** [canon] Nielsen #3 (user control and freedom): every flow can be left without
  ceremony, and destructive paths are the ones that ask.

## 8. Motion

The design language (§7 there) owns the product's durations, easings and the global reduced-motion collapse;
these are the criteria those decisions answer to.

- **Reduced motion means reduced, not removed.** [research] WCAG 2.3.3's basis is vestibular: parallax, zooms
  and full-viewport travel cause real physical harm (vertigo, nausea), while small local motion does not.
  Under `prefers-reduced-motion`, what stops is camera travel, parallax and large transforms; what may stay is
  small, local, opacity-level life. A surface that answers the preference by freezing entirely has removed
  meaning the preference never asked to lose.
- **Interruptible motion is a spring; scheduled motion is a curve.** [convention] Both platform vendors
  converged here (Apple's spring APIs; Material 3 Expressive, 2025): motion a gesture can start, redirect or
  cancel needs velocity continuity — momentum carried through retargeting — which a fixed duration-and-curve
  cannot express. The token pair stays right for chrome entering and leaving on its own schedule; anything a
  finger drives prefers physics.
- **Scroll-driven reveals are an enhancement, never a dependency.** [convention] CSS scroll timelines run off
  the main thread and cost nothing where supported (Chromium; Safari 26; Firefox still flagged), so a
  scroll-linked DOM effect ships inside `@supports (animation-timeline: scroll())` and the page must read
  whole without it.

## 9. Conventions, and where novelty is spent

- **The chrome works like the web the visitor already knows.** [research] Jakob's law: users spend most of
  their time on other sites, and their mental models arrive with them. Navigation, forms, links, scroll — all
  platform-conventional.
- **The novelty budget is spent on the universe.** [convention] A product gets roughly one unfamiliar thing a
  visitor will learn. Ours is the scene itself — which is why everything around it must be instantly familiar.
  Distinctiveness is the escape from the interchangeable dark-SaaS look (the "Linearization" critique), but it
  is bought with conventional surroundings, not with a second novelty.
- **A control looks like a control.** [canon] Norman's signifiers: on screen, nearly everything a designer
  controls is a signifier, and a quiet aesthetic that erases the signifier has not simplified the control —
  it has hidden it. Content is never styled to resemble advertising and never placed where ads sit
  ([research] banner blindness — Pernice, NN/g 2018: it will be unseen).
- **Persuasion never deceives.** [research, and now law] The deceptive-pattern taxonomy (Brignull; measured at
  scale by Mathur et al. 2019) is a banned list, not a toolkit: fake urgency or scarcity, countdowns that
  reset, confirmshaming ("no, I prefer to lose my memories"), asymmetric exits (one-click in, maze out),
  preselected extras. The FTC (2022) and the EU DSA (Art. 25) enforce this; for a product holding someone's
  private feelings, one manufactured urgency would also be the end of the trust the product runs on. The
  copy-side twin of this rule is [public-copy.md](public-copy.md)'s honesty policy.

## 10. Emotion, and what is remembered

- **Experiences are remembered by their peak and their end.** [research] Peak-end rule (Kahneman et al.,
  1993). A long surface has **one** designed peak and a composed ending — uniform spectacle has neither — and
  the exit moment is part of the design, not what happens after it. Negative moments are recalled more vividly
  than positive ones.
- **Three levels, audited separately.** [canon] Norman's emotional-design levels: **visceral** (the first
  frame's instant affect), **behavioral** (the feel of use), **reflective** (what the product lets someone
  believe about themselves). A surface can win one level and lose another — a beautiful first frame over a
  janky scroll, a smooth flow that says nothing about the person using it — so a review of "emotional fit"
  names which level a note is about.
- **Beauty buys tolerance — and hides defects.** [research] The aesthetic-usability effect (Kurosu &
  Kashimura 1995): pleasing design is perceived as more usable, which is both the return on visual investment
  and a warning that a beautiful surface tests better than it works. A review scores hierarchy and legibility
  through the beauty, not as it.

## 11. The folklore register

Named so nobody cites them as law. Each has a true core and false numbers:

| Folklore                          | The true core                                       | The false part                                         |
| --------------------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| **60-30-10 colour rule**          | dominant / secondary / single accent, in that order | the literal percentages — no study behind them         |
| **"7 items max"**                 | chunk into groups (Miller)                          | seven as a cap on menus — Laws of UX rejects it        |
| **Z-pattern layout formula**      | zigzag scanning exists on image-heavy pages         | the hero→diagonal→CTA prescription — designer folklore |
| **"whitespace = +20% usability"** | whitespace is the primary grouping tool (NN/g)      | the 20% figure — apocryphal, untraceable to NN/g       |

## 12. How the review reads this

The rubric ([design-review.md](design-review.md) §3) asks the questions; this document is what a good answer
looks like. The mapping for the 2D set:

| Rubric dimension        | Judged against                                     |
| ----------------------- | -------------------------------------------------- |
| 1 Hierarchy & focus     | §1 (one element, budget, squint test) · §3 (fold)  |
| 2 Typographic rhythm    | §1 (scale, three volumes) · §4 (two scripts)       |
| 3 Spacing & density     | §2 (proximity, unequal spacing, borders last)      |
| 4 Colour application    | §1 (weight/colour levers) · §5 (dark, glass, APCA) |
| 5 Component consistency | §2 (same thing, same look) · §9 (signifiers)       |
| 6 Motion coherence      | §7 (feedback, latency) · §8 (motion)               |
| 7 Emotional & brand fit | §10 (peak-end, three levels) · §9 (novelty)        |
| 8 Web ↔ mobile parity   | §9 (platform conventions are per-platform)         |

A **[research]** criterion outranks a decision in the design language: if the two conflict, the language is
what changes, through a review round. A **[convention]** bends to the language without ceremony.

## Sources

Primary: [NN/g — 10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) ·
[NN/g — visual hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) ·
[NN/g — scrolling and attention](https://www.nngroup.com/articles/scrolling-and-attention/) ·
[NN/g — the fold manifesto](https://www.nngroup.com/articles/page-fold-manifesto/) ·
[NN/g — F-pattern](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/) ·
[NN/g — text scanning patterns](https://www.nngroup.com/articles/text-scanning-patterns-eyetracking/) ·
[NN/g — proximity](https://www.nngroup.com/articles/gestalt-proximity/) ·
[NN/g — common region](https://www.nngroup.com/articles/common-region/) ·
[NN/g — glassmorphism](https://www.nngroup.com/articles/glassmorphism/) ·
[Laws of UX](https://lawsofux.com/) (Yablonski) ·
[Porter — principles of UI design](http://bokardo.com/principles-of-user-interface-design/) ·
[Brown — more meaningful typography](https://alistapart.com/article/more-meaningful-typography/) ·
[Utopia — fluid type scales](https://utopia.fyi/blog/designing-with-fluid-type-scales/) ·
[Baymard — line length](https://baymard.com/blog/line-length-readability) ·
[W3C — klreq (Hangul layout)](https://www.w3.org/TR/2013/WD-klreq-20130514/) ·
[APCA in a nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html) (Somers) ·
[WCAG 2.2](https://www.w3.org/TR/WCAG22/) ·
[web.dev — prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion) ·
[Material — dark theme](https://codelabs.developers.google.com/codelabs/design-material-darktheme) ·
[Deceptive Patterns](https://www.deceptive.design/) (Brignull) · Mathur et al. 2019, ACM CSCW ·
[FTC — Bringing Dark Patterns to Light](https://www.ftc.gov/news-events/news/press-releases/2022/09/ftc-report-shows-rise-sophisticated-dark-patterns-designed-trick-trap-consumers) ·
Lindgaard et al. 2006, _Behaviour & IT_ (50 ms) · Tuch et al. 2012, _IJHCS_ (complexity & prototypicality) ·
Norman, _The Design of Everyday Things_ (2013 rev.) · Norman, _Emotional Design_ (2004) ·
[Refactoring UI](https://www.refactoringui.com/) (Wathan & Schoger).
