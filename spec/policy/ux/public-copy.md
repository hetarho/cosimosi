# policy/ux: public copy

> The rules every sentence on a public surface obeys — the landing page, the demo, the blog, and the app-store listing.
> Plans [81](../../plan/81.landing-page.md) and [82](../../plan/82.blog-site.md) own it between them — 81 the landing's
> half, 82 the blog's — and `scripts/lint-public-copy.mjs` mechanizes it over the blog's essays. Reinforces [I12][K1][K2][K3][M5]; introduces no new invariant.

## Rule

cosimosi is unusually easy to overclaim. It is built on memory research, it moves, and it looks like a brain if you
squint — so the temptation is not to lie, it is to let a reader draw a conclusion nobody wrote. Public copy is written to
foreclose that: **inspired by engram theory**, never a model of anyone's brain, and never a claim about anyone's health.

## Must Hold

### The five forbidden claim classes

No public sentence may:

1. **claim brain equivalence** — that the product works like, or the same as, a brain;
2. **claim a therapeutic or clinical effect** — treatment, healing, efficacy, therapy, a cure, anything "clinically"
   anything;
3. **present the 3D coordinates as the brain's real coordinates.** They are emergent visualization: positions come out of
   the force simulation and change every frame;
4. **describe a mechanic the product does not have.** The three that keep suggesting themselves: emotion driving a
   position or a link's strength (emotion colours a memory, it does not place one), memories attracting one another
   (they hang from shared neurons, not from each other), and radius meaning recency;
5. **carry an academic citation outside the blog** — no DOI, no "et al.", no parenthesized author-year.

The framing that replaces them is fixed and positive: the product is **inspired by** memory research, and the 3D layout is
a visualization that emerges from shared neurons and synapse strength.

**A denial is not a claim.** "It is a diary, not a model of anyone's brain" is a sentence this policy wants on the page.
Guards over public copy are written to allow it — see [tech/landing-page.md](../../tech/landing-page.md) §5 — because a
rule that punished the disclaimer would push the copy into saying nothing at all, and quiet is not the same as honest.

### Two theory tiers, never mixed

- **Tier one, the product surfaces:** the lay summary a non-specialist reads. Five strands, one paragraph each, no
  citations. §1.5's promise is that neuroscience knowledge is never required of a user, and a landing page with a citation
  list is a landing page that will eventually cite something the product does not implement.
- **Tier two, the blog:** the papers, the DOIs, and what was and was not taken from them. **At least one cited source per
  post**, enforced by the collection schema rather than by review — a post that explains the science cannot ship uncited,
  and the DOIs it declares are what its machine-readable citations are built from.

The tiers share the five strand ids so a reader can cross from one to the other, and nothing else.

### Say what the product does NOT do

The blog's job is not only to be accurate about what was built; it is to be explicit about what was not. Where research
describes a phenomenon the product deliberately does not simulate, the post **says so** rather than leaving the reader to
assume. Mood-congruent recall is the worked example: the research is real, the product does not act on the reader's
current mood, and the post states that plainly. Silence on the point would read as a quiet yes.

That is also why the guards over public copy exempt denials. A rule that flagged "감정은 별의 자리를 정하지 않습니다"
would push the copy into saying nothing at all — quieter, but not more honest.

### Posts are not localized

A post's `lang` is the whole of its per-language story. A translation is a **separate post** with its own slug and its own
`lang`, never a localized variant of the same file: these are authored essays, and one file carrying two languages is how
a half-translated post ships.

### No repository-internal path in public copy

A public sentence never links a path inside the repo. It is not a URL a reader can open, and on the deployed origin a
relative one resolves against the app instead. Where the requirement↔evidence mapping needs naming, name it in prose.

### The landing page's information architecture

Six sections, in this order: the hero, **the guided walkthrough**, a demo invitation, the five theory cards, the blog
link, and the closing CTA pair. The walkthrough absorbed the old feature tour and the standalone [M5] mirror section
(change 09): instead of reading five cards and a definition, the visitor steps one authored diary through the product's
whole arc — split, launch, the sky taking colour, the fade, the recall, the mirror — on one canvas.

- **The [M5] definition is required copy with a structural guard**: the universe's colour is a mirror of the emotions
  you return to, not their average. Its home is the walkthrough's **final step**, pinned by a fixed six-member step
  tuple exactly as the section order is pinned — a user who leaves believing otherwise will read their own universe
  wrong for months.
- **The walkthrough is hardcoded and advance-only** — an authored diary in both languages, precomputed split,
  deterministic visuals through the shipped production functions, and two sentences per step (what is about to happen,
  then what happened) walked with back/next. A step names no verb of its own: the visitor is reading a story, not
  operating an app, and a caption that told them to press "별 쪼개기" would name a button the screen does not have.
  Anyone who wants to steer is one click from the demo.
- **A demo CTA appears at the top and again at the foot**, and in the closing block the demo comes **before** the signup
  ask. A stranger has no reason to trust a form yet, and the product's whole claim is that it only reads in motion.
- **No meta-disclaimer.** The page carries no "nothing is saved" / "this is an invented example" hedge: a marketing
  page is self-evidently a marketing page, and nobody mistakes its example for their data. [I12] honesty is untouched —
  it forbids overclaiming, not confidence; the five claim classes and the denial allowlist stay the gate.

### One origin

Public surfaces live on the product origin. The blog is a **subpath** of it, never a subdomain and never a second domain:
a subdomain would split the domain's authority in two and make every landing↔post link cross-origin. No doc names an
origin other than the deployed one, whose SSOT is [DEPLOY.md](../../../DEPLOY.md) §1. The origin root's `robots.txt` and
`sitemap.xml` belong to the app, not to the blog served beneath it — the blog ships neither, and publishes only its own
`/blog/sitemap.xml`.

### Store-listing copy

The app-store description stands in for a native marketing route, and is written under the same five rules. The approved
text:

> **cosimosi — a diary you can look up at**
>
> Write down a day and it rises as a small light. Entries that share a person, a place or an idea hang from the same
> point, and a shape appears that nobody drew.
>
> What you never return to grows faint and begins to lose its words. Return to it and it brightens — and comes back a
> little changed, the way remembering actually works. Your original entry is always kept.
>
> The sky settles into the feelings you keep coming back to, so a year has a colour you can see at a glance. It is a
> mirror of what you return to, not an average of everything you felt.
>
> Inspired by memory research. It is a diary, not a model of anyone's brain, and it makes no claim about your health.

Any revision to that text is a public-copy change and is reviewed against the five classes above before it ships.

## Copy Implication

Plain, unhurried, second person. No exclamation, no decorative emoji, no translation-ese — an invitation, not a sales
line. Every rendered string resolves through the i18n seam in both catalogues, so a sentence is reviewed once as public
copy rather than once per surface.
