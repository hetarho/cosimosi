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
- **Entry randomness is set-granular; play draws per diary.** Three diaries are designed **together** as a
  `DemoDiarySet` and one set is drawn per entry: the beat where memories pull into one cluster needs a neuron
  activated from more than one diary, and independently drawn diaries would share none ([Z4][I4]). Only _which set_
  varies between runs. **Inside** a run, the writing control draws one prepared diary at a time from the drawn set's
  pool — the tutorial triple first, then the free-play extras, cycling without back-to-back repetition — so free play
  can keep writing as deep as the pool is ([Z4] as amended by change 10).
- **Every set sustains the tutorial AND the room after it.** A set is only shippable if it carries a proven
  cross-diary shared neuron in its tutorial triple, a day-offset spread wide enough that time acceleration puts its
  memories at different forgetting stages, at least three distinct moods among the memories on screen at the colour
  beat, and a recall target that is on screen by the recall beat (in the first two diaries) with a mood that is
  **not** their strength-weighted dominant one — otherwise the colour beat ramps the sky to the colour it already had
  and the product's honest promise ([M4][M5]) goes undemonstrated. Beyond the triple, each set ships **extra
  diaries** for free play, every one attached to the cluster through at least one tutorial neuron, with complete
  splits in every locale and word-loss ladders that are byte-identical `decayStageText` outputs. All of this is gated
  by the fixture-integrity suite, not by watching the demo.
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
  placeholder. The fixture carries no ornament data at all: the decorating surface reads the client's own
  ornament-name map, which knows no price ([Z8]).
- **Nothing carries over.** No fixture, and nothing derived from one, is written anywhere durable ([Z7]).

## Must Hold — the page

- **The demo is a tutorial, then a playroom.** The tour starts on **every** entry and is skippable at
  every step; completing the last beat or pressing skip moves the run to free play **permanently**,
  where the visitor stays and plays — keeps writing, launching, traveling, recalling — for as long
  as they like. Nobody has to finish the tour to see the point, and nobody is asked to confirm
  leaving.
- **While the tutorial runs, the chrome is gated by one machine.** Only the control the current beat
  points at is interactive; every other control is unpressable **and** reads dimmed + blurred, so
  off-script actions are unrepresentable and the eye cannot confuse what to press. The availability
  derives from one explicit run state machine (tutorial step ↔ free play) and from nothing else.
  The skip affordance lives above the gate and stays fully visible and interactive throughout
  ([O4]). The covering is **one mask layer over the whole page** — heavily dimmed and lightly
  blurred, with a single hole cut where the current beat's controls live — never a page of
  individually faded widgets; the sequence chrome (ring, caption, skip) paints above the mask, and
  a beat that opens nothing to press (the sky taking its colour) plays unmasked, because there the
  scene itself is the show. **The mask yields to the scene's own moments**: while a launch's awaken
  or a time sweep plays, the whole layer lifts (fades out, without unmounting) and returns a short
  linger after the presentation ends — a memory going up is never watched through the covering.
  The next beat's caption and ring hold back through the lift and arrive **together with the
  covering's return**, so the scene speaks first and the guidance second; the skip never blinks
  out. Pressability never rides the lift. **Guidance never sits on the surface it describes, and
  where the free room is depends on the screen.** On a desktop the interrupting surfaces are centred
  modals, so the line takes the **bottom band** — the edge they leave free — for every step. On a
  phone they are bottom sheets, so the line floats **just above the middle** at readable size,
  clear of the sheet and still in the eyeline; a step staged inside an open surface glues its line
  to the highlighted control itself (just below it, or just above near the bottom edge), and a
  surface the beat merely stands in — the catalog, a recall walk, a diary being read — pins it to
  the top band. A beat whose work is a flow rather than one press moves the
  ring with the visitor — 쪼개기, then 띄우기 for the second diary's walk; the 꾸미기 control, then a
  catalog row for the decorating beat — instead of staying parked on a button already pressed. Where
  the last leg of a beat is a control the shared primitives own (a sheet's own close), the ring
  stands down and the caption carries that leg alone; the caption is the run's one guaranteed
  channel. **The camera is free play's**: drag/zoom navigation stays unmounted while the tour runs,
  so the ring and the hole always point at the scene the caption is describing.
  **The screen the demo teaches is the screen the product ships.** The HUD is the home screen's own
  arrangement — the universe's time centred over the sky as bare type, the ways out of the canvas as a
  borderless icon column against the right edge, 일기 쓰기 alone at the bottom in the outlined form
  that keeps the sky visible through it — and a star is read by picking it, which opens the star's
  panel in the product's shapes (the star rendered in its own frame, what is known about it, the
  current words with the forgetting smeared in), with 회고하기 standing in the open and 원본 일기
  보기 beside it. Recall walks the product's own three steps (the faded words, the sentence sent back,
  what came back). Where the demo diverges it is because the sandbox cannot honestly carry the
  product's thing: no balance ([Z8]), no archive route (a star's diary opens from the star), and
  the time controls, which no signed-in screen has, sit under the clock they move.
  **The signup CTA sits outside the tour entirely**: parked top-right under the skip's corner,
  never highlighted, never gated, never a beat's anchor. The closing beat points at nothing — its
  caption is a valediction over a room that is already fully open and simply names the corner, so
  the tour never funnels the visitor out; they leave when they feel like it. In free play
  everything is open and no tutorial chrome lingers. A **start-over control** sits beside the CTA,
  equally outside the tour: it restarts the whole run — a fresh draw, the tour from its first beat
  — through the same path an arrival takes, so nothing a reset produces can differ from a reload.
