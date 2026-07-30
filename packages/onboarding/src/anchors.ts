/**
 * The two host-owned unions `SequenceStep` is generic over — and the whole safety argument of this
 * package.
 *
 * The same engine runs the public sandbox and this tour, but the tour runs over a REAL signed-in
 * account where nothing is exempt. So the tour's vocabulary is closed: five controls it may point at,
 * three things it may wait for, and a step naming anything outside those eight strings is a compile
 * error. What the unions OMIT is the design, and each omission answers a plausible, well-meant
 * shortcut:
 *
 * - **no recall anchor or signal** — a step waiting on a paid reconsolidation would spend the user's
 *   stardust on their first minute. Recall is named at step 8 and never performed.
 * - **no 놓아주기 / delete anchor** — a tutorial that destroys a memory to demonstrate deletion.
 * - **no clock or sync anchor/signal** — a step that moves universe time so dimming becomes visible.
 *   The only clock advance during a tour is the real one inside a launch.
 * - **no palette / ornament anchor** — a step that changes a render parameter for effect.
 * - **no anchor for a rendered memory** — its screen position comes out of the force sim and changes
 *   every frame, so there is no composition site to register and no rect to measure. Anchors are static
 *   ids on layout containers, which is exactly why the tour cannot address a domain object.
 * - **no anchor inside a `features/*` slice** — every id below belongs to a composition site (a page
 *   or a widget), so no shipped product slice learns that a tour exists.
 *
 * A union is checked by the compiler on every script edit; a review rule is not.
 */
export type OnboardingAnchor =
  /** pages/universe: the 일기 쓰기 affordance. */
  | 'universe-write-entry'
  /** widgets/writing-flow: body + date + 별 쪼개기. */
  | 'writing-draft'
  /** widgets/writing-flow: the proposed-memory list. */
  | 'writing-proposal'
  /** widgets/writing-flow: 별 띄우기. */
  | 'writing-confirm'
  /** pages/universe: the universe-time HUD. */
  | 'universe-clock'

/** The three things the shipped writing flow already tells the world it did. */
export type OnboardingSignal = 'writing-flow-opened' | 'split-succeeded' | 'launch-succeeded'
