# policy/ux: demo

> UX policy for the signed-out demo — the trailer a visitor watches before deciding whether to open an account. Plan
> [77](../../plan/77.demo-fixtures-and-mirror.md) owns the shipped data this file's data rules describe; plan
> [79](../../plan/79.demo-page.md) owns the page and extends this doc with its page-facing section. Reinforces
> [Z1]–[Z8]; introduces no new invariant.

## Rule

The demo shows, in seconds, what the real product takes days to produce — a split, a launch, neuron reuse, forgetting,
recall, gist rise, the universe taking on a colour. It can only do that on content that was decided before the visitor
arrived, so **everything the demo shows ships in the bundle**. Nothing is generated, fetched, computed by a model, or
remembered afterwards.

## Must Hold — the data

- **Shipped, fixed and deterministic.** The same diary always yields the same memories, the same neurons and the same
  words. There is no generator, no PRNG and no clock in the demo's data package, so determinism is structural rather
  than reviewed ([Z5]).
- **Randomness is set-granular.** Three diaries are drawn **together** as a `DemoDiarySet`, never individually: the
  beat where memories pull into one cluster needs a neuron activated from more than one diary, and independently drawn
  diaries would share none ([Z4][I4]). Only _which set_ varies between runs.
- **Every set demonstrates all ten beats.** A set is only shippable if it carries a proven cross-diary shared neuron, a
  day-offset spread wide enough that time acceleration puts its memories at different forgetting stages, at least three
  distinct moods, and a recall target whose mood is **not** the set's strength-weighted dominant one — otherwise the
  colour beat ramps the sky to the colour it already had and the product's honest promise ([M4][M5]) goes
  undemonstrated. These are gated by a fixture-integrity suite, not by watching the demo.
- **Fixture text is public copy.** Diary bodies, memory names, gist texts and word-loss texts are reviewed against
  [I12] and the restrained literary voice, and are complete in **every** supported locale — a set that exists in one
  language only does not compile. It is content, so it does not enter the message catalogue; `demo_*` keys belong to
  the demo's captions and controls.
- **The demo never re-implements the product's math.** Brightness, strength, forgetting stage, word loss, gist stage and
  the colour blend all come from the same golden-pinned functions the real universe uses. A demo-only formula would be a
  demo-only _rule_, and the fixture deliberately has no field a second implementation could write its output into.
- **No coordinates.** Positions stay emergent from the force sim even inside a sandbox that is formally exempt from the
  invariants ([I5]).
- **No price, purchase, achievement or payment data exists in the demo's data** — not zero, not unlimited, not a
  placeholder. The ornament taste carries catalog ids and nothing else ([Z8]).
- **Nothing carries over.** No fixture, and nothing derived from one, is written anywhere durable ([Z7]).

## Copy Implication

The voice is the diarist's, not the product's: these read as entries someone actually wrote, restrained and specific,
with no decorative emoji. A caption may say the universe is _inspired by_ engram theory; it may not say the app works
like a brain, may not describe the 3D positions as the brain's real coordinates, and may make no therapeutic claim
([I12]).
