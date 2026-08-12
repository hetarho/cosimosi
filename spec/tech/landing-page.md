# tech: landing page

> As-built record of the public marketing page — `apps/web/src/pages/landing` on **`/about`**, the `widgets/empty-sky`
> ground it shares with the entry screen (§2b), plus the origin's SEO root. Plan
> [81](../plan/81.landing-page.md) owns it. The routing half (`requiresSignIn`, the door at `/`, the re-parented
> universe route, the trailing-slash policy) lives in [web-routing.md](web-routing.md) §2/§5b/§7/§8; the copy rules live
> in [policy/ux/public-copy.md](../policy/ux/public-copy.md). Web only, by a stated waiver (§8).
>
> **The root is the door, and this page is one click from it.** `/` renders the entry screen; the landing answers "what
> is this" at its own address, reached from the door's side door, from the blog, and from search. Nothing about the
> page's own composition changed with the move — it takes no session and resolves no gate — but every statement below
> about "the origin root" now means `/about`.

## 1. The section order is a type

`model/sections.ts` declares the five sections as a fixed-length literal tuple with a `satisfies` clause that restates
it, `LandingSectionId` derived from it, and `ui/LandingPage.tsx` holding an exhaustive
`Record<LandingSectionId, ComponentType<LandingSectionProps>>` it maps over as the **only** render path.

```
hero → walkthrough → theory → blog → closing-cta
```

The old `playground`, `feature-tour` and `mirror` sections were retired by change 09 and absorbed into the one
`walkthrough` section. The [M5] guard the section tuple used to carry moved one level **down** rather than weakening:
the walkthrough's step tuple (§1a) is a fixed six-member literal tuple ending in the mirror step, so dropping or
reordering the definition is a `tsc` failure exactly as dropping the old `'mirror'` section was.

**The first three sections are three screens.** `hero` and `walkthrough` are each `min-h-dvh`, so the page opens as a
screen of bare sky, then a screen of the argument, and only then begins to scroll like a document. The reading is a
layout fact rather than a convention: a section that stopped filling a screen would break the rhythm visibly.

**The rooms share one top inset.** `walkthrough` and `theory` — the screen of the argument and the head of the
document — both open `pt-14 sm:pt-20`, because they are the two places a visitor arrives at a room's top. `theory` used
to carry `pt-4`, which put its heading flush against the viewport edge for anyone who took the walkthrough's scroll cue,
and made the two rooms' entrances read as unrelated (design review, 2026-08-06). `blog` and `closing` sit mid-document
and keep their own smaller rhythm; nobody lands on their top edge.

**The standalone demo invitation is not a section.** It closes the walkthrough screen instead (§1a), because the moment
the offer earns a click is the moment the argument has just finished making its case — a section of its own put a scroll
between the two. `model/sections.test.ts` pins `'demo-cta-top'` in its retired-id list, so it cannot come back as a
second render path for something the walkthrough now owns.

That leaves two CTA placements: the end of `'walkthrough'`, and `'closing-cta'`. The pairing rule lives where both
buttons meet — `LandingClosing` hardcodes `DemoCta` then `SignUpCta` and **exposes no ordering prop**, so
demo-before-signup is not something a call site can get wrong. Both demo CTAs target `/demo`; the signup CTA targets
`/signup`. Both demo CTAs are **outlined** — the low-stakes side door — while the signup CTA is the filled primary, and
neither carries an explanatory note: the page has no meta-disclaimer at all (policy/ux/public-copy.md). The two demo
buttons share one appearance and one destination but not one label: the walkthrough's says "지금 바로 우주 체험해보기" /
"Try the universe right now" (`WalkthroughDemoCta`, `landing_cta_demo_now`) because it is read by someone who has just
watched the whole arc happen to someone else's diary, while the closing pair's is the plain "우주 체험해보기" / "Try the
universe" for a colder reader. `DemoButton` holds the one appearance both render, so the label is the only difference
either call site can express.

The page header is chrome, deliberately **not** one of the five: it carries the brand lockup (the flat mark from
`public/brand/symbol.svg` beside the wordmark, the mark `aria-hidden` because the wordmark already names the product),
the language switch, the sign-in link, and nothing that competes with the page's first sentence.

