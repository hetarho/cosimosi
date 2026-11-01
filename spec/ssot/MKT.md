# MKT marketing & blog
> r1 | the public funnel's own surfaces (the landing page at `/about`, the blog at `/blog/`) and the honesty rules every public sentence obeys

## decisions
- MKT-1 [o] the landing page's sections run in one fixed order: `hero → walkthrough → theory → blog → closing-cta`
  - `hero`: the headline over the empty universe →=MKT-20
  - `walkthrough`: one diary walked through the product's arc, ending in the colour-mirror definition and closed by the first demo invitation →=MKT-17
  - `theory`: five lay cards, one per research strand →=MKT-2
  - `blog`: one restrained line to `/blog/` for the reader who wants depth; nothing else on the page competes with it
  - `closing-cta`: the demo and signup pair →=MKT-3
  - guard: `LANDING_SECTIONS` (`pages/landing/model/sections.ts`) is a fixed-length literal tuple restated by `satisfies`, and an exhaustive `Record<LandingSectionId, …>` in `ui/LandingPage.tsx` is the only render path: dropping, reordering, duplicating or adding a section fails `tsc`
  - `model/sections.test.ts` pins the order and the retired ids `playground`, `feature-tour`, `mirror`, `demo-cta-top`, so none returns as a second render path
  - the header is chrome, not a section →=MKT-16
  - nothing beyond the sections and the header: no newsletter capture, no pricing page, no marketing or analytics stack beyond the app-wide web observability provider →=OBS
- MKT-2 [o] theory has two tiers that never mix: a lay summary on the landing with no academic citation, and the papers and DOIs on the blog ← a user never needs neuroscience knowledge, and a page that cites will one day cite something the product does not implement
  - landing tier: five cards, one lay paragraph per strand; `LandingTheoryCard` is `{ id, title, body, blogAnchor }` with no citation field, so a DOI can arrive only as prose, which the landing gate rejects →!MKT-10
  - blog tier: the depth, with what was and was not taken from each paper; every post cites at least one source, enforced by the collection schema →=MKT-30
  - the tiers share the five strand ids and nothing else →=MKT-22
  - the requirement↔evidence mapping belongs to neither tier →=SCI
- MKT-3 [o] the landing offers the demo twice, closing the walkthrough screen and in the closing block, and wherever the demo and the signup meet the demo comes first ← a stranger has no reason to trust a form yet, and the product only reads in motion
  - `LandingClosing` hardcodes `DemoCta` then `SignUpCta` and exposes no ordering prop, so no call site can reverse them
  - the first offer (`WalkthroughDemoCta`) is the last element of the walkthrough screen, not a section of its own; the hero carries no CTA
  - both demo CTAs go to `/demo` and are outlined (the low-stakes side door); the signup CTA goes to `/signup` and is the filled primary; no CTA carries an explanatory note
  - the two demo buttons share one appearance (`DemoButton`) and differ only in label: `landing_cta_demo_now` for the visitor who just watched the arc, `landing_cta_demo` for the colder reader at the foot
  - the same order holds on the other public surfaces: the blog post foot →~MKT-32 and the sign-in door's side doors, demo before `/about` (the door screen →=ACCT)
  - the demo ends by handing the visitor to signup →~DEMO-7
- MKT-4 [o] the landing speaks Korean and English: the locale is detected from the browser on a first visit and switchable by hand in the page header
  - detection is the shipped web negotiation: stored choice → `navigator.languages` → default →=CLIENT
  - a visitor has no account row, so `localStorage["cosimosi.locale"]` is the whole of persistence: no server preference is read or written
  - `LandingLocaleSwitch` is a two-option control; it reports through the `onSelectLocale` callback `LandingRoute` injects, which calls `setActiveLocale` and `writeStoredLocale` (a page never imports `app`)
  - `<html lang>` follows the active locale
  - not shared with the signed-in language control, which writes the profile under a different authority →=MKT-6
  - every rendered string is a `landing_*` key present in both `en.json` and `ko.json`; `pnpm lint:raw-strings` covers the page and the landing gate checks key-set equality →~MKT-10
  - keys name a UI role, never a domain term →=CLIENT
  - the blog is not localized →=MKT-31
