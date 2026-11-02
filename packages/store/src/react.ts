import { useCallback, useEffect, useMemo } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createGetBalanceQueryKey,
  createGetCatalogQueryKey,
  createGetCatalogQueryOptions,
  createGetSelectionQueryKey,
  createGetSelectionQueryOptions,
} from '@cosimosi/api-client'
import { useAuthFacade, useSessionSnapshot } from '@cosimosi/auth/react'
import { useActorRef, useSelector } from '@cosimosi/state-machine/react'
import { decorationMachine } from './decoration.machine.ts'
import { useDecorationRequestStore } from './decoration-request-store.ts'

import { requestDecorate } from './decorate.ts'
import {
  DEFAULT_ORNAMENT_IDS,
  ORNAMENT_KINDS,
  ornamentRegistryKey,
  ornamentRows,
  ornamentSelectionRows,
  selectedRegistryKey,
  type Ornament,
  type OrnamentKind,
} from './ornament.ts'
import { useOrnamentPreviewStore } from './ornament-preview-store.ts'

/** The registry key each kind wears, keyed by kind — what the renderer seams read. */
export type AppliedOrnaments = Readonly<Record<OrnamentKind, string>>

const DEFAULT_APPLIED: AppliedOrnaments = Object.freeze(
  Object.fromEntries(
    ORNAMENT_KINDS.map((kind) => [
      kind,
      ornamentRegistryKey(kind, DEFAULT_ORNAMENT_IDS[kind]) ?? '',
    ]),
  ) as Record<OrnamentKind, string>,
)

/** What the user's universe wears, resolved to registry keys. Both apps read it through this one
 *  hook rather than each holding its own copy of the mapping.
 *
 *  Before the read lands — and if it fails — every kind reads its default, which is the same
 *  picture an unselected universe shows. That makes a slow read invisible instead of a blank sky;
 *  gating the canvas on it (so a default sky never paints and then jumps) belongs to the boot gate. */
export function useAppliedOrnaments(): AppliedOrnaments {
  const transport = useTransport()
  const selection = useQuery({
    ...createGetSelectionQueryOptions(transport),
    retry: false,
  })
  return useMemo(() => {
    if (!selection.data) return DEFAULT_APPLIED
    const rows = ornamentSelectionRows(selection.data.selections)
    return Object.freeze(
      Object.fromEntries(
        ORNAMENT_KINDS.map((kind) => [kind, selectedRegistryKey(rows, kind)]),
      ) as Record<OrnamentKind, string>,
    )
  }, [selection.data])
}

/**
 * What the universe is wearing THIS INSTANT, resolved to registry keys: the live preview while a
 * decoration panel is open, the confirmed selection otherwise.
 *
 * Every surface that draws a decorated thing reads this one hook — the live scene and any panel-side
 * preview of it alike. Two surfaces resolving the precedence separately is how one of them ends up
 * showing the shipped default while the other wears the user's choice.
 */
export function useWornOrnaments(): AppliedOrnaments {
  const applied = useAppliedOrnaments()
  const previewActive = useOrnamentPreviewStore((state) => state.previewActive)
  const previewed = useOrnamentPreviewStore((state) => state.previewed)
  return useMemo(() => {
    if (!previewActive) return applied
    return Object.freeze(
      Object.fromEntries(
        ORNAMENT_KINDS.map((kind) => [
          kind,
          ornamentRegistryKey(kind, previewed[kind]) ?? applied[kind],
        ]),
      ) as Record<OrnamentKind, string>,
    )
  }, [applied, previewActive, previewed])
}

/** One catalog group per kind, in the order the panel lists them. */
export interface OrnamentGroup {
  readonly kind: OrnamentKind
  readonly ornaments: readonly Ornament[]
}

/**
 * The whole catalog, grouped for display. ONE read answers every row, owned and unowned alike, so
 * there is no owned-list request to make and no ownership filter to apply ([P6]). The grouping is
 * display order; the rows arrive already priced by the server.
 */
export function useOrnamentCatalog(): {
  readonly groups: readonly OrnamentGroup[]
  readonly catalog: readonly Ornament[]
  readonly loading: boolean
} {
  const transport = useTransport()
  const catalogQuery = useQuery({ ...createGetCatalogQueryOptions(transport), retry: false })
  return useMemo(() => {
    const catalog = catalogQuery.data ? ornamentRows(catalogQuery.data.ornaments) : []
    return {
      catalog,
      groups: ORNAMENT_KINDS.map((kind) => ({
        kind,
        ornaments: catalog.filter((ornament) => ornament.kind === kind),
      })),
      loading: catalogQuery.isPending,
    }
  }, [catalogQuery.data, catalogQuery.isPending])
}

export interface SaveOutcome {
  readonly saved: boolean
  /** The refusal to show, or null — which is also what a save abandoned by a user switch reports. */
  readonly reason: string | null
}

