/**
 * @cosimosi/sequence — the one guided-step engine both the public demo and the post-signup
 * onboarding tour run on. It highlights the next control, shows one caption at bottom center, keeps
 * a skip visible at all times, and can be replayed from any state.
 *
 * It drives the REAL screens rather than video or slides, which fixes the whole design: the engine
 * points and waits, and that is all a step can express. The two feeds differ only in the injected
 * script and data — there is no host-kind field, no branch and no demo flag anywhere in here.
 *
 * Dependencies are `xstate` + `zustand` only (React a peer, for the `/react` export). That closure is
 * the load-bearing part: with no transport, no fixture package and no read mirror reachable, "the
 * engine performed the step for the user" is unrepresentable rather than merely forbidden — which is
 * what lets the same engine run over a real signed-in account without relaxing a single invariant.
 *
 * The engine records NOTHING durable: no run history, no "already seen" flag. A replay is a START
 * with a fresh run id.
 *
 * Placement: control state in the machine, the registry in Zustand, the script and rects outside both
 * (ARCHITECTURE §3.2). Each app hand-writes its own chrome `ui`; every `model`-level artifact is here.
 */
export {
  defineScript,
  type SequenceAdvance,
  type SequenceCaption,
  type SequenceScript,
  type SequenceStep,
} from './script.ts'
export {
  initialSequenceRunSnapshot,
  sequenceRunMachine,
  type SequenceOutcome,
  type SequenceRunEvent,
  type SequenceRunSnapshot,
} from './sequence.machine.ts'
export {
  currentStep,
  isActive,
  progress,
  resolveCaptionPlacement,
  type CaptionPlacement,
  type SequenceProgress,
  type SequenceRect,
  type SequenceViewport,
} from './select.ts'
export {
  measureAnchor,
  useSequenceAnchorRegistry,
  type SequenceAnchorHandle,
  type SequenceAnchorRegistryState,
} from './anchor-registry.ts'
export { resetSequenceUserState } from './user-state-reset.ts'
