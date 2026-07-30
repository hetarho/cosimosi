# policy/ux: sequence

> UX policy for the guided-step engine both the public demo and the post-signup onboarding tour run on.
> Plan [78](../../plan/78.sequence-engine.md) owns the implementation. Exposure policy — when a tour is
> offered and how a replay is reached — is [80.onboarding-tour](../../plan/80.onboarding-tour.md)'s, not
> this doc's. Reinforces [O1][O2][O4][O5]; introduces no new invariant.

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

## Copy Implication

Plain and unhurried — an instruction, not a sales line. No decorative emoji, no translation-ese. Every
sentence a run puts on screen resolves through the i18n seam, so it is reviewed as public copy once
rather than per host: the universe may be described as _inspired by_ engram theory, never as working
like a brain, the 3D positions are never called the brain's real coordinates, and no therapeutic claim
is made.