/**
 * Save the live preview. A success promotes the previewed ids from the RESPONSE (never from the
 * request) and invalidates the three reads it moved — catalog, selection, balance — rather than
 * writing into any cache itself (§3.2). A refusal changes nothing on either side.
 */
export function useSaveDecoration(): () => Promise<SaveOutcome> {
  const transport = useTransport()
  const queryClient = useQueryClient()
  const facade = useAuthFacade()
  const { userId } = useSessionSnapshot()

  return useCallback(async () => {
    const previewed = useOrnamentPreviewStore.getState().previewed
    try {
      // The facade's snapshot is read at RESOLVE time, not captured now: that is what makes the guard
      // a guard rather than a copy of the same stale value.
      const result = await requestDecorate(
        transport,
        previewed,
        userId,
        () => facade.snapshot.userId,
      )
      // Null means the account changed while the save was in flight: one user's choice must never
      // commit into another's universe.
      if (!result) return { saved: false, reason: null }
      useOrnamentPreviewStore.getState().commit(result.selection)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: createGetCatalogQueryKey(transport) }),
        queryClient.invalidateQueries({ queryKey: createGetSelectionQueryKey(transport) }),
        queryClient.invalidateQueries({ queryKey: createGetBalanceQueryKey(transport) }),
      ])
      return { saved: true, reason: null }
    } catch (error) {
      return { saved: false, reason: error instanceof Error ? error.message : String(error) }
    }
  }, [transport, queryClient, facade, userId])
}

// useDecorationPanelController is the decoration panel's controller, shared by both apps: it opens on a
// request, installs and reverts the preview through the machine's transient phases, and saves through
// the Decorate RPC. Every exit from an open panel goes through `reverting` or `committing`, so no exit
// can skip the revert.
export function useDecorationPanelController({
  active = true,
  invalidateAchievements,
}: {
  // Whether the panel's screen is focused (mobile tabs stay mounted); web is always active.
  active?: boolean
  // A save records three counters, so the achievement read is refreshed on resolution.
  invalidateAchievements: () => void
}) {
  const requested = useDecorationRequestStore((state) => state.requested)
  const clearRequest = useDecorationRequestStore((state) => state.clear)
  const actorRef = useActorRef(decorationMachine)
  const phase = useSelector(actorRef, (snapshot) => snapshot.value)
  const failureReason = useSelector(actorRef, (snapshot) => snapshot.context.failureReason)
  const openPreview = useOrnamentPreviewStore((state) => state.open)
  const revertPreview = useOrnamentPreviewStore((state) => state.revert)
  const { catalog } = useOrnamentCatalog()
  const save = useSaveDecoration()

  useEffect(() => {
    if (!active || !requested) return
    openPreview()
    actorRef.send({ type: 'OPEN' })
    clearRequest()
  }, [active, requested, openPreview, actorRef, clearRequest])

  // Leaving the screen is an exit like any other: the preview goes back rather than following the user
  // to another tab. `phase` is a dependency because a save in flight refuses CLOSE — when it settles
  // back to `browsing` off-screen, this has to ask again rather than leave a hidden panel to revive.
  useEffect(() => {
    if (!active) actorRef.send({ type: 'CLOSE' })
  }, [active, phase, actorRef])

  // The two transient phases are where the preview is actually put back or let stand. Doing it here
  // rather than inside a transition action is what makes "no exit skips it" checkable in the machine.
  useEffect(() => {
    if (phase === 'reverting') {
      revertPreview()
      actorRef.send({ type: 'SETTLED' })
    }
    if (phase === 'committing') actorRef.send({ type: 'SETTLED' })
  }, [phase, revertPreview, actorRef])

  // Leaving the route unmounts the panel without any CLOSE, so the revert has to happen here too:
  // otherwise a preview would outlive the surface that installed it. After a commit this is a no-op —
  // `confirmed` is already the new selection.
  useEffect(() => () => revertPreview(), [revertPreview])

  const saveSelection = useCallback(async () => {
    actorRef.send({ type: 'SAVE' })
    // Only the send that actually MOVED the machine may start a request: a second press while one is
    // in flight is refused by the machine, and must not fire a second Decorate behind its back.
    if (actorRef.getSnapshot().value !== 'saving') return
    const { saved, reason } = await save()
    if (saved) {
      invalidateAchievements()
      actorRef.send({ type: 'SAVED' })
    } else {
      actorRef.send({ type: 'FAILED', reason: reason ?? '' })
    }
  }, [actorRef, save, invalidateAchievements])

  return {
    // The sheet stays mounted past a close so it can slide back out; `open` drives that.
    open: phase === 'browsing' || phase === 'saving',
    saving: phase === 'saving',
    failureReason,
    catalog,
    save: saveSelection,
    close: useCallback(() => actorRef.send({ type: 'CLOSE' }), [actorRef]),
  }
}
