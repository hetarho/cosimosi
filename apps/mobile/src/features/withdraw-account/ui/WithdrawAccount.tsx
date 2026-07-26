import { useState, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useMutation } from '@tanstack/react-query'

import { withdraw } from '@cosimosi/api-client'
import { useAccountSession } from '@cosimosi/auth/react'
import { VALUES } from '@cosimosi/config'
import { m } from '@cosimosi/i18n'
import { Button, Card, tokens } from '@cosimosi/ui'

import { useErrorToast } from '../../../shared/model/index.ts'

export function WithdrawAccount({ exportOffer }: { exportOffer: ReactNode }) {
  const transport = useTransport()
  const { signOut } = useAccountSession()
  const showError = useErrorToast()
  const [confirming, setConfirming] = useState(false)
  const mutation = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      await withdraw(transport)
      await signOut()
    },
    onError: showError,
  })

  if (!confirming) {
    return (
      <View style={styles.action}>
        <Button color="danger" variant="text" size="sm" onPress={() => setConfirming(true)}>
          {m.withdraw_start()}
        </Button>
      </View>
    )
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{m.withdraw_title()}</Text>
      <Text style={styles.muted}>
        {m.withdraw_description({
          days: String(VALUES.release.softDeleteRetentionDays),
        })}
      </Text>
      <Text style={styles.muted}>{m.withdraw_export_offer()}</Text>
      {exportOffer}
      <View style={styles.actions}>
        <Button
          color="neutral"
          variant="text"
          size="sm"
          onPress={() => setConfirming(false)}
          disabled={mutation.isPending}
        >
          {m.common_cancel()}
        </Button>
        <Button
          color="danger"
          size="sm"
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
        >
          {m.withdraw_confirm()}
        </Button>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  title: { color: tokens.color.text, fontSize: 14, fontWeight: '600' },
  muted: { color: tokens.color['text-muted'], fontSize: 14 },
  action: { alignItems: 'flex-end' },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
})
