import { useEffect, useState, type ReactNode } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import {
  createGetMoodColorsQueryOptions,
  createGetPalettePreferenceQueryOptions,
} from '@cosimosi/api-client'
import {
  DEFAULT_PALETTE_ID,
  MOODS,
  defaultMoodPalette,
  moodColor,
  resolveMoodColors,
  resolvePaletteById,
} from '@cosimosi/emotion'
import { m } from '../../shared/i18n/index.ts'

import {
  applyMoodColors,
  initializePaletteSession,
  moodColorRows,
  paletteSessionMatches,
} from '@cosimosi/emotion/react'
import { useSessionSnapshot } from '@cosimosi/auth/react'

export function PaletteBootstrap({ children }: { children?: ReactNode }) {
  const transport = useTransport()
  const { userId } = useSessionSnapshot()
  const preference = useQuery({
    ...createGetPalettePreferenceQueryOptions(transport),
    enabled: userId !== null,
    retry: false,
  })
  const colors = useQuery({
    ...createGetMoodColorsQueryOptions(transport),
    enabled: userId !== null,
    retry: false,
  })
  const [releasedScopeKey, setReleasedScopeKey] = useState<string | null>(null)
  const preferenceSettled = preference.isError || preference.data !== undefined
  const colorsSettled = colors.isError || colors.data !== undefined
  const resolvedId = preference.isError
    ? DEFAULT_PALETTE_ID
    : preference.data
      ? resolvePaletteById(preference.data.paletteId).id
      : null
  const rows = moodColorRows(colors.data?.colors ?? [])
  const fallback = defaultMoodPalette
  const resolved = resolveMoodColors(rows, fallback)
  const alreadyApplied =
    userId !== null &&
    resolvedId !== null &&
    preferenceSettled &&
    colorsSettled &&
    paletteSessionMatches(userId, resolvedId) &&
    MOODS.every((mood) => moodColor(mood) === resolved.colors[mood])
  const ready = userId !== null && (releasedScopeKey === userId || alreadyApplied)

  useEffect(() => {
    if (
      !userId ||
      !resolvedId ||
      !preferenceSettled ||
      !colorsSettled ||
      releasedScopeKey === userId
    ) {
      return
    }
    if (!alreadyApplied) {
      initializePaletteSession(userId, resolvedId)
      applyMoodColors(rows, fallback)
    }
    setReleasedScopeKey(userId)
  }, [
    alreadyApplied,
    colorsSettled,
    fallback,
    preferenceSettled,
    releasedScopeKey,
    resolvedId,
    rows,
    userId,
  ])

  if (!ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background text-text-muted">
        <p className="text-sm">{m.common_loading()}</p>
      </main>
    )
  }
  return <>{children}</>
}