- MKT-5 [o] the blog is an Astro static site (`apps/blog`) served at the `/blog/` subpath of the product origin, never a subdomain, a second domain or a second Worker ← one domain accumulates authority and every landing↔post link stays same-origin
  - the concrete origin is the one `DEPLOY.md` §1 records; no spec or public page names another
  - the blog owns the long-form depth of the theory →=MKT-2
  - serving →=MKT-27; subpath mechanics →=MKT-28; per-language posts →=MKT-31
  - no CMS, no comments, no blog-side search, no blog analytics, no per-post OG image (one committed raster serves every post →~MKT-32)
- MKT-6 [o] the in-app language setting lives on the settings page's profile tab (`/me`), on web and mobile →=ACCT-9
  - choosing a language applies it at once and writes the profile `locale` (`UpdateProfile`); web also writes the stored choice, mobile keeps none; a failed save reverts the change (`features/account-profile`)
  - signed in, the profile locale outranks the stored choice →=CLIENT
- MKT-7 [o] public copy says the product is inspired by memory research and never lets a reader conclude more: no public sentence may fall into one of five claim classes →!INV-12
  | class | forbidden | why |
  |---|---|---|
  | brain equivalence | the product works like, or the same as, a brain | it is inspired by engram research, not a model of anyone's brain |
  | therapeutic or clinical | treatment, healing, efficacy, therapy, cure, anything "clinically" | a diary makes no claim about anyone's health →~DEL-7 |
  | coordinates as anatomy | the 3D positions as the brain's real coordinates | positions emerge from the force simulation and change every frame →~INV-5 |
  | a mechanic the product lacks | emotion driving a position or a link's strength; memories attracting one another; radius meaning recency or emotion | emotion colours a memory and never places it; memories hang from shared neurons; radius is connectedness →~INV-3/4/7 |
  | academic citation outside the blog | a DOI, "et al.", a parenthesized author-year | the blog is the citing tier →=MKT-2 |
  - the framing that replaces them is fixed and positive: "inspired by" memory research, and the 3D layout is a visualization that emerges from shared neurons and synapse strength; which research each mechanism follows →=SCI
  - surfaces: the landing and its HTML shell, the demo, the blog, the app-store listing; the onboarding tour's copy meets the same classes though it runs behind auth →~ONB
  - the therapeutic class is blunt on purpose: a question that names a treatment counts like a claim
  - every public-copy change is reviewed against the classes before it ships; the mechanical gates (blog →=MKT-9, landing →=MKT-10) add to that review and never replace it
  - demo and store-listing copy have no mechanical gate, only the review →=DEMO
- MKT-8 [o] a denial is not a claim: public copy says plainly what the product does not do, and every gate lets the denial through ← a rule that punished the disclaimer would push the copy into saying nothing, and silence reads as a quiet yes
  - the landing carries the denial that this is a diary, not a model of anyone's brain (`landing_theory_intro`), beside the inspired-by framing
  - where research describes a phenomenon the product deliberately does not simulate, the post says so; worked example: mood-congruent recall is real research, and the product does not act on the reader's current mood
  - a post about emotion separates what emotion does (valence → colour, arousal → strength and forgetting rate →=MOOD) from what it does not (it places no memory and forms or strengthens no link →=INV-3)
  - a post that discusses position states that the 3D coordinates are a visualization emerging from the relationship graph, never the brain's coordinates →=INV-5, and that the radius is connectedness, never emotion and never recency →=INV-7
