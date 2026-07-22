import { useEffect, useState, type ReactNode } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetPalettePreferenceQueryOptions } from '@cosimosi/api-client'
import { DEFAULT_PALETTE_ID, resolvePaletteById } from '@cosimosi/emotion'
import { m } from '@cosimosi/i18n'

import {
  initializePaletteSession,
  paletteSessionMatches,
  usePalettePreferenceStore,
} from '../../features/change-palette/index.ts'
import { useSessionSnapshot } from '../../shared/auth/index.ts'

export function PaletteBootstrap({ children }: { children?: ReactNode }) {
  const transport = useTransport()
  const { userId } = useSessionSnapshot()
  const preference = useQuery({
    ...createGetPalettePreferenceQueryOptions(transport),
    enabled: userId !== null,
    retry: false,
  })
  const confirmedPaletteId = usePalettePreferenceStore((state) => state.confirmedPaletteId)
  const [releasedScopeKey, setReleasedScopeKey] = useState<string | null>(null)
  const resolvedId = preference.isError
    ? DEFAULT_PALETTE_ID
    : preference.data
      ? resolvePaletteById(preference.data.paletteId).id
      : null
  const alreadyApplied =
    userId !== null &&
    resolvedId !== null &&
    confirmedPaletteId === resolvedId &&
    paletteSessionMatches(userId, resolvedId)
  const ready = userId !== null && (releasedScopeKey === userId || alreadyApplied)

  useEffect(() => {
    if (!userId || !resolvedId || releasedScopeKey === userId) return
    if (!alreadyApplied) initializePaletteSession(userId, resolvedId)
    setReleasedScopeKey(userId)
  }, [alreadyApplied, releasedScopeKey, resolvedId, userId])

  if (!ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background text-text-muted">
        <p className="text-sm">{m.common_loading()}</p>
      </main>
    )
  }
  return <>{children}</>
}
