# tech: blog site

> As-built record of the blog — an Astro static site served at `/blog/` from the app's own origin. Plan
> [82](../plan/82.blog-site.md) owns it. The copy rules are [policy/ux/public-copy.md](../policy/ux/public-copy.md); the
> origin root it sits beneath is [landing-page.md](landing-page.md) §7. Web only, by a stated waiver (§8).

## 1. Two builds, one origin, one asset directory

`pnpm build:site` is the single deploy command, and its **order is load-bearing**:

```
pnpm build:blog      →  apps/blog/dist
pnpm build:web       →  apps/web/dist          (Vite EMPTIES this directory)
node scripts/stage-blog.mjs  →  apps/web/dist/blog
```

Staging before the web build would be silently erased — Vite empties `outDir`, and the deploy would go out with
`/blog/**` missing and nothing in the build log complaining. That is why staging is a script rather than a `cp` in a
script chain: it **fails loudly** when `apps/web/dist` is absent (the ordering mistake) and again when the staged tree
lacks `blog/index.html` or `blog/_astro/` afterwards. The ordering bug is a build error instead of a production 404.

`wrangler.jsonc` changed in exactly one way: `assets.html_handling` is now declared (`"auto-trailing-slash"`) so directory
index resolution is pinned rather than inherited, and both `/blog` and `/blog/` resolve to `blog/index.html`.
`assets.directory` and `assets.not_found_handling` are untouched — there is still **one** Worker, one asset directory and
no zone route. A second Worker and a `blog.` subdomain were both rejected: the subdomain would split the domain's
authority and make every landing↔post link cross-origin.

## 2. Living under a subpath

`base: '/blog'` plus `trailingSlash: 'always'` plus `build.format: 'directory'`. Without `base`, every page requests its
own `_astro/*.css` from the origin root, where the app's SPA answers with its not-found screen.

**`base` rewrites nothing in an authored href string**, which is the trap. So every internal URL derives from
`import.meta.env.BASE_URL` through `src/site.ts` — `path()` for an internal href, `absolute()` for anything a crawler or a
feed reader consumes. A literal `/rss.xml` in a template would keep pointing at the origin root and keep working in dev,
which is the worst kind of wrong.

`build.inlineStylesheets: 'never'` is set deliberately. Astro inlines a small stylesheet by default, and with everything
inlined there is no `_astro/*` request left — so `base` is never exercised and the staging assertion has nothing to
assert. Emitting the file makes the guard real, and one cacheable stylesheet beats the same 6 KB duplicated into ten
pages.

The blog emits **no** `robots.txt` and **no** `favicon.svg`: both are origin-root paths the app owns. The blog references
`/favicon.svg` directly — same origin, so it resolves — and publishes only its own `/blog/sitemap.xml`, which the root
`robots.txt` names alongside its own.

## 3. One post is one file, and the schema is the gate

`src/content.config.ts` defines the `posts` collection, and every required field is required because its absence is a way
to ship something the honesty rules forbid:

| Field         | Why it is required                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `title`       | —                                                                                                |
| `description` | authored, never truncated from the body, so a share card is written rather than guessed          |
| `pubDate`     | —                                                                                                |
| `lang`        | `'ko' \| 'en'`; the whole per-language story (§4)                                                |
| `pillar`      | one of the closed five; the landing's theory cards resolve against it, so a typo fails the build |
| `sources`     | `{ label, doi }[]` with **min 1** — a post explaining the science cannot ship uncited            |

`draft` defaults to false and is the only publication switch: it excludes a post from the index, `/blog/rss.xml`,
`/blog/sitemap.xml` and its own route at once, so the four surfaces cannot disagree about what is published.

The **pillar enum** is `engram` · `spatial-representation` · `synapse-time` · `reconstructive-recall` ·
`forgetting-accessibility`. The index emits one `id="<pillar>"` group heading per non-empty group, which is what makes the
landing page's five `/blog/#<pillar>` anchors resolve. The two sides are duplicated across a build boundary rather than
shared: the landing pins its half with a unit test, and an unknown pillar fails this build from the other side.

Slugs are the filename, English kebab-case, while the prose stays Korean — a URL is code. Each post's foot carries its
citations, up to two same-pillar posts, and one CTA pair (`/demo` then `/`), in the same order the landing uses and for
the same reason.

## 4. `<head>` and the feed

`PostLayout` gives every post an absolute canonical at `/blog/<slug>/`, OG/Twitter tags over the committed raster
`og-blog.png` (1200×630 — the SVG it replaced is not rendered by the major social crawlers, so shares showed nothing), an
RSS `alternate` link, and `BlogPosting` JSON-LD whose `citation` entries are built from `sources[]`. One source of truth,
two audiences: the DOIs the schema requires are visible below the essay and machine-readable above it.

