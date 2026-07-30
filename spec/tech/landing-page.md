# tech: landing page

> As-built record of the public front door — `apps/web/src/pages/landing` on `/`, plus the origin's SEO root. Plan
> [81](../plan/81.landing-page.md) owns it. The routing half (the fourth gate arm, `requiresSignIn`, the re-parented
> universe route, the trailing-slash policy) lives in [web-routing.md](web-routing.md) §2/§5b/§7/§8; the copy rules live
> in [policy/ux/public-copy.md](../policy/ux/public-copy.md). Web only, by a stated waiver (§8).

## 1. The section order is a type

`model/sections.ts` declares the seven sections as a fixed-length literal tuple with a `satisfies` clause that restates
it, `LandingSectionId` derived from it, and `ui/LandingPage.tsx` holding an exhaustive
`Record<LandingSectionId, ComponentType<LandingSectionProps>>` it maps over as the **only** render path.

```
hero → demo-cta-top → feature-tour → mirror → theory → blog → closing-cta
```

Dropping `'mirror'`, putting `theory` ahead of it, or adding an eighth section without placing it in the tuple is a `tsc`
failure. That matters most for `mirror`: a visitor who leaves believing the sky averages their feelings will read their
own universe wrong for months, so the definition is a required section rather than a paragraph a redesign can drop.

CTA order gets the same treatment one level down. `'demo-cta-top'` renders `DemoCta` alone; `'closing-cta'` renders one
`LandingClosing` that hardcodes `DemoCta` then `SignUpCta` and **exposes no ordering prop**, so demo-before-signup is
not something a call site can get wrong. Both demo CTAs target `/demo`; the signup CTA targets `/signup`.

The page header is chrome, deliberately **not** one of the seven: it carries the wordmark and the language switch and
nothing that competes with the page's first sentence.

## 2. The hero — the empty universe, and the poster first

`ui/LandingHeroScene.tsx` mounts the real renderer through `UniverseCanvas` with **exactly two layers**: `SkySphere`
(the shipped active skin, fed an authored illustrative stop set built from `moodColor`) and `LatentStarField`, at
`rendering.max_pixel_ratio`. No episodic layer, no cell body, no filament, no colour field, no `CameraControls`, no sim
bridge and no frame pump — the hero is not navigable, and a marketing page is not where the frame budget the demo needs
one click later should go. `SkySphere` self-animates through `useFrame`, so no host pump is required.

It is honest twice: it is literally what a new account looks like, and — because no coordinate source is mounted at all —
there is no position on the page that any sentence could mis-describe as anatomy.

**Fallback order.** The committed raster `public/landing-hero.png` sits **under** the canvas rather than being swapped for
it, which is what makes "the poster is the default" true rather than aspirational. It is the first paint; the canvas clears
to opaque night over it once the renderer is up. Every way the renderer can fail to arrive then needs no detection at all
— a slow init, no WebGPU, or a rejected `renderer.init()` that never throws during render — because nothing paints and the
poster is simply still there. `useReducedMotion()` skips the canvas entirely (the hero's whole motion is the sky's drift,
so there is nothing left to honour). The `ObservedErrorBoundary` around it catches a render-time throw only, renders
nothing of its own, and carries **no** `resetKeys`: retrying WebGPU behind a marketing headline buys nothing.

**The two rasters** (`landing-hero.png` 1600×900, `landing-og.png` 1200×630) are committed and were generated
procedurally rather than designed: the active skin's bare-night base `#0a0a12`, lit by the same illustrative mood weights
the hero's ramp uses, with the latent field as faint seeded points. Deterministic, so a regeneration reproduces the same
bytes. A designed OG card is a later call, not a blocker.

## 3. Authored content, and what it may not carry

`config/theory-cards.ts` holds the five research strands and the five tour items, both fixed-length tuples with
`satisfies`. A `LandingTheoryCard` is `{ id, title, body, blogAnchor }` and has **no citation field**: a DOI cannot be a
rendered datum, so an over-claiming citation could only arrive as prose — which §5 rejects. The landing carries the
summary a non-specialist reads; papers live one tier down on the blog.

