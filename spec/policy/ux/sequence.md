# policy/ux: sequence

> UX policy for the guided-step engine both the public demo and the post-signup onboarding tour run on.
> Plan [78](../../plan/78.sequence-engine.md) owns the implementation; the tour's own conduct is the
> `## Onboarding` section below, from [80.onboarding-tour](../../plan/80.onboarding-tour.md).
> Reinforces [O1][O2][O4][O5]; introduces no new invariant.

## Rule

cosimosi's core loop only reads in motion: a screenshot cannot show that a diary splits into stars,
that neurons get reused, that unrecalled memories dim and lose words. So the product teaches itself
**on the real screen** — highlight the control, put one line at the bottom, and let the person press
it. Not video. Not a carousel.

## Must Hold

- **Guidance happens on the real screen.** The controls a step points at are the shipped ones, doing
  the real thing. There is no rehearsal mode and no simulated tap.
- **The engine points and waits — it never acts for the user.** A step cannot carry an action, because
  the step model has no field for one. This is what lets the same engine run over a real signed-in
  account without relaxing anything: during a tour, universe time is still monotonic, a diary is still
  immutable, the meaning layer is untouched and a recall still costs Twinkle, purely because every
  state change is the user pressing the real control.
- **One caption at a time, bottom center.** It relocates to the top band only to get out of the way of
  the control it is describing — never for variety. It is a polite live region, so a step change is
  announced without stealing the reader's place.
- **The caption is the guaranteed channel; the highlight is an enhancement.** An anchor that cannot be
  resolved leaves the ring out and changes nothing else: no timeout, no retry, no error surface, and
  the run stays completable.
- **Skip is always visible and never confirmed.** Every step shows it, no step can opt out, and one
  press ends the run. There is no "are you sure?" — a replay makes a mis-skip cheap, and a
  confirmation on a tutorial is one more thing to dismiss.
- **The chrome is non-modal.** Nothing is blocked, nothing is disabled, focus is never trapped, and the
  ring cannot be pressed. Controls the current step does not name stay fully operable, and a mis-tap is
  simply not progress rather than a refused interaction.
- **Motion is optional.** The ring's pulse collapses to a static ring under reduced motion. The pulse
  draws the eye; the ring is what says "here", so removing the motion removes nothing the run depends
  on.
- **A replay is a fresh run, and nothing carries over.** Starting again is valid from any state
  including a finished one, requires no teardown, and leaves no residue from the previous pass. The
  engine records nothing durable about a run — no history, no "already seen" flag.
- **Progress is quiet.** A `current / total` readout answers "how much longer" without turning
  guidance into a task list.

## Onboarding

The tour is the same engine over a real signed-in account, so everything above still holds and these are
the rules that only a live account needs.

- **It runs once, at the moment signup completes, and thereafter only on an explicit replay** from
  `/me`'s profile tab ([O3][O5]). Entering the universe on any later session starts nothing. There is no
  "already seen" record on the server or the client to be wrong about: `SignUp` succeeds at most once per
  account, so "once, just after signup" is a property of the trigger rather than of a flag.
- **It is never re-offered, never nagged, and never confirmed before a skip** ([O4]). Finishing and
  skipping are deliberately indistinguishable in their after-state — nothing is recorded for either — and
  a mis-skip costs one tap in `/me` to undo.
- **It points and narrates; it never acts for the user.** No memory is seeded, no clock is moved, no
  stardust is spent, nothing is deleted. Every state change during a run is the user's own press through
  the shipped writing flow.
- **It highlights no paid or destructive control.** Recall is _named_ at the eighth step and not
  performed, because a recall costs stardust and requires consent and a first minute is the wrong place
  to spend either. The tour's vocabulary is a closed union with no member for a paid, destructive,
  decorative or clock-moving control, so such a step is a compile error rather than a review finding.
- **Every caption must be true for an empty first universe and for a replay over a full one**, which is
  why no caption quotes a value: they are zero-parameter accessors, so a memory's name, a count, a date
  or a balance cannot appear in one.
- **A failed split or launch produces no tour-owned error** — the caption simply holds. The tour hears
  the writing flow's real phase changes, never its intentions, so a request that resolves after the sheet
  closed moves nothing.
- **A user ahead of the caption is not wrong.** Several steps are reading time; pressing the highlighted
  control before one finishes holds the report until the step that waits for it arrives, rather than
  dropping it and leaving that step waiting forever for something that already happened.
- **Leaving the universe ends the run.** No outcome survives the screen, and nothing is left behind.

## Copy Implication

Plain and unhurried — an instruction, not a sales line. No decorative emoji, no translation-ese. Every
sentence a run puts on screen resolves through the i18n seam, so it is reviewed as public copy once
rather than per host: the universe may be described as _inspired by_ engram theory, never as working
like a brain, the 3D positions are never called the brain's real coordinates, and no therapeutic claim
is made. [I12]'s honesty rule applies to the tour too, although it runs behind auth.
