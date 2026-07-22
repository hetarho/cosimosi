import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetPalettePreferenceQueryOptions } from '@cosimosi/api-client'
import { DEFAULT_PALETTE_ID, resolvePaletteById } from '@cosimosi/emotion'
import { m } from '@cosimosi/i18n'
import { tokens } from '@cosimosi/ui'

import {
  initializePaletteSession,
  paletteSessionMatches,
  usePalettePreferenceStore,
} from '../../features/change-palette/index.ts'
import { useSessionSnapshot } from './auth-provider.tsx'

export function MobilePaletteBootstrap({ children }: { children?: ReactNode }) {
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
  label: { color: tokens.color['text-muted'], fontSize: 14 },
})
