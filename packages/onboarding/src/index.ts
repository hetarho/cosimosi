/**
 * @cosimosi/onboarding — the post-signup tour: `@cosimosi/sequence`'s engine, unmodified, pointed at
 * the real universe and fed by the user's own first diary. The only difference from the public demo is
 * the injected script.
 *
 * That is what makes this package delicate. The demo's engine runs in a sandbox that is exempt from
 * every invariant and hands out free time travel; here the very same engine runs on a live account
 * where nothing is exempt. So this package is subtractive: the engine already cannot act (no action
 * field on a step), and this adds the second half — the tour's VOCABULARY is two closed unions, five
 * anchors and three signals, and none of them names a paid, destructive, decorative or clock-moving
 * control. A tour step that spends stardust is not forbidden here; it is unspellable.
 *
 * The dependency list is the other half of the closure: `@cosimosi/sequence` + `@cosimosi/i18n` +
 * `zustand`. No transport, no fixture package, no domain-logic package and no read-model store is
 * reachable, so "the tour created a memory" is unrepresentable rather than merely against the rules.
 *
 * It records NOTHING durable — no "already seen" flag on the server or the client. "Once, just after
 * signup" is a property of the trigger, not of a flag that could be wrong (`start.ts`).
 *
 * Placement: everything here is pure and shared verbatim by both apps; each app hand-writes the `ui`
 * that wraps the anchors and mounts the chrome (ARCHITECTURE §3.1, §3.5).
 */
export { type OnboardingAnchor, type OnboardingSignal } from './anchors.ts'
export { ONBOARDING_SCRIPT } from './script.ts'
export {
  reportSequenceSignal,
  useOnboardingSignalStore,
  type OnboardingSignalReport,
  type OnboardingSignalState,
} from './signal-channel.ts'
export { requestOnboardingReplay, takeOnboardingStart, type OnboardingStart } from './start.ts'
export { resetOnboardingUserState } from './user-state-reset.ts'
