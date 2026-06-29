/**
 * XState React binding seam for actors. Feature components import hooks from
 * here, not from @xstate/react, so the underlying binding library can be
 * swapped or wrapped without touching call sites. ARCHITECTURE §3.2.
 *
 * Selection guide:
 * - `useActorRef(machine)` → stable actor ref; does NOT rerender on snapshot
 *   changes. Use this for non-UI subscriptions (gesture handlers, native
 *   modules) and read `actor.getSnapshot()` imperatively.
 * - `useSelector(actorRef, selector)` → rerenders only when the selected slice
 *   changes; pair with `useActorRef` for granular subscriptions.
 * - `useMachine(machine)` → full `[snapshot, send, actorRef]` tuple; convenient
 *   when a component owns the machine and rerendering on every transition is
 *   acceptable (small widgets).
 * - `shallowEqual` → comparator for selectors that return object slices.
 * - `createActorContext(machine)` → React context for an actor a provider owns
 *   and descendants select from (app-wide lifecycle actors; ARCHITECTURE §3.2).
 */
export {createActorContext, shallowEqual, useActorRef, useMachine, useSelector} from '@cosimosi/state-machine/react';
