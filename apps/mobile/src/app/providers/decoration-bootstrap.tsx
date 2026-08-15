import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import {
  createGetMoodColorsQueryOptions,
  createGetSelectionQueryOptions,
} from '@cosimosi/api-client'
import { MOODS, defaultMoodPalette, moodColor, resolveMoodColors } from '@cosimosi/emotion'
import { m } from '../../shared/i18n/index.ts'
import { tokens } from '@cosimosi/ui'

import { applyMoodColors, moodColorRows } from '@cosimosi/emotion/react'
import { ornamentSelectionRows, useOrnamentPreviewStore } from '@cosimosi/store'
import { useSessionSnapshot } from './auth-provider.tsx'

// The gate that keeps the universe from painting itself twice: what a memory's colour looks like AND
// what the universe wears are both per-user, so entering on the authored defaults and then jumping to
// the user's own choices would make every sign-in flicker. Both reads settle first — an error settles
// them too, because a user whose choices are unreachable should enter on the defaults rather than wait
// behind a gate that will never open.
export function MobileDecorationBootstrap({ children }: { children?: ReactNode }) {
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
      <View style={styles.container}>
        <ActivityIndicator color={tokens.color.primary} />
        <Text style={styles.label}>{m.common_loading()}</Text>
      </View>
    )
  }
  return <>{children}</>
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  label: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
})
