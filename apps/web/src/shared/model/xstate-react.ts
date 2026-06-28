/**
 * XState React binding seam for actors. Feature components import hooks from
 * here, not from @xstate/react, so the underlying binding library can be
 * swapped or wrapped without touching call sites. ARCHITECTURE §3.2.
 *
 * Selection guide:
 * - `useActorRef(machine)` → stable actor ref; does NOT rerender on snapshot
 *   changes. Use this in R3F components and read `actor.getSnapshot()` inside
 *   `useFrame` (see spec/tech/state-machine.md §R3F pattern).
 * - `useSelector(actorRef, selector)` → rerenders only when the selected slice
 *   changes; pair with `useActorRef` for granular subscriptions.
 * - `useMachine(machine)` → full `[snapshot, send, actorRef]` tuple; convenient
 *   when a component owns the machine and rerendering on every transition is
 *   acceptable (forms, small widgets).
 * - `shallowEqual` → comparator for selectors that return object slices.
 */
export { shallowEqual, useActorRef, useMachine, useSelector } from '@xstate/react'
