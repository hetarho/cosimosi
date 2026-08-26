/**
 * The XState React binding seam. Product components import these hooks from here rather than from
 * `@xstate/react`, so the binding library can be swapped or wrapped without touching call sites
 * (ARCHITECTURE §3.2). Both apps read this one copy — there is no app-local re-export to keep in
 * step.
 *
 * Selection guide:
 * - `useActorRef(machine)` → stable actor ref; does NOT rerender on snapshot changes. This is the
 *   R3F choice: read `actor.getSnapshot()` inside `useFrame` (spec/tech/state-machine.md §R3F
 *   pattern) so a per-frame read never becomes a 60fps React render. Both platforms render R3F —
 *   mobile through `react-native-webgpu` (§3.5) — so the rule is not web-only. It also suits non-UI
 *   subscriptions (gesture handlers, native modules) that read the snapshot imperatively.
 * - `useSelector(actorRef, selector)` → rerenders only when the selected slice changes; pair with
 *   `useActorRef` for granular subscriptions.
 * - `useMachine(machine)` → the full `[snapshot, send, actorRef]` tuple; convenient when a component
 *   owns the machine and rerendering on every transition is acceptable (forms, small widgets).
 * - `shallowEqual` → comparator for selectors that return object slices.
 * - `createActorContext(machine)` → React context for an actor a provider owns and descendants
 *   select from (app-wide lifecycle actors).
 */
export {
  createActorContext,
  shallowEqual,
  useActorRef,
  useMachine,
  useSelector,
} from '@xstate/react'