- **Semanticization is earned with pushed time only.** A launch moves the clock to the diary's date
  (the server's rule), but every gist timer rides that jump — writing a diary never makes a gist
  body pop; only the time controls (and the passage they present) run the semantic stages. A star
  or gist body picked on the canvas opens that star's panel — the one way in, as in the product.
- **Free play is real play, in the product's shapes.** The writing control draws a prepared diary
  and walks it through the product writing flow's OWN chrome — the same field labels, the same
  별 쪼개기 → proposal rows → 별 띄우기 walk, rendered read-only from the fixture (a demo that
  invents a second writing look teaches a product that does not exist) — repeatable as deep as the
  pool. A launch closes the dialog before the memory goes up, so the birth always plays on an
  unobstructed sky. Forgetting, per-star
  recall and semanticization are all experienceable, repeatedly, in any order; a picked star shows
  its eroded current words, and its own diary opens verbatim from there.
- **Time travel is free, unmetered and three-grained.** Three controls — +1일 · +1주 · +1달 — push
  the universe forward (month length is the one tuned scalar, `values.yaml` `demo`), presented the
  way the product presents universe time passing: the displayed clock sweeps forward and the stars
  dim in front of the viewer, never a bare date-string swap. There is no monotonicity check, no
  launch precondition, no sync-consent step, no ceiling and no cost. That exemption exists only on
  this page, and only because the demo passes its own date down as the universe time the render
  layers already accept — no shared code has a bypass to offer. The one-nudge "시간 밀기" control
  and the batch "일기 두 편 더" control are retired.
- **Recall is per star and repeatable, and walks the product's steps.** From the star's panel, 회고하기
  shows the words as they are now, the sentence that goes back (prepared by the fixture, read-only —
  the demo's re-readings are decided before the visitor arrives, and a box whose contents were
  discarded would be a lie) and then what came back. Each 회고 re-brightens that star, bumps its
  recall count, reshapes its seed and restores its words — free, with no quote, no consent step and
  no balance rendered, and the reshaped star is seen on an uncovered sky before the next beat
  speaks. Each memory's gist
  timer runs on the demo clock, so long-unrecalled memories climb the semantic stages per memory,
  not on one scripted id.
- **No currency, price, cost, quote, purchase, achievement or payment surface appears.** "Unlimited
  stardust" is discharged by **absence**, not by a large number: a balance on a page that never
  charges anything is noise at best and a payment smell at worst. The absence is structural — the
  demo cannot reach a price table, a spend gate or the save flow at all.
- **Decorating is the product's own panel, with the money removed.** The 꾸미기 control opens the
  decoration panel's shapes — the same groups, the same full catalog of names, apply-on-select
  against the live universe — showing no price, no ownership, no save; a selection simply holds,
  and a `기본` row per group is the way back. It changes the sky, the shape a memory takes and the
  colour a feeling gets — and touches no memory's position, size, brightness, emotion or seed.
  Bloom and the camera stay what they always are. **The decorating beat is the whole round trip**:
  open the panel, try something on, come back out to a changed universe — so the ring walks in with
  the visitor, the way out stays inert until something has actually been tried on, and the beat ends
  on the return, where the change is seen. Nothing is decorated on the visitor's behalf.
- **The visitor acts; the tour points and waits.** Every beat advances because someone pressed the
  real control. Nothing is performed on their behalf. The tour may still put a surface in front of
  them — the opening diary arrives already open, and the recall beat arrives with its own star
  picked, because which star it is about is the scenario's and hunting for it among look-alikes is a
  search task no caption can help with. What is never done for them is the beat's own work.
- **Nothing survives leaving.** The read models, the clock, the awaken registry and the palette are all
  cleared on the way out, and nothing was ever written to storage, a URL or a server — so a visitor
  who signs up afterwards starts from a genuinely empty universe.
- **Honesty lives in the copy review, not in a standing banner.** The demo carries NO always-on
  theory note: every sentence a visitor can read is `demo_*` catalogue copy reviewed against [I12],
  and none of it may let the one forbidden conclusion form — that they are looking at a brain. The
  inspired-by framing and its denial belong to the landing page, where a reader is actually
  weighing the claim.

## Copy Implication

The voice is the diarist's, not the product's: these read as entries someone actually wrote, restrained and specific,
with no decorative emoji. A caption may say the universe is _inspired by_ engram theory; it may not say the app works
like a brain, may not describe the 3D positions as the brain's real coordinates, and may make no therapeutic claim
([I12]). There is no standing theory note on the page — the inspired-by framing and its denial are the landing
page's to make; a banner repeated on every demo frame read as crediting rather than disclaiming.