**The sign-in link is chrome, and the quietest control the design system has** — `variant="text"`, `color="neutral"`,
`size="sm"`, sitting beside the language switch. It is the way in for someone who already has a universe, and it is
deliberately not a third CTA: the page's two asks are the demo and the signup, both of them in the sections, and a
filled button in the header would take the eye the hero needs and spend it on the one visitor who has already decided.
It is also **not** a member of `LandingSectionProps` — the sections carry the two asks, and a returning user is not
being asked anything, so `onSignIn` is a page-level destination `LandingRoute` supplies alongside the other two. A
signed-in visitor never sees it: `/` forwards them to their universe before the page commits (§web-routing).

## 1a. The walkthrough — the argument, walked

`model/walkthrough.ts` owns the step contract and the pure model:

- **`WALKTHROUGH_STEPS`** — `split → launch → color → fade → recall → mirror`, `as const satisfies` the restated
  six-tuple, mirror last. This is the [M5] structural guard's new home.
- **The progression** is one fixed sequence, walkable a state at a time in either direction: `WalkthroughState` is
  `{ step, acted }`; `actOnWalkthroughStep` (idempotent), `advanceWalkthrough` (forward, only once acted),
  `retreatWalkthrough` (the exact inverse of the act/advance walk — stepping back can never reach a state a forward walk
  would not have shown), `restartWalkthrough`. Every full run is still a replay of the same story.
- **`walkthroughSceneFacts(content, state)`** derives everything the section renders — the stage, the memories on the
  canvas, the universe time, the sky stops, the returned-to memory's current reading — pure and total. Every derived fact goes
  through the shipped production functions: memories are real `EpisodicMemory` values whose `decayStages` are
  precomputed with `decayStageText` (the same erosion the server persists), the reading is `currentDecayText`, recall
  resets the anchors and swaps in the authored reconsolidated text with a `reshape`d seed (the changed reading grows a
  changed form), and the sky is `effectiveStrength`-weighted `toEmotionSlices` — [M5]'s stated mechanism (recall grows
  strength ([R3]) → that emotion's share of the sky), composed from two shipped rules with no local formula.
- **The sky arrives at the `color` step**, empty before it — the moment the colour shows up is the moment the caption
  says it does, the demo's own pattern.
- **`WalkthroughStageId`** — `'diary' | 'scenes' | 'universe'`, and the stage holds exactly ONE of them. The written day
  is **gone** once the split has happened: a diary sitting beside its own split scenes would say the two coexist, when
  splitting the entry is what produces the scenes and launching them is what produces the sky. Derived from the facts
  rather than from the step list (`memories.length > 0` ⇒ `'universe'`), so the stage cannot disagree with what the canvas
  would draw — and the id stays `'universe'` for every step from the launch onward, which is what keeps the renderer
  mounted once instead of remounting behind each transition.

`config/walkthrough-content.ts` holds the authored fixture (one well-written diary in ko and en, its precomputed split
scenes with names/moods/neurons, the accumulation entries, the recall target and its reconsolidated reading) and
`WALKTHROUGH_STEP_COPY`, an exhaustive `Record<WalkthroughStepId, …>` of message accessors — a step without copy is a
`tsc` failure. Each step carries exactly two sentences — what is about to happen, then what happened — and **no verb of
its own**: the run's only control is `next`, so a caption naming a "별 쪼개기" button would name something the screen
does not have. The content authors **no coordinate** ([I5]): where a star stands is the scene's staged-slot concern.

`ui/LandingWalkthroughScene.tsx` is the playground scene evolved to a cast: the production `UniverseCanvas` +
`SkySphere` + one `InstancedNodeLayer` over `starChannels`, with staged slot positions (a group portrait has no
force-sim to emerge positions from), a per-star dot poster beneath it for the no-WebGPU first paint, and the same
no-`resetKeys` error-boundary posture as the hero. `ui/sections/LandingWalkthrough.tsx` renders caption + back/next +
restart over it, and renders the `landing_walk_mirror_definition` sentence at the mirror ending — removing that key from
the catalogues fails the build.

**The screen has no panel of its own, and that is what marks it as a screen.** There is no glass card around the
walkthrough: the section is `min-h-dvh` with its bands anchored to its edges, and the surface its controls sit on is the **veiled
sky** (§2a) — the veil is at full strength across exactly this stretch. A card here would be a second surface drawn on
top of a surface, and the room would stop reading as a room. The stage's own views still carry their own grounds (the
diary's panel, the split's bordered rows, the canvas), so nothing legible sits directly on a live sky.

