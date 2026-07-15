import { useEffect, type ReactNode } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetPalettePreferenceQueryOptions } from '@cosimosi/api-client'
import { DEFAULT_PALETTE_ID } from '@cosimosi/emotion'

import { applyPalette } from '../../features/change-palette/index.ts'
import { useSessionSnapshot } from './auth-provider.tsx'

// App-init palette apply (§3.1): an app-layer step that reads the stored preference on boot and
// applies it through the single setMoodPalette seam, so the universe is colored by the user's
// palette from the first frame. It never blocks boot — the default palette is already active, so
// the universe is never uncolored; an unset/unknown id or a failed/unauthenticated read falls back
// to the default. A signed-out session re-applies the default (the store-clear sign-out hygiene).
// This is the ONE host that forks per platform; the registry and the api segment are shared verbatim.
export function MobilePaletteBootstrap({ children }: { children?: ReactNode }) {
  const transport = useTransport()
  const session = useSessionSnapshot()
  const authenticated = Boolean(session.userId)
  const preference = useQuery({
    ...createGetPalettePreferenceQueryOptions(transport),
    enabled: authenticated,
  })
  const paletteId = preference.data?.paletteId
  const failed = preference.isError

  useEffect(() => {
    if (!authenticated || failed) {
      applyPalette(DEFAULT_PALETTE_ID)
      return
    }
    if (paletteId) {
      applyPalette(paletteId)
    }
  }, [authenticated, failed, paletteId])

  return <>{children}</>
}
