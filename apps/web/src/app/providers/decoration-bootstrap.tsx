import { useEffect, useState, type ReactNode } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import {
  createGetMoodColorsQueryOptions,
  createGetSelectionQueryOptions,
} from '@cosimosi/api-client'
import { MOODS, defaultMoodPalette, moodColor, resolveMoodColors } from '@cosimosi/emotion'
import { m } from '../../shared/i18n/index.ts'

import { applyMoodColors, moodColorRows } from '@cosimosi/emotion/react'
import { useSessionSnapshot } from '@cosimosi/auth/react'
import { ornamentSelectionRows, useOrnamentPreviewStore } from '@cosimosi/store'

// The gate that keeps the universe from painting itself twice: what a memory's colour looks like AND
// what the universe wears are both per-user, so entering on the authored defaults and then jumping to
// the user's own choices would make every sign-in flicker. Both reads settle first — an error settles
// them too, because a user whose choices are unreachable should enter on the defaults rather than wait
// behind a gate that will never open.
export function DecorationBootstrap({ children }: { children?: ReactNode }) {
  const transport = useTransport()
  const { userId } = useSessionSnapshot()
  const colors = useQuery({
    ...createGetMoodColorsQueryOptions(transport),
    enabled: userId !== null,
    retry: false,
  })
  const selection = useQuery({
    ...createGetSelectionQueryOptions(transport),
    enabled: userId !== null,
    retry: false,
  })
  const adoptSelection = useOrnamentPreviewStore((state) => state.adopt)
  const [releasedScopeKey, setReleasedScopeKey] = useState<string | null>(null)
  const colorsSettled = colors.isError || colors.data !== undefined
  const selectionSettled = selection.isError || selection.data !== undefined
  const rows = moodColorRows(colors.data?.colors ?? [])
  const fallback = defaultMoodPalette
  const resolved = resolveMoodColors(rows, fallback)
  const alreadyApplied =
    userId !== null &&
    colorsSettled &&
    MOODS.every((mood) => moodColor(mood) === resolved.colors[mood])
  const ready =
    userId !== null && selectionSettled && (releasedScopeKey === userId || alreadyApplied)

  useEffect(() => {
    if (!selection.data) return
    adoptSelection(ornamentSelectionRows(selection.data.selections))
  }, [selection.data, adoptSelection])

  useEffect(() => {
    if (!userId || !colorsSettled || releasedScopeKey === userId) return
    if (!alreadyApplied) applyMoodColors(rows, fallback)
    setReleasedScopeKey(userId)
  }, [alreadyApplied, colorsSettled, fallback, releasedScopeKey, rows, userId])

  if (!ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg text-text-muted">
        <p className="text-sm">{m.common_loading()}</p>
      </main>
    )
  }
  return <>{children}</>
}