The five ids are the same strings the blog owns as its closed `pillar` enum and emits as group-heading ids —
`engram` · `spatial-representation` · `synapse-time` · `reconstructive-recall` · `forgetting-accessibility`. They are
duplicated across a build boundary rather than shared, so `model/sections.test.ts` pins this side and an unknown pillar
fails the blog's own build from the other.

Both blog links are **plain anchors with an absolute path**, never router `Link`s: `/blog/` is Worker-served static HTML
outside this router, and a client navigation would land in the SPA fallback.

`config/illustration.ts` holds the invented moods and revisit weights the hero ramp and the mirror swatches share.
Presentation content like a theme table — there is no right answer to converge on, so it is not a tuning value. The
mirror's two swatch rows are labelled as illustration on screen and are `aria-hidden` (the labelled text above each row
already says everything the colours do).

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

`pages/landing` is inside the public-page import closure — a second, narrower block beside the demo's in
`apps/web/eslint.config.js`. Banned: `@connectrpc/*`, `@cosimosi/api-client`, `@cosimosi/client-cache`, every
server-backed `/react` read mirror, and `@cosimosi/demo`. Read it as a **closure, not an allowlist**: every function that
issues an RPC takes an `ApiTransport` first, and every hook that hides one calls `useTransport()`, so a page starved of
both cannot call the server whatever barrel export drifts into scope later.

Narrower than the demo's block on purpose. The landing is not rule-exempt — no sandbox, no free time travel — so it needs
no ban on prices, balances or the `AccountService` colour writes; it simply never reaches for them. What it does need is
the transport ban, because the one thing the front door must be unable to do is read somebody's universe. The three/R3F
and i18n bans are restated inside the block: ESLint flat config replaces rule options per matching file rather than
merging them.

## 7. The origin's SEO root

The origin root belongs to the app, not to the blog served beneath it.

- **`public/robots.txt`** — indexable `/` and `/demo`; disallows `/universe`, `/diary`, `/me`, `/admin`, `/login`,
  `/signup`, `/invite/`, `/test`, `/design`. The SPA answers all of them with the same `index.html`, so without those
  lines a crawler indexes landing content under half a dozen wrong URLs. Two `Sitemap:` lines — the root one and
  `/blog/sitemap.xml`, which the blog depends on being named here.
- **`public/sitemap.xml`** — a plain urlset for `/` and `/demo` in the canonical slashless form.
- **`index.html`** — title, description, absolute canonical, `theme-color`, OG/Twitter tags over `landing-og.png`, and a
  `<noscript>` block carrying the hero line, the mirror definition and a link to `/blog/`. The origin literal is
  `https://cosimosi.haeram.me`, with [DEPLOY.md](../../DEPLOY.md) §1 named in a comment as its SSOT — an address, not a
  tuning number. `lang="en"` is the shell default; the i18n provider corrects it once resolved.
- **`/blog/` is a live destination this unit does not serve.** Six links (five theory cards plus the blog line) point at
  `/blog/`, and until plan 82 ships they resolve to the SPA's not-found screen. That is the build order the plans chose —
  81 owns the origin root and the `Sitemap:` line 82 depends on, so it lands first — but it is a real user-visible state
  in the window between them, not a subtlety. The `/blog/sitemap.xml` line is likewise a forward reference.
- **The root canonical applies to every URL**, because a client-rendered SPA serves one shell. That is why the sitemap
  lists only `/`: listing `/demo` would ask a crawler to index a URL that then declares itself a duplicate of the root.
  `/demo` stays `Allow`ed so a shared link is never blocked, and it has no crawlable content of its own regardless.
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
the design tokens. The seven section ids, five tour ids and five theory ids are array content whose counts are fixed by
the PRD; every string of copy is i18n content; the origin and every path are addresses; the OG raster's 1200×630 is a
fixed external platform spec; and the copy-honesty patterns are a rule set, not a knob.