The feed is hand-rolled. A dependency to emit thirty lines of XML is not earned, and RSS 2.0 has not moved.

## 5. The `/blog/**` miss

`apps/web/src/pages/blog-not-found` on a public splat route `/blog/$` under `rootRoute` — outside the authenticated
subtree, with no `beforeLoad`: a stale link to an essay must not ask anyone to sign in or depend on the diagnostics flag.
It can never shadow a real post, because the asset handler resolves static files first and the SPA only executes on a
genuine miss. Its three strings go through the i18n seam (`blog_not_found_*`), which `lint:raw-strings` requires. Back to
`/blog/` goes through `window.location`, not the router: `/blog/` is outside it, and a client navigation would land right
back here.

**The honest limitation:** `not_found_handling: "single-page-application"` answers a miss with HTTP **200**, so this is a
soft 404. A true status code would need a Worker _script_ in front of the assets, which the one-Worker arrangement rules
out. The mitigations are `noindex` on this page and a sitemap that lists only real non-draft URLs.

## 6. The copy gate

`scripts/lint-public-copy.mjs` runs inside `pnpm lint` and fails on six claim classes: brain equivalence, a therapeutic or
clinical claim, coordinates as the brain's real coordinates, and the three mechanics families (emotion→position/link,
memory↔memory attraction, radius-as-recency-or-emotion). Its **roots are data** — `apps/blog/src/content` today, and the
landing's message catalogue can join later without re-deciding anything. A `--probe` mode is wired into `test:guards`: it
asserts every class fires on its own deliberate offender **and** that none of them touches the sentences the policy wants
on the page.

That second half is the part that took a correction. The first version flagged every denial, including
"기억끼리 서로를 끌어당기지 않습니다" — which is exactly the sentence the rule exists to produce. A match now counts only
when the clause it starts is **not** negated, and the negation window is deliberately **after** the match rather than
anywhere in the sentence: Korean negation is post-verbal, so a tail check catches every honest denial while leaving no room
for the trick a whole-sentence check has (an English-style "Not just a diary — it works like your brain" puts the negation
before the claim). English posts would need their own handling rather than a widened window.

It is a new script rather than an extension of the ubiquitous-language lint on purpose: that gate has another owner in this
sprint, and two plans editing one script is the collision the single-owner rule prevents.

## 7. The nine essays, and the two corrections

The nine `##` sections of the retired `src/blog.md` are now nine posts. The old "Description(작성자·심화 학습용)" block
split in two: the paper list became structured `sources[]` rendered as a citations section, and the "LLM에 물어보기"
prompts stayed body content.

Two rewrites were **conditions of publication**, not follow-ups, because the shipped essays described mechanics the code
does not have:

- **The emotion post** claimed that emotionally-close stars are bound more tightly, that similar-emotion memories attract
  one another, and that intense memories stay _closer_ to the centre. All three are forbidden. It now separates what
  emotion does (valence → colour; arousal → strength and forgetting rate) from what it does not (it does not place a
  memory, does not form or strengthen a link, and memories do not pull on each other — they hang from shared points), and
  then names mood-congruent recall as a phenomenon the product deliberately does **not** simulate. Saying so is the point:
  silence would read as a quiet yes.
- **The forgetting post** said a star sits near the centre when it is often recalled, emotionally deep and well connected.
  Emotional depth does not enter it: the radius is connectivity — self-relevance — and never emotion, never recency.

The footer's `spec/tech/neuroscience.md` link is gone: the file does not exist, a relative href would resolve against the
app origin, and a repository path is not something a reader can open. It names the product plan's neuroscience section in
prose instead.

## 8. Parity waiver

Web only. A native app has no long-form-article route, and Astro has no React Native analogue. Stated in full here because
`scripts/lint-fsd-layout.mjs` does **not** enforce web↔mobile page peering, so an unstated waiver would be silently broken
rather than caught; it follows the admin-console precedent (`spec/policy/ops/admin.md` §6). The `/blog/$` splat is
web-only for the same reason and one more: it repairs a URL, and a native app has none.

## 9. No values key, and no `@cosimosi/*` dependency

`apps/blog` depends on `astro` and nothing else — no transport client, no Supabase client, no domain logic, no shared
package — and defines no pure function, so it carries no golden-parity obligation and cannot drift from the domain because
it never touches it. Its build constants (the feed limit, the related-post limit) are named module constants with a comment
each: they are content-shaping numbers in an app outside the values pipeline, and the values groups are closed.

One asymmetry worth naming rather than relying on silently: `.astro` files have **no Prettier parser** in this repo, so
`format:check` does not cover them. Markdown content is covered.
