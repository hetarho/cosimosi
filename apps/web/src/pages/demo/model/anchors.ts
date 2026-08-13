// The two host-owned string-literal unions `SequenceStep` is generic over — and the namespace the
// run machine's gating derivation speaks. They name **only** the demo's own controls and the
// outcomes those controls produce, which buys two things: a typo in the scenario is a compile error,
// and a control the demo does not own has no member to name — so a step can never point at a
// product affordance this page never mounted, and the gate can never be asked about one either. A
// member no beat anchors (`entry-open-action`, the day and week jumps) exists for the gate alone:
// those controls open only in free play. The signup CTA has NO member on purpose: it is never
// highlighted and never gated — an exit, like skip, sits above the tour rather than inside it.
export type DemoAnchor =
  | 'diary-card'
  | 'write-action'
  | 'split-action'
  | 'launch-action'
  | 'time-day-action'
  | 'time-week-action'
  | 'time-month-action'
  | 'recall-action'
  | 'entry-open-action'
  | 'decorate-action'
  /** One catalog row inside the decoration sheet — where the decorating beat's ring goes once the
   *  sheet is open, so the highlight walks INTO the surface the press opened instead of staying on
   *  the button that opened it. */
  | 'ornament-row-action'

export type DemoSignal =
  | 'diary_read'
  | 'split_revealed'
  | 'launched'
  | 'time_advanced'
  | 'recalled'
  | 'gist_risen'
  | 'sky_filled'
  /** The decorating beat's whole arc is open → try something on → come back out, so what finishes it
   *  is the sheet CLOSING over a changed universe, not the first row pressed. */
  | 'decorate_closed'
