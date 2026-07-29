import { useMemo } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetSelectionQueryOptions } from '@cosimosi/api-client'

import {
  DEFAULT_ORNAMENT_IDS,
  ORNAMENT_KINDS,
  ornamentRegistryKey,
  ornamentSelectionRows,
  selectedRegistryKey,
  type OrnamentKind,
} from './ornament.ts'

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