**The screen is three anchored bands, not one centred column.** `pt-14 sm:pt-20` and `pb-24` (which clears the scroll
cue) are the insets, and between them the section runs: the **chrome** (replay + step counter) pinned at the top edge,
the **run** (stage → caption → back/next) taking the slack with `grow justify-center`, and the **invitation** pinned
at the foot, immediately above the cue. Anchoring the two ends is what makes the counter and the demo CTA stand in the
same place on all twelve states, so only the run between them breathes; a single centred column moved all four when the
caption's height changed. `min-h-dvh` rather than a fixed height keeps it safe on a short viewport, and the middle band
is `grow` rather than `flex-1` for the same reason: a zero flex basis would size it from the leftover space alone, so a
screen too short for the stage would overflow the run into the invitation instead of growing the section and scrolling.

**The caption box is as tall as the longest caption, measured.** `WalkthroughCaptionBox` lays every `(step, acted)`
caption into one CSS grid cell — hidden, `aria-hidden`, rendered as plain text rather than as motion spans — and puts
the live one over them. The box is then the tallest of them **in the visitor's own language and at their own width**,
which is what a hardcoded `min-h-*` cannot be: that number would be a guess to re-tune on every copy edit and every
translation. Without it the back/next row moved whenever a step's words wrapped to an extra line, which reads as the
page flinching. The state list is derived from `WALKTHROUGH_STEPS`, so a seventh step is measured by construction.

**Back and next take the column's two edges on a phone** (`justify-between`) and close up on the right from `sm` up
(`sm:justify-end`). Both are single deliberate alignments; the middle is never one, because the pager would then share
a centre line with the invitation below it.

**The action zone shares one alignment edge on a phone.** The step controls are `justify-center sm:justify-end`: at
390px a column that ran the caption left, the pager right and the invitation centred had three alignment edges in a
space too narrow to read any of them as deliberate (ui-principles §2). From `sm` up the pager takes the column's right
edge as before.

