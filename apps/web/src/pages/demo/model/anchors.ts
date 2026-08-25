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
  /** The read affordance inside that card — beat 1's own press, and so where beat 1's ring goes.
   *  Separate from `diary-card` because the two answer different questions: the card is the region
   *  the beat lights up to be READ, and this is the one control in it that moves the run on. A ring
   *  around the whole card points at a paragraph and lands its corner on the sheet's close. */
  | 'diary-read-action'
  | 'write-action'
  | 'split-action'
  | 'launch-action'
  | 'time-day-action'
  | 'time-week-action'
  | 'time-month-action'
  | 'recall-action'
  /** The two controls of the recall walk that press opens — send the sentence back, then come out
   *  to the changed universe. They exist for the RING alone, the mirror of the gate-only members
   *  above: the walk is a modal surface with a scrim, so there is nothing beside them to gate, and
   *  listing them for the mask would shrink its hole to one button and cover the words the beat is
   *  asking to be read. */
  | 'recall-confirm-action'
  | 'recall-dismiss-action'
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
