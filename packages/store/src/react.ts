import { useCallback, useMemo } from 'react'

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