- MKT-9 [o] the blog's copy gate is `scripts/lint-public-copy.mjs` (`pnpm lint:public-copy`, part of `pnpm lint`) →!MKT-7
  - roots are data: `apps/blog/src/content` (`.md`, `.mdx`); another surface joins by adding a root, without re-deciding the classes
  - six classes: brain equivalence, therapeutic or clinical claim, coordinates as the brain's real coordinates, emotion driving a position or a link, memories attracting one another, radius meaning recency or emotion; no citation class, since the blog is the citing tier
  - a match counts only when the clause it starts (up to `.`, `!`, `?` or a line break) carries no negation (`NEGATION_TAIL`)
  - the window is the tail after the match, never the whole sentence: Korean negation is post-verbal, and a whole-sentence window would pass "Not just a diary — it works like your brain"
  - the negation set lists inflected stems (`아닙` as well as `아니`), because a final consonant baked into the syllable hides the plain stem
  - English text gets no denial exemption: an English post needs its own handling, never a widened window
  - `pnpm lint:public-copy:probe` (in `test:guards`) proves every class fires on its own offender and that none flags the permitted denials
- MKT-10 [o] the landing's copy gate is `pages/landing/model/copy-honesty.test.ts`, over every `landing_*` message in both catalogues and over `apps/web/index.html` →!MKT-7
  - all five classes, citation shapes included: a DOI (`10.<digits>/`), "et al.", a parenthesized author-year
  - the scan is per sentence, and the only exemption is the exact-sentence allowlist `REVIEWED_DENIALS` (apostrophes and whitespace normalized), never a negation rule: no negation rule can close "Not just a diary — it works like your brain"
  - adding an entry is a public-copy decision, not a test fix; a change that re-voices a reviewed denial updates `REVIEWED_DENIALS` in the same change
  - gap: no test checks that each entry still appears in a catalogue, so a retired sentence keeps its exemption until removed by hand
  - it also asserts identical `landing_*` key sets in `en` and `ko`, the positive framing present (`landing_theory_intro` matches "inspired by" or `영감`), and one deliberate offender per class that must fail
  - `lint-public-copy.mjs` does not scan the landing: this test is the landing's gate →~MKT-9
- MKT-11 [o] no public sentence links a repository-internal path; where the requirement↔evidence mapping needs naming, it is named in prose ← a repo path is not a URL a reader can open, and on the deployed origin a relative one resolves against the app
- MKT-12 [o] the landing carries no meta-disclaimer such as "nothing is saved" or "this is an invented example" ← a marketing page is self-evidently one, and the honesty invariant forbids overclaiming, not confidence →~INV-12
  - the claim classes and the denial exemption stay the gate →=MKT-7
  - the demo carries no standing theory note either; the inspired-by framing and its denial are the landing's →=DEMO
