import { Share, StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetInviteLinkQueryOptions } from '@cosimosi/api-client'
import { inviteLinkPath } from '@cosimosi/auth'
import { VALUES } from '@cosimosi/config'
import { m } from '../../../shared/i18n/index.ts'
import { Button, Card, tokens } from '@cosimosi/ui'

import { useErrorToast } from '../../../shared/model/index.ts'

const mobileInviteOrigin = 'https://cosimosi.haeram.me'

export function InviteLink() {
  const transport = useTransport()
  const showError = useErrorToast()
  const query = useQuery(createGetInviteLinkQueryOptions(transport))

  if (query.isPending) return null
  if (query.isError || !query.data.token) {
    return <Text style={styles.muted}>{m.invite_unavailable()}</Text>
  }

  const link = `${mobileInviteOrigin}${inviteLinkPath(query.data.token)}`
  const share = async () => {
    try {
      await Share.share({ message: link })
    } catch (error) {
      showError(error)
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{m.invite_title()}</Text>
      <Text style={styles.link}>{link}</Text>
      <Text style={styles.muted}>{m.invite_expires({ expiresAt: query.data.expiresAt })}</Text>
      <Text style={styles.muted}>
        {m.invite_reward_line({ amount: String(VALUES.twinkle.earnInviteInviter) })}
      </Text>
      <View style={styles.action}>
        <Button size="sm" onPress={share}>
          {m.invite_share()}
        </Button>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  title: { color: tokens.color.text, fontSize: tokens.fontSize.sm, fontWeight: '600' },
  link: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  action: { alignItems: 'flex-end' },
})
