import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetMoodColorsQueryOptions } from '@cosimosi/api-client'
import { MOODS, defaultMoodPalette, moodColor, resolveMoodColors } from '@cosimosi/emotion'
import { m } from '@cosimosi/i18n'
import { tokens } from '@cosimosi/ui'

import { applyMoodColors, moodColorRows } from '@cosimosi/emotion/react'
import { useSessionSnapshot } from './auth-provider.tsx'

export function MobilePaletteBootstrap({ children }: { children?: ReactNode }) {
  const transport = useTransport()
  const { userId } = useSessionSnapshot()
  const colors = useQuery({
    ...createGetMoodColorsQueryOptions(transport),
    enabled: userId !== null,
    retry: false,
  })
  const [releasedScopeKey, setReleasedScopeKey] = useState<string | null>(null)
  // An error settles the read too: a user whose colors are unreachable enters the universe on the
  // authored default rather than waiting behind a gate that will never open.
  const colorsSettled = colors.isError || colors.data !== undefined
  const rows = moodColorRows(colors.data?.colors ?? [])
  const fallback = defaultMoodPalette
  const resolved = resolveMoodColors(rows, fallback)
  const alreadyApplied =
    userId !== null &&
    colorsSettled &&
    MOODS.every((mood) => moodColor(mood) === resolved.colors[mood])
  const ready = userId !== null && (releasedScopeKey === userId || alreadyApplied)

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
