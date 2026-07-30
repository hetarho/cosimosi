import { and, assign, setup } from 'xstate'

/**
 * The run lifecycle: idle → running → completed | skipped | abandoned.
 *
 * Every terminal state accepts `START` again, which is what makes a replay a START rather than a
 * reset ritual — the caller needs no teardown, and nothing survives from the previous pass.
 *
 * Control state only (ARCHITECTURE §3.2): the script, the measured rects and the anchor registry all
 * live outside, so the context stays JSON-serializable and a snapshot cannot smuggle in a function,
 * a collection or a DOM handle. `stepCount` is supplied on START precisely so the machine can know
 * the last step WITHOUT holding the script.
 *
 * The machine never reads a clock. Dwell timing lives in the React seam, so this stays a pure
 * `(state, event) → state`.
 */
export type SequenceOutcome = 'completed' | 'skipped' | 'abandoned'

export interface SequenceRunSnapshot {
  /** Caller-supplied id for the current pass; distinguishes replays in tests and telemetry. */
  runId: string | null
  /** The only cursor — joined to the script by a pure selector. */
  stepIndex: number
  stepCount: number
  outcome: SequenceOutcome | null
}

export const initialSequenceRunSnapshot: SequenceRunSnapshot = {
  runId: null,
  stepIndex: 0,
  stepCount: 0,
  outcome: null,
}

export type SequenceRunEvent =
  | { type: 'START'; runId: string; stepCount: number }
  /** Echoes the index the caller observed, so a stale advance can be recognised and dropped. */
  | { type: 'ADVANCE'; fromStepIndex: number }
  | { type: 'SKIP' }
  | { type: 'ABANDON' }

export const sequenceRunMachine = setup({
  types: {
    context: {} as SequenceRunSnapshot,
    events: {} as SequenceRunEvent,
  },
  actions: {
    startRun: assign(({ event }) =>
      event.type === 'START'
        ? {
            runId: event.runId,
            stepIndex: 0,
            stepCount: Math.max(0, event.stepCount),
            outcome: null,
          }
        : {},
    ),
    nextStep: assign(({ context }) => ({ stepIndex: context.stepIndex + 1 })),
    finish: assign({ outcome: 'completed' as const }),
    skip: assign({ outcome: 'skipped' as const }),
    abandon: assign({ outcome: 'abandoned' as const }),
  },
  guards: {
    // A duplicate host signal, a double tap and a dwell timer left over from a superseded step all
    // arrive carrying an index that is no longer current. Rejecting them here rather than trusting
    // caller discipline is what keeps one press worth exactly one step.
    isCurrentStep: ({ context, event }) =>
      event.type === 'ADVANCE' && event.fromStepIndex === context.stepIndex,
    isLastStep: ({ context }) => context.stepIndex + 1 >= context.stepCount,
  },
}).createMachine({
  id: 'sequenceRun',
  context: initialSequenceRunSnapshot,
  initial: 'idle',
  states: {
    idle: {
      on: { START: { target: 'running', actions: 'startRun' } },
    },
    running: {
      on: {
        ADVANCE: [
          { target: 'completed', guard: and(['isCurrentStep', 'isLastStep']), actions: 'finish' },
          { guard: 'isCurrentStep', actions: 'nextStep' },
        ],
        // Unconditional, in every non-terminal state: the always-available skip is a transition
        // table, not a UI habit, and no step has a field with which to opt out.
        SKIP: { target: 'skipped', actions: 'skip' },
        ABANDON: { target: 'abandoned', actions: 'abandon' },
        START: { target: 'running', actions: 'startRun', reenter: true },
      },
    },
    completed: { on: { START: { target: 'running', actions: 'startRun' } } },
    skipped: { on: { START: { target: 'running', actions: 'startRun' } } },
    abandoned: { on: { START: { target: 'running', actions: 'startRun' } } },
  },
})