**The column barely moves as the story does.** The chrome row (`h-8`) and the stage (`h-80 sm:h-104`) are fixed; the
caption below the stage is sized by what it says, with the captions authored to comparable lengths so stepping changes
the column's height only slightly (the owner's chosen trade over reserving room for the tallest variant). Inside the
stage, the diary's **panel** is sized by the entry rather than stretched to the box — a fixed-height ground around a
short entry reads as a layout accident, so the panel takes the height its words need (`max-h-full`, scrolling past that)
and sits centred in what is left, while the box itself stays put so the controls below never move. The chrome is
hidden rather than removed when it does not apply (replay at the run's ends, back at the start), so nothing reflows. `motion` (`motion/react`) animates each swap: `AnimatePresence mode="wait"`
keyed by the **stage id** for the stage and by `step:acted` for the words. The stage's swap is a fade-and-rise; the
caption's is a pure-opacity **word wipe** — every word is its own motion span delayed by reading order, so the old
caption thins out left to right and the new one surfaces the same way, the text rewriting itself in place. The whole
section sits in one `<MotionConfig reducedMotion="user">`, which drops the transforms and keeps the fades. The
choreography's numbers are not authored in the slice: `lib/step-motion.ts` reads `tokens.duration` / `tokens.ease` and
converts them to Motion's seconds-and-bezier form, so the page moves at the product's pace and a token change carries it.

**The run has one control, and it is `next`.** Both step controls are **text** buttons at the foot of the column
(centred on a phone, bottom-right from `sm` up — see above),
each carrying the arrow of the direction it moves the run (drawn locally as the scroll cue's chevron turned on its side,
so the page's navigation affordances read as one family): `back` in the neutral ink, `next` in **secondary**. Each step
is two presses of the same button — the change, then the move on — so the visitor walks the whole arc without ever
choosing what to do. A per-step verb button (`별 쪼개기`, `시간 흘려보내기`) offered a choice the story does not have and
made the screen read as an app being operated; it also spent the page's filled primary on a slideshow's pager, which
then competed with the two real asks. `next` becomes the replay at the ending. `restart` is secondary chrome, small in
the top-left across from the step counter, and hidden at both ends of the run — nothing to replay at the start, and the
ending's own action _is_ the replay. The section has no title of its own — the stage speaks for itself.

**The invitation closes the screen.** `WalkthroughDemoCta` is the last thing in the column, centred, below the step
controls; the section takes `onTryDemo` from `LandingSectionProps` like any other. Below it, `ui/LandingScrollCue.tsx`
repeats the hero's cue (§2).

The visitor's only inputs are back/next/restart and those two: no free text, no mood picker, no time slider.
Deterministic on purpose — the free-play surface is the demo, one click away, and the two must not compete.

## 2. The hero — the empty universe, and the poster first

`widgets/empty-sky` (§2b) mounts the real renderer through `UniverseCanvas` with **exactly two layers**: `SkySphere`
(the shipped active skin, fed an authored illustrative stop set built from `moodColor`) and `LatentStarField`, at
`rendering.max_pixel_ratio`. No episodic layer, no cell body, no filament, no colour field, no `CameraControls`, no sim
bridge and no frame pump — the hero is not navigable, and a marketing page is not where the frame budget the demo needs
one click later should go. `SkySphere` self-animates through `useFrame`, so no host pump is required.

It is honest twice: it is the same two layers a new account opens on — an illustrative palette drifting at an illustrative
pace (§3), nothing invented beyond those two — and, because no coordinate source is mounted at all, there is no position on
the page that any sentence could mis-describe as anatomy.

**Fallback order.** The committed raster `public/landing-hero.png` sits **under** the canvas rather than being swapped for
it, which is what makes "the poster is the default" true rather than aspirational. It is the first paint; the canvas clears
to opaque night over it once the renderer is up. Every way the renderer can fail to arrive then needs no detection at all
— a slow init, no WebGPU, or a rejected `renderer.init()` that never throws during render — because nothing paints and the
poster is simply still there. `useReducedMotion()` skips the canvas entirely (the hero's whole motion is the sky's drift,
so there is nothing left to honour). The `ObservedErrorBoundary` around it catches a render-time throw only, renders
nothing of its own, and carries **no** `resetKeys`: retrying WebGPU behind a marketing headline buys nothing.

The poster is **decorative and carries no alt text**: it is a full-bleed ground behind the page's own words, and the
landing pins it inside an `aria-hidden` backdrop anyway. A backdrop that described itself would be read out ahead of
the sentence it exists to sit behind.

**The two rasters** (`landing-hero.png` 1600×900, `landing-og.png` 1200×630) are committed and were generated
procedurally rather than designed: the active skin's bare-night base `#0a0a12`, lit by the same illustrative mood weights
the hero's ramp uses, with the latent field as faint seeded points. Deterministic, so a regeneration reproduces the same
bytes. A designed OG card is a later call, not a blocker.

**The mark stands above the headline, and leaves before the screen does.** `BrandMark` (`@cosimosi/ui`, see
[design-system.md](design-system.md)) draws the trademark as a turning solid. It is **not** the renderer and not a star:
no GPU context, no `EpisodicMemory`, no channel read from the domain — the stars on this page that mean something are in
the walkthrough, where the captions name what each is saying. `lib/use-mark-recede.ts` writes `--mark-scale` and
`--mark-opacity` from scroll position inside a rAF (never through React state, the same contract the veil holds), and the
hero applies them as a transform, so the box keeps its size and the headline never shifts. Scale runs nearly the whole
way down while opacity holds near full and then drops as a cube: a mark that faded evenly while shrinking is a smudge
thinning out, one that stays bright while it gets small is a light going away. Reduced motion pins both at 1.

**The cue is a control, not a decoration.** `ui/LandingScrollCue.tsx` is a real `<button>` (it moves the viewport, so it
has to be keyboard reachable and has to say what it does — `landing_scroll_cue`), bouncing under `motion-safe`, and it
finds its own destination: the enclosing `<section>` is one screen, so that section's bottom edge is the next screen's
top and no ref has to be threaded to it. Under reduced motion the jump is instant rather than smooth — a long smooth
scroll is exactly the motion the preference is asking to be spared. It appears at the foot of the hero and of the
walkthrough.

## 2a. The backdrop, and the veil that is not monotonic

`ui/LandingBackdrop.tsx` pins the empty sky `fixed` behind the whole page — mounted **once**, so scrolling never
restarts the renderer — with a single veil element over it whose only moving part is the `--veil` custom property
(`lib/use-scroll-veil.ts`, written in a rAF). At full strength the veil is a backdrop blur plus a `bg`-mixed wash, built
the same way the design system's glass is, so the veiled sky reads as the same material family as the panels over it.

The curve **rises and then falls**, and both halves are load-bearing:

- It **rises** as the hero leaves (over ~0.9 of a viewport, settling before the next screen arrives), because the
  blurred night is the surface the walkthrough's controls sit on. This is the only thing marking that screen as its own
  room now that it carries no card of its own (§1a).
- It **falls** as the walkthrough screen finishes leaving. The clearing is driven from the anchor's **bottom** edge over
  the last half-viewport, not from its centre: the anchor is a screen-tall section, and a centre would start handing the
  sky back while the visitor is still working through the argument. The invitation at the foot of that screen is
  therefore the last thing seen through the blur.

The anchor is passed as an element, not a section id, because the veil needs the measured position — and it is attached
in `LandingPage` rather than inside the section, because `LandingSectionProps` is deliberately closed to the two
destinations. The page owns layout, so the page owns the anchor. A measured anchor also means the clearing tracks the
section wherever the content above pushes it to, rather than a scroll distance that would drift as copy changes.

**The consequence to keep in view:** the theory cards are read over a sky that is coming back into focus. That is why
they are `Card variant="glass"` and not a flat surface — glass earns its cost only when something is moving behind it —
but it does mean legibility there depends on the sky's brightness rather than on a fixed contrast pair.

## 2b. The empty sky is a widget, and the door stands on it

The scene of §2 lives in `apps/web/src/widgets/empty-sky` — `ui/EmptySky.tsx` (the two layers, the poster beneath them,
the boundary around them) and `config/illustration.ts` (§3). It fills whatever box it is given and owns only what is
drawn, so **a page decides where the sky is**: the landing pins it behind the whole scroll and veils it (§2a), and
the door (`/` · `/login` · `/signup`) holds it still behind one screen.

A widget rather than a second copy, and a widget rather than a page importing a page: `pages/login` may not reach into
`pages/landing` (§3.1), and the alternative — the same scene authored twice — is how the two public surfaces drift into
looking like two products. The move also takes the sky's own decisions (the layer list, the poster-first order, the
reduced-motion skip, the no-`resetKeys` boundary) out of the landing's slice, where nothing else could have reused them.

**The closure follows it.** `widgets/empty-sky` is added to the public-page import block in `apps/web/eslint.config.js`
beside `pages/landing` (§6). A shared surface outside the closure would be exactly the hole the closure exists not to
have: one transport import added there and every public page has a transport again, with nothing in the landing's own
files to fail.

**The door is the landing's first screen, wearing a form.** `pages/login/ui/LoginPage.tsx` — `/`, `/login` and
`/signup`, the same component in its two modes — renders the sky, the hero's soft local floor over it, `BrandMark`,
the mode's one sentence (`login_title` / `signup_title`) as the screen's `h1`, and the credential form in a
`Card variant="glass"` beneath. The title is the **screen's**, not the panel's, which is what makes the column read as
one lockup instead of a card with a heading floating on a picture: the form stands where the hero's paragraph does. The
continuity is the point — whichever surface a visitor meets first, the other must look like the same night, and a flat
card on a flat ground would read as a different product.

- **The mark is large here and small everywhere else** (`size-24 sm:size-28`, against the landing header's 20px
  lockup). This is the origin root, so it is the first thing anyone sees of the product and the only place the brand
  has room to be a picture rather than a label — the same solid doing the opposite job.
- **Two side doors under the panel** — the demo (`primary`) and `/about` (`secondary`), both `variant="text" size="sm"`.
  A stranger arrives at the form rather than at the argument, so the screen has to offer both the sandbox and the
  explanation. They separate by **colour, not weight**: the shape stays the quietest the system has, so neither competes
  with the Google button, and the demo leads because a stranger has no reason to trust a form yet
  ([public-copy](../policy/ux/public-copy.md)'s demo-before-the-ask rule). Destinations arrive as callbacks from
  `app/routes` (a page imports no router), like every other page-level navigation.
- **Google only, and the screen says so.** `CREDENTIAL_ENTRY_ENABLED` (one flag in the page) disables the email and
  password fields and the submit, and `login_google_only` states the reason directly under the Google button — before
  the fields it explains, not after them. The fields stay rendered rather than removed: someone who came to type an
  email is told why the field refuses them instead of hunting for one that is not there, and the form, its machine and
  its failure copy stay wired so re-enabling is the flag alone. The policy is [signup.md](../policy/ux/signup.md).
- **One screen, and only one.** No scroll and nothing below the fold: the whole choice — Google, the fields, the
  submit, the way across to the other mode, the side doors — fits the viewport. `min-h-dvh` rather than a pinned `h-dvh` is what keeps
  that safe: where the viewport is too short to hold the column (a small phone in landscape, a keyboard eating half the
  screen) it grows and scrolls rather than clipping its own submit button, which is the one failure a locked height
  produces. The sky is `fixed`, so it is the same size whatever the mode costs in height.
- **The glass declares its floor over the hero's own floor.** The `bg`-mixed ellipse the hero puts under its words
  (`bg-bg/35 blur-3xl`) sits under this column too, so the panel's tint is added to a known ground rather than to a hope
  about which night the visitor gets — the [ui-principles](../policy/ux/ui-principles.md) §5 rule that a glass surface
  carrying text is only as legible as the scene's brightest frame.
- **Only the ground is recorded here.** Everything the screen _does_ — the facade actions, the credential machine, the
  hold-while-settling and bounce-when-authenticated rules, the `from` replay — belongs to
  [web-routing.md](web-routing.md) §5b and [auth.md](auth.md) and is untouched by the treatment.
- **Mobile is out of scope by the same waiver as the landing (§8).** The native app has no marketing route and no such
  ground; `apps/mobile`'s `LoginPage` keeps its plain centred card.

## 3. Authored content, and what it may not carry

`config/theory-cards.ts` holds the five research strands as a fixed-length tuple with `satisfies` (the five tour items
it used to hold retired with the feature-tour section). A `LandingTheoryCard` is `{ id, title, body, blogAnchor }` and
has **no citation field**: a DOI cannot be a rendered datum, so an over-claiming citation could only arrive as prose —
which §5 rejects. The landing carries the summary a non-specialist reads; papers live one tier down on the blog.

The five ids are the same strings the blog owns as its closed `pillar` enum and emits as group-heading ids —
`engram` · `spatial-representation` · `synapse-time` · `reconstructive-recall` · `forgetting-accessibility`. They are
duplicated across a build boundary rather than shared, so `model/sections.test.ts` pins this side and an unknown pillar
fails the blog's own build from the other.

Both blog links are **plain anchors with an absolute path**, never router `Link`s: `/blog/` is Worker-served static HTML
outside this router, and a client navigation would land in the SPA fallback.

`widgets/empty-sky/config/illustration.ts` holds the invented moods and weights of the empty sky's ramp
(`EMPTY_SKY_MOODS` / `EMPTY_SKY_WEIGHTS`) — the mirror-swatch half retired with the mirror section — plus
`EMPTY_SKY_RATE`. It travelled with the scene (§2b): the ramp is what that sky is made of, and a page holding the
palette for a widget it merely mounts would be an authored fact two surfaces had to agree on by hand. Presentation
content like a theme table: there is no right answer to converge on, so none of it is a tuning value. The walkthrough's
diary lives separately in `config/walkthrough-content.ts` (§1a).

**Eight moods, at 2.5×.** A feeling's weight buys it AREA in the emotion ramp, so the ramp's length is what decides how
much of the palette a visitor sees — eight unequal feelings divide the sky into eight places rather than five, and none of
them gets a sliver the fold smears away before it can be named. `EMPTY_SKY_RATE` is handed to `SkySphere`'s `rateRef` (the
per-frame seam the product's own time acceleration writes) as a constant the scene never touches: the shipped pace is tuned
for a place you live in, and a visitor here for a few seconds would read 1× as a still image. It accelerates a **drift**,
not a mechanic — no memory, strength or decay is read from it — and it is the only thing on either public screen that is
sped up. The
mix is chosen for the brand: the moods whose canonical colours sit nearest the design system's **primary** (lavender —
`FEAR`'s violet, `EMPTINESS`'s violet-grey, `STRESS`'s magenta, `SAD`'s blue) carry 12 of the ramp's 20 shares, the ones
nearest the **secondary** (chartreuse — `RELIEF`, `CALM`) answer with 4, and rose and dusty blue keep the wash from
reading as a two-colour gradient. Mood names never render on the page — only their colours do.

## 4. Locale — the first writer reachable without a session

Detection is the shipped negotiation, unchanged. A visitor has no account row, so there is no server `users.locale` in
the precedence: `localStorage["cosimosi.locale"]` is the whole of persistence. `LandingLocaleSwitch` reads
`useActiveLocale()` and reports the choice through the `onSelectLocale` callback `LandingRoute` injects, which calls
`setActiveLocale` + `writeStoredLocale` — keeping `pages → app` off the import graph.

Deliberately **not** a shared slice with `/me`'s language control: that one writes `UpdateProfile` for a signed-in user,
a different operation with a different authority, and the only genuinely common part (the negotiation) already lives
below both.

## 5. The copy-honesty test

`model/copy-honesty.test.ts` runs over every `landing_*` message in **both** catalogues and over `apps/web/index.html`
— the two places this unit puts prose in front of a stranger. It reads them via Vite `?raw` imports rather than
`node:fs`, so the app's browser tsconfig needs no Node types. Five forbidden classes:

1. brain equivalence;
2. therapeutic or clinical claims;
3. any sentence presenting the 3D coordinates as the brain's real coordinates;
4. mechanics the product does not have — emotion driving position or link strength, memories attracting one another,
   radius meaning recency;
5. academic-citation shapes — a DOI, "et al.", a parenthesized author-year.

It also asserts the `landing_*` key sets match across catalogues, that the positive framing ("inspired by" / 영감) is
actually present, and — via a self-proof case per class — that each matcher can fail.

**The scan is per sentence, and the exemption is an exact-sentence allowlist** (`REVIEWED_DENIALS`), not a negation rule.
That is the one subtlety worth knowing, and it was arrived at the hard way. "It is a diary, not a model of anyone's brain"
is the sentence the rule wants on the page, so some exemption is required — but a negation rule has a hole you cannot
close by tightening it: _"Not just a diary — it works like your brain."_ carries a negation and the forbidden claim in one
breath, and any "is there a `not` nearby" test lets it through. Listing the reviewed sentences instead means every
disclaimer is a deliberate entry a reviewer sees, and nothing else gets the exemption. Two tests hold the ends together:
the overclaim-with-negation must still fail, and every allowlist entry must appear verbatim in the catalogue, so a copy
rewrite retires its exemption instead of leaving a licence lying around.

Adding a sentence to that list is a public-copy decision, not a test fix.

A test rather than a lint script **on purpose**: the repo-wide `scripts/lint-public-copy.mjs` is the blog unit's and
lands after this one, so a script here would be a second thing checking the same rule. When it arrives it takes these two
roots (`packages/i18n/messages/*.json` scoped to `landing_*`, and `apps/web/index.html`); this test stays as the unit's
own regression guard.

## 6. The import closure

`pages/landing` and `widgets/empty-sky` (§2b) are inside the public-page import closure — a second, narrower block
beside the demo's in
`apps/web/eslint.config.js`. Banned: `@connectrpc/*`, `@cosimosi/api-client`, `@cosimosi/client-cache`, every
server-backed `/react` read mirror, and `@cosimosi/demo`. Read it as a **closure, not an allowlist**: every function that
issues an RPC takes an `ApiTransport` first, and every hook that hides one calls `useTransport()`, so a page starved of
both cannot call the server whatever barrel export drifts into scope later.

Narrower than the demo's block on purpose. The landing is not rule-exempt — no sandbox, no free time travel — so it needs
no ban on prices, balances or the `AccountService` colour writes; it simply never reaches for them. What it does need is
the transport ban, because the one thing the front door must be unable to do is read somebody's universe. The three/R3F
and i18n bans are restated inside the block: ESLint flat config replaces rule options per matching file rather than
merging them.

`pages/login` is deliberately **outside** it. The sign-in screen composes the auth facade, which is the one public
surface that must reach a server, so the closure would have to be holed to admit it — and a holed closure proves
nothing. What it mounts of the landing is the sky, and that is inside.

## 7. The origin's SEO root

The origin root belongs to the app, not to the blog served beneath it.

- **`public/robots.txt`** — indexable `/`, `/about` and `/demo`; disallows `/universe`, `/diary`, `/me`, `/admin`,
  `/login`, `/signup`, `/invite/`, `/test`, `/design`. The SPA answers all of them with the same `index.html`, so
  without those lines a crawler indexes landing content under half a dozen wrong URLs. Two `Sitemap:` lines — the root
  one and `/blog/sitemap.xml`, which the blog depends on being named here.
- **`public/sitemap.xml`** — a plain urlset listing **`/about`** alone, in the canonical slashless form.
- **`index.html`** — title, description, absolute canonical, `theme-color`, OG/Twitter tags over `landing-og.png`, and a
  `<noscript>` block carrying the hero line, the mirror definition and a link to `/blog/`. The origin literal is
  `https://cosimosi.haeram.me`, with [DEPLOY.md](../../DEPLOY.md) §1 named in a comment as its SSOT — an address, not a
  tuning number. `lang="en"` is the shell default; the i18n provider corrects it once resolved.
- **`/blog/` is a live destination this unit does not serve.** Six links (five theory cards plus the blog line) point at
  `/blog/`, and until plan 82 ships they resolve to the SPA's not-found screen. That is the build order the plans chose —
  81 owns the origin root and the `Sitemap:` line 82 depends on, so it lands first — but it is a real user-visible state
  in the window between them, not a subtlety. The `/blog/sitemap.xml` line is likewise a forward reference.
- **One canonical applies to every URL**, because a client-rendered SPA serves one shell — and it names `/about`, the
  one address whose RENDERED page matches the shell's title, description and OG card. That is also why the sitemap
  lists `/about` alone: listing `/` or `/demo` would ask a crawler to index a URL that then declares itself a duplicate.
  Both stay `Allow`ed so a shared link is never blocked, and neither has crawlable content of its own — one is a form,
  the other a JS sandbox.
- **`robots.txt` enumerates rather than allowlists.** `Disallow: /` plus an allowlist would express "only these are
  indexable" exactly, but it would also block `/blog/` — the tier the theory cards exist to lead to. So an unknown path is
  unlisted rather than blocked: it returns the shell and the not-found screen.
- **The honest limitation:** the landing is client-rendered, so a crawler that does not execute JS sees the shell only.
  Prerendering is deferred, not forgotten — the theory tier is real static HTML on the blog, and the trigger for
  revisiting is organic search becoming a real acquisition channel. No prerender dependency was added.

## 8. Parity waiver

Web only. A native app has no marketing route — a person who installed the app has already converted — so mobile maps
`'landing'` to the login stack through `requiresSignIn`. The waiver is written out because
`scripts/lint-fsd-layout.mjs` does **not** enforce web↔mobile page peering, so an unstated waiver would be silently
broken rather than caught; it follows the admin-console precedent (`spec/policy/ops/admin.md` §6). The obligation paired
with it is the store-listing copy, authored under the same rules in
[policy/ux/public-copy.md](../policy/ux/public-copy.md).

## 9. No values key

The unit declares none and adds no group. It _references_ five generated constants the hero reads —
`rendering.max_pixel_ratio`, `rendering.active_skin`, `rendering.latent_star_count`,
`rendering.latent_field_radius`, `rendering.latent_star_size` — and consumes them unchanged. Motion timings come from
the design tokens (`lib/step-motion.ts` converts them, §1a); the hero's sky rate and its ramp are presentation content
(§3). The five section ids, six walkthrough step ids and five theory ids are array content whose counts are
fixed by
the PRD; every string of copy is i18n content; the origin and every path are addresses; the OG raster's 1200×630 is a
fixed external platform spec; and the copy-honesty patterns are a rule set, not a knob.

The scroll choreography's numbers are presentation content of the same kind as the sky ramp: the veil's rise runway
(~0.9 viewport), the clearing's half-viewport window (§2a), and the mark's recede runway and curves (§2) are authored
where they are read, not in `values.yaml`. None of them is a mechanic — no memory, strength or decay is derived from any
of them — and there is no right answer to converge on.