- MKT-13 [o] the app-store description stands in for a native marketing route and is written under the claim classes; its approved text is fixed →!MKT-7
  - title: "cosimosi — a diary you can look up at" (also the HTML shell's title)
  - paragraph 1: "Write down a day and it rises as a small light. Entries that share a person, a place or an idea hang from the same point, and a shape appears that nobody drew."
  - paragraph 2: "What you never return to grows faint and begins to lose its words. Return to it and it brightens — and comes back a little changed, the way remembering actually works. Your original entry is always kept."
  - paragraph 3: "The sky settles into the feelings you keep coming back to, so a year has a colour you can see at a glance. It is a mirror of what you return to, not an average of everything you felt."
  - paragraph 4: "Inspired by memory research. It is a diary, not a model of anyone's brain, and it makes no claim about your health."
  - any revision is a public-copy change, reviewed against the classes before it ships
- MKT-14 [o] public copy is plain, unhurried and addressed to the reader: no exclamation, no decorative emoji, no translation-ese; an invitation, not a sales line →~UI
  - every rendered landing string resolves through the i18n seam in both catalogues, so a sentence is reviewed once as public copy rather than once per surface
  - the Korean register and the general copy voice →=UI
  - persuasion never deceives (no fake urgency, no confirmshaming) →=UI
- MKT-15 [o] the landing lives at `/about`: a public route under `rootRoute` with no `beforeLoad` and no gate decision, so a signed-in visitor following a shared link reads it rather than being forwarded →=CLIENT
  - the origin root `/` is the sign-in door, not the landing →=ACCT; the landing is reached from the door's side door, from the blog and from search
  - `LandingRoute` (`app/routes`) supplies the destinations (`/demo`, `/signup`, `/login`) and the locale callback; `pages/landing` imports no router and no `app` module →~ARCH
  - `LandingSectionProps` is closed to `onTryDemo` and `onSignUp`; `onSignIn` is a page-level prop, because a returning visitor is not being asked anything
  - `/about` ships in the entry chunk, since a stranger lands on it cold →=CLIENT
- MKT-16 [o] the landing header is chrome, not a section: the brand lockup, the locale switch and a sign-in link, and nothing that competes with the page's first sentence
  - lockup: the flat mark (`public/brand/symbol.svg`, `aria-hidden` because the wordmark already names the product) beside `landing_wordmark`
  - the sign-in link (`landing_sign_in`, to `/login`) is the quietest control the design system has (`variant="text"`, `color="neutral"`, `size="sm"`), never a third CTA: a filled button would spend the eye the hero needs on a visitor who has already decided
  - it never moves into the closing block, where a third option beside the two asks would turn a two-way choice into a three-way one
- MKT-17 [o] the walkthrough walks one authored diary through the product's whole arc on one canvas, in six fixed steps that end in the colour-mirror definition →!MOOD-5
  | step | what the visitor watches |
  |---|---|
  | `split` | the diary splits into scenes, each with a name, a mood and neurons |
  | `launch` | the scenes rise as stars: colour from the mood, form from the sentence |
  | `color` | more days accumulate and the sky takes colour; there is no sky before this step |
  | `fade` | time passes unrecalled: stars dim and sentences lose words, never vanish |
  | `recall` | one dim star is recalled: brightness returns, and its text and form come back changed |
  | `mirror` | repeated recall of that memory widens its feeling's share of the sky; `landing_walk_mirror_definition` then states that the colour mirrors the feelings you return to, not their average |
  - guard: `WALKTHROUGH_STEPS` (`model/walkthrough.ts`) is a fixed six-member literal tuple restated by `satisfies`, mirror last: removing, reordering or adding a step fails `tsc`
  - `WALKTHROUGH_STEP_COPY` is exhaustive over the steps; removing `landing_walk_mirror_definition` from a catalogue fails the build
  - no connection or constellation beat: shared-neuron linking is the demo's to show →~DEMO-3
  - the definition is told here and in the demo, never by an affordance over the universe screen's sky →=MOOD-5
- MKT-18 [o] the walkthrough is hardcoded and advance-only: one authored diary in both locales with a precomputed split, so every run tells the same story ← the visitor is reading a story, not operating an app, and free play is the demo one click away
  - content: `config/walkthrough-content.ts` (the diary, its split scenes with names, moods and neurons, the accumulation entries, the recall target and its reconsolidated reading)
  - inputs: back, next, restart and the demo CTA only; no free text, no mood picker, no time slider
  - each step is two presses of `next` (the change, then the move on); the state is `{ step, acted }`, and `retreatWalkthrough` is the exact inverse of the forward walk, so going back never shows a state going forward would not
  - each caption is two sentences (what is about to happen, then what happened) and names no verb of its own: a caption naming the `별 쪼개기` button would name a control the screen does not have
  - no per-step verb buttons: they offer a choice the story does not have and spend the filled primary on a pager
  - the stage holds exactly one of `diary`, `scenes`, `universe`, derived from the scene facts: the written day is gone once split, because splitting consumes the entry
  - controls are text buttons (`next` secondary, `back` neutral); `next` becomes the replay at the ending; restart is small chrome hidden at both ends
- MKT-19 [o] the walkthrough's visuals are the shipped behaviour, never an animation of it: every derived fact goes through production functions, with no local formula
  - memories are real `EpisodicMemory` values built by the shipped rules: base strength from `arousalToInitialStrength` and the seed from the words
  - every decay slot is precomputed up front with the production `decayStageText` (one per `forgetting.stage_word_removal_ratios` entry), the same texts the advance hook persists →~FORGET-9/11
  - the eroded text is read through `currentDecayText`, never invented →=FORGET-12
  - recall swaps in the authored reconsolidated text with a `reshape`d seed
  - the scene's universe time is fixture data (`WALKTHROUGH_EPOCH` plus day offsets), never a user's clock →~TIME-5
  - the sky is the shipped universe weighting (`universeEmotionSlices`), which is the mirror definition's own mechanism →=MOOD-5
  - tuning keys: `landing.walkthrough_fade_span_days`, `landing.walkthrough_mirror_recalls`
  - the content authors no coordinate: stars stand in staged slots, since a handful of stars has no force simulation to emerge from →~INV-5
  - it consumes golden-parity-pinned functions read-only and defines or mirrors none →~ARCH
  - a per-star dot poster stands in before WebGPU, under the same boundary posture as the hero →~MKT-20
- MKT-20 [o] the hero is the empty universe a new account opens on: the brand mark, a headline and one paragraph over `widgets/empty-sky`, with no CTA and no navigation →~ACCT-2
  - `widgets/empty-sky` mounts exactly two layers through `UniverseCanvas`: `SkySphere` fed an illustrative stop set (`moodColor`) and `LatentStarField`, capped at `rendering.max_pixel_ratio` →=VIS
  - no episodic layer, filament, colour field, camera controls, simulation bridge or frame pump: the frame budget belongs to the demo one click later
  - no coordinate source is mounted, so no position exists on the page for a sentence to mis-describe as anatomy →~MKT-7
  - poster first: `public/landing-hero.png` sits under the canvas as the first paint, so a slow init, missing WebGPU or a rejected init leaves it showing with nothing to detect
  - reduced motion never mounts the canvas; the error boundary renders nothing and has no `resetKeys`
  - the poster is decorative: `aria-hidden`, no alt text
  - the palette (`EMPTY_SKY_MOODS`, `EMPTY_SKY_WEIGHTS`) is invented presentation content and mood names never render; `EMPTY_SKY_RATE` speeds the drift alone, reads no memory, strength or decay, and is the only sped-up thing on a public screen
  - `BrandMark` is the trademark, not a star: no GPU context and no domain read; it recedes on scroll through CSS variables written in a rAF
  - the widget is shared with the sign-in door so both public surfaces show the same night →=ACCT; neither page imports the other
- MKT-21 [o] the landing reads as two screens, then a document: the hero and the walkthrough each fill one viewport (`min-h-dvh`), and the page scrolls like a document from `theory` on
  - the empty sky is pinned `fixed` behind the whole page and mounted once (`LandingBackdrop`), so scrolling never restarts the renderer
  - one veil rises as the hero leaves and falls over the last half-viewport of the walkthrough's bottom edge, so the demo invitation is the last thing seen through the blur
  - the walkthrough has no panel of its own: its controls sit on the veiled sky in three anchored bands (chrome at the top, the run in the middle, the invitation at the foot)
  - the caption box is as tall as the longest caption, measured over every state in the visitor's language and width, never a hard-coded minimum height
  - theory cards are glass (`Card variant="glass"`) because the sky moves behind them
  - motion timings come from the design tokens (`lib/step-motion.ts`); the walkthrough runs under `MotionConfig reducedMotion="user"`
  - the scroll cue is a real button (`landing_scroll_cue`) at the foot of the hero and of the walkthrough; reduced motion jumps instantly
  - sections after the hero rise into place once, on first reach (`LandingReveal`); the hero never waits on an observer
  - per-frame scroll values are written to CSS variables in a rAF, never through React state; their numbers are authored where read, never `values.yaml` keys
- MKT-22 [o] the five research-strand ids are one contract across the landing and the blog: `engram`, `spatial-representation`, `synapse-time`, `reconstructive-recall`, `forgetting-accessibility`
  - landing: `LandingTheoryId` and `LANDING_THEORY_CARDS`, each card linking to `/blog/#<id>`; `model/sections.test.ts` pins ids, order and anchors
  - blog: the closed `PILLARS` enum, so an unknown pillar fails the blog build; the index emits one `id="<pillar>"` group heading per non-empty group
  - the ids are duplicated across the build boundary, never shared through a package →=MKT-34
  - what each strand grounds →=SCI
  - links into the blog are plain anchors with an absolute path, never router `Link`s: `/blog/` is static HTML outside the SPA router, and a client navigation lands in the SPA fallback
- MKT-23 [o] the landing and the empty sky cannot obtain a transport: `pages/landing` and `widgets/empty-sky` sit in the public-page import closure of `apps/web/eslint.config.js` ← the one thing the front door must be unable to do is read somebody's universe →~ACCT-1
  - banned: `@connectrpc/*`, `@cosimosi/api-client`, `@cosimosi/client-cache`, every server-backed `/react` read mirror, `@cosimosi/demo`
  - a closure, not an allowlist: every RPC function takes an `ApiTransport` and every hook that hides one calls `useTransport()`, so no later barrel export opens a path
  - narrower than the demo's block: the landing is not rule-exempt, so it needs no price, balance or colour-write ban →=DEMO
  - the block restates the three/R3F and i18n bans, because flat config replaces rule options per file
  - `pages/login` stays outside, since it must reach the auth facade; what it mounts of the landing, the sky, is inside
  - the landing issues zero calls to `apps/api`, holds no session, no real clock, no launch path and no demo state, and links to `/demo` by route path only →~INV-13
- MKT-24 [o] the origin's SEO root belongs to the app and is owned by the landing, never by the blog served beneath it
  - `apps/web/public/robots.txt` allows `/`, `/about`, `/demo`; disallows `/universe`, `/diary`, `/me`, `/admin`, `/login`, `/signup`, `/invite/`, `/test`, `/design`; names two sitemaps, the root one and `/blog/sitemap.xml`
  - it enumerates rather than `Disallow: /` plus an allowlist: an allowlist would block `/blog/`, so an unknown path stays unlisted, not blocked
  - `apps/web/public/sitemap.xml` lists `/about` alone, slashless
  - one canonical for every URL, `/about`: a client-rendered SPA serves one shell, and listing `/` or `/demo` would ask a crawler to index a self-declared duplicate; both stay allowed so a shared link is never blocked
  - `apps/web/index.html` carries the title, description, absolute canonical, `theme-color`, OG/Twitter tags over the raster `landing-og.png` (1200×630), and a `<noscript>` block with the hero line, the mirror definition and a `/blog/` link
  - every absolute URL uses the origin `DEPLOY.md` §1 owns; `lang="en"` is the shell default, corrected once the locale resolves
  - `landing-hero.png` (1600×900) and `landing-og.png` are generated procedurally and deterministically from the bare-night base and the illustrative mood weights
- MKT-25 [o] the landing is client-rendered with no prerender and no SSR: a crawler that runs no JS sees the shell ← the theory tier is already static HTML on the blog
  - revisit when organic search becomes a real acquisition channel
- MKT-26 [o] the landing, the blog and the `/blog/$` miss route are web only ← a native app has no marketing or article route, and whoever installed the app has already converted
  - mobile maps every signed-out decision to the login stack through `requiresSignIn` →=AUTH
  - stated in writing because `scripts/lint-fsd-layout.mjs` does not enforce web↔mobile page peering →~ARCH
  - the paired obligation is the store-listing copy →=MKT-13
  - the native sign-in screen keeps its plain card →=ACCT
- MKT-27 [o] the blog and the app ship from one Worker and one asset directory: `pnpm build:site` runs `build:blog` → `build:web` → `scripts/stage-blog.mjs`, in that order →!MKT-5
  - the order is load-bearing: Vite empties `apps/web/dist`, so a blog staged before the web build is silently erased
  - `stage-blog.mjs` fails the build when `apps/blog/dist` or `apps/web/dist` is missing, and when the staged `apps/web/dist/blog/` lacks `index.html` or `_astro/`
  - staging writes only under `apps/web/dist/blog/`, never over the origin-root files →=MKT-24
  - `wrangler.jsonc` declares `assets.html_handling: "auto-trailing-slash"` so `/blog` and `/blog/` both resolve to the index; the shared `assets.directory` and `not_found_handling` are unchanged by the blog
  - no second Worker, no zone route, no DNS change
  - `pnpm check` runs `build:site`; the live Worker, origin and Workers Builds commands are recorded in `DEPLOY.md`
- MKT-28 [o] the blog lives under its subpath by configuration: `base: '/blog'`, `trailingSlash: 'always'`, `build.format: 'directory'` (`apps/blog/astro.config.mjs`) →!MKT-5
  - every internal href derives from `import.meta.env.BASE_URL` through `src/site.ts` (`path()` for links, `absolute()` for anything a crawler or feed reader consumes), never a literal: `base` rewrites no authored href, and a literal `/rss.xml` works in dev and breaks in production
  - `build.inlineStylesheets: 'never'`, so every page requests `_astro/*` and a wrong `base` cannot hide behind inlined CSS
  - canonical form `/blog/<slug>/`; it cannot collide with the app router's slashless policy because `/blog/**` never enters the router →=CLIENT
  - the blog emits no `robots.txt` and no `favicon.svg` (origin-root paths →=MKT-24), references `/favicon.svg` same-origin, and publishes only `/blog/sitemap.xml` (the index and every non-draft post)
  - links from the blog to the product go to `/about`, never the origin root: the root is the sign-in door, and a reader who finished an essay is invited to look around
- MKT-29 [o] one post is one file, `apps/blog/src/content/posts/<slug>.md`, served at `/blog/<slug>/`; the slug is the filename in English kebab-case while the prose may be Korean ← a URL is code
  - routes: `/blog/` (non-draft posts newest first, grouped under their strand, each with a `lang` chip), `/blog/<slug>/`, `/blog/rss.xml`, `/blog/sitemap.xml`
  - the feed is hand-rolled RSS 2.0 over the newest non-draft posts, capped by `FEED_LIMIT`
  - blog prose is a scanned root of the UL lint (`apps/blog/src`); poetic user-facing words are canonical on this surface →=UL
  - a post describes behaviour and restates no tuning number; the figures stay in `values.yaml` →~ARCH
- MKT-30 [o] the `posts` collection schema (`apps/blog/src/content.config.ts`) is the publication gate: a post missing a required field fails the build →!MKT-2
  | field | rule | why |
  |---|---|---|
  | `title` | required, non-empty | - |
  | `description` | required, authored | a share card is written, never truncated from the body |
  | `pubDate` | required date | index order, feed, sitemap `lastmod` |
  | `updated` | optional date | `lastmod` and `dateModified` when a post is corrected |
  | `lang` | `ko` or `en` | the whole per-language story →=MKT-31 |
  | `pillar` | one of the five strand ids | the landing's theory anchors resolve against it →=MKT-22 |
  | `sources` | `{ label, doi }[]`, at least one | a post that explains the science cannot ship uncited |
  | `draft` | boolean, default false | the only publication switch |
  - `draft: true` excludes a post from the index, its own route, `/blog/rss.xml` and `/blog/sitemap.xml` at once, so the four surfaces cannot disagree
  - a source with no DOI is dropped from `sources`, never replaced by a DOI written from memory; the prose may still credit the work by name, since the schema governs the citation list, not the argument
- MKT-31 [o] blog posts are not localized: a translation is a separate post with its own slug and `lang`, never a localized variant of one file ← one file carrying two languages is how a half-translated post ships →!MKT-5
  - the blog stays outside the i18n seam and its gates (`lint:raw-strings` does not scan it); its chrome is authored in the Astro app →~CLIENT
  - no second-language index: every post lists in the one index with its `lang` chip
- MKT-32 [o] every post page carries an absolute canonical under `/blog/`, OG/Twitter tags over the committed raster `og-blog.png` (1200×630), an RSS `alternate` link, and `BlogPosting` JSON-LD whose `citation` entries come from `sources[]`
  - no SVG share image: the major social crawlers do not render SVG
  - the DOIs are visible below the essay and machine-readable above it, from one source
  - the foot carries the citations (label and DOI), up to `RELATED_LIMIT` other posts of the same strand, and one CTA pair, `/demo` then `/about` →=MKT-3
- MKT-33 [o] a miss under `/blog/**` renders `pages/blog-not-found` from the public splat route `/blog/$` under `rootRoute`, with no `beforeLoad` and no session or diagnostics requirement →=CLIENT
  - it never shadows a real post: static assets resolve first, and the SPA runs only on a genuine miss
  - blog-shaped chrome (`blog_not_found_title`, `blog_not_found_description`, `blog_not_found_action`) with a way back to `/blog/` through `window.location`, since `/blog/` is outside the router
  - it is a soft 404: `not_found_handling: "single-page-application"` answers HTTP 200, and a true 404 would need a Worker script the one-Worker arrangement rules out →!MKT-27
  - mitigations: `noindex` set on mount, and a blog sitemap that lists only real non-draft URLs
- MKT-34 [o] `apps/blog` reaches no product code: no `@cosimosi/*` package, no transport or Supabase client, no domain logic and no pure function, so it carries no golden-parity obligation →~ARCH
  - its dependencies are `astro` and the `wanted-sans` font, imported directly as the app's face rather than through `@cosimosi/ui` →~UI
  - its build constants (`FEED_LIMIT`, `RELATED_LIMIT`) are named module constants beside their readers, never `values.yaml` keys: no other surface reads them
  - `.astro` files have no Prettier parser here, so `format:check` skips them; the Markdown content is covered
  - `pnpm typecheck:blog` and `pnpm build:blog` gate the app inside `pnpm check`
- MKT-35 [o] FE placement: the landing is the `pages/landing` slice plus the `widgets/empty-sky` widget; the blog is the app root `apps/blog`, outside FSD, plus the `pages/blog-not-found` slice in `apps/web` →=ARCH
  - `pages/landing` segments: `model` the pure contracts and the copy gate (section tuple, walkthrough model), `ui` the section→component record and the scenes (a render concern, so `model` never imports `ui`), `config` the authored content, `lib` the scroll and motion helpers
  - the sections, the walkthrough scene and the locale switch are single-reference, so no `features/` slice exists for them; the empty sky is a widget because the sign-in door stands on it and a page may not import another page
  - `apps/blog`: the schema in `src/content.config.ts`, posts in `src/content/posts/`, one shared `BaseLayout.astro` (head, header, footer, the one stylesheet) under `PostLayout.astro` (article chrome, citations, JSON-LD), endpoints in `src/pages/`, the one URL helper in `src/site.ts`
  - `pages/blog-not-found` has a `ui` segment only and needs no steiger exemption

## flow
- visitor: search, blog or the door's side door → `/about`(hero → walkthrough(split → launch → color → fade → recall → mirror) → demo invitation) → theory cards(→ `/blog/#<pillar>`) → blog line → closing pair(`/demo` | `/signup`)
- reader: `/blog/` index(strand groups) → `/blog/<slug>/`(essay → citations → same-strand posts → `/demo` | `/about`); a miss under `/blog/**` → `/blog/$` not-found → `/blog/`
- release: `build:blog` → `build:web`(empties `apps/web/dist`) → `stage-blog.mjs`(asserts `blog/index.html` and `blog/_astro/`) → one Worker serves the app and `/blog/`

## constraints
- the landing owns two `values.yaml` keys, both for the walkthrough (`landing.walkthrough_fade_span_days`, `landing.walkthrough_mirror_recalls`), and the blog owns none; section, step and strand ids, copy, addresses, raster sizes, claim patterns, the empty-sky ramp and the scroll choreography are content or rule sets, never keys →~ARCH
- no surface in this domain reads or writes product data: the landing cannot obtain a transport →=MKT-23, and the blog depends on no product package →=MKT-34

## chg
- r1 261102 initial
