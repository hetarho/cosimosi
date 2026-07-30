// A caption is an i18n ACCESSOR, not a string: every sentence a run puts on screen is public copy,
// and the accessor is what forces it through `packages/i18n` where the [I12] review happens once.
// Calling it at render time is also what makes a mid-run locale switch re-render the caption.
export type SequenceCaption = () => string

export type SequenceAdvance<Signal extends string> =
  /** Waits on the world — the user pressed the highlighted control, or a host animation finished. */
  | { readonly on: 'signal'; readonly signal: Signal }
  /** Waits on reading time only. Never use it to fake progress the user has not made. */
  | { readonly on: 'dwell' }

/**
 * One guided step: point at a control, say one line, and wait.
 *
 * `Anchor` and `Signal` are HOST-OWNED string-literal unions, so a typo in a script is a compile
 * error in the host while the engine stays host-agnostic. The engine never enumerates anchors and
 * never validates a script against the mounted tree.
 *
 * The omissions are the design, and each is permanent:
 *
 * - no `run`/`onEnter`/`action`/`effect` — the engine must never perform the step FOR the user.
 *   The same engine runs over a real signed-in account during onboarding, so a step that could act
 *   would be a live bypass of monotonic universe time, diary immutability, the untouched meaning
 *   layer and paid recall. Because there is no field, "the engine acted" is unrepresentable rather
 *   than merely forbidden.
 * - no `skippable`/`mandatory` — a step cannot opt out of the skip, because there is nothing to set.
 * - no string `caption` — that would be an unreviewed public sentence.
 * - no domain number (strength, brightness, days) — a script cannot smuggle in a formula.
 * - no data payload — the two feeds differ only in the injected script and data, so the step model
 *   knows about neither fixtures nor a live universe.
 * - no `isDemo`/`hostKind` — a sandbox branch in shared code is the one thing the isolation
 *   boundary exists to prevent.
 */
export interface SequenceStep<Anchor extends string, Signal extends string> {
  /** Stable across edits — tests and telemetry key on it. */
  readonly id: string
  readonly caption: SequenceCaption
  /** Absent means a narration-only step: the caption shows, nothing is highlighted. */
  readonly anchor?: Anchor
  readonly advance: SequenceAdvance<Signal>
}

export interface SequenceScript<Anchor extends string, Signal extends string> {
  readonly id: string
  readonly steps: readonly SequenceStep<Anchor, Signal>[]
}

// A type-narrowing identity helper. It performs NO validation on purpose: the interesting properties
// of a script are types (a mistyped anchor or signal is a compile error in the host), and a runtime
// check would only be able to restate what the compiler already refused.
export function defineScript<Anchor extends string, Signal extends string>(
  script: SequenceScript<Anchor, Signal>,
): SequenceScript<Anchor, Signal> {
  return script
}
