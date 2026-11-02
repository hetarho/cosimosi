import { StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createGetProfileQueryKey,
  createGetProfileQueryOptions,
  updateProfile,
} from '@cosimosi/api-client'
import { useAccountProfileController, type ProfileUpdate } from '@cosimosi/account/react'
import { VALUES } from '@cosimosi/config'
import {
  getActiveLocale,
  m,
  resolveDeviceTimeZone,
  setActiveLocale,
} from '../../../shared/i18n/index.ts'
import { Button, Card, TextField, tokens } from '@cosimosi/ui'

import { useErrorToast } from '@cosimosi/errors/react'
import { writeStoredLocale } from '../../../shared/native/index.ts'
export function AccountProfile() {
  const transport = useTransport()
  const queryClient = useQueryClient()
  const showError = useErrorToast()
  const query = useQuery(createGetProfileQueryOptions(transport))
  const deviceTimeZone = resolveDeviceTimeZone()

  const mutation = useMutation({
    gcTime: 0,
    mutationFn: (request: ProfileUpdate) => updateProfile(transport, request),
  })

  const { busy, nickname, setNickname, nicknameError, saveNickname, saveLocale, saveTimeZone } =
    useAccountProfileController({
      profile: query.data?.profile,
      pending: mutation.isPending,
      update: (request) => mutation.mutateAsync(request),
      invalidate: () =>
        queryClient.invalidateQueries({ queryKey: createGetProfileQueryKey(transport) }),
      locale: { read: getActiveLocale, activate: setActiveLocale, persist: writeStoredLocale },
      deviceTimeZone,
      onError: showError,
    })
  if (query.isPending) return <Text style={styles.muted}>{m.me_profile_loading()}</Text>
  if (query.isError || !query.data.profile) {
    return <Text style={styles.muted}>{m.me_profile_refused()}</Text>
  }
  const profile = query.data.profile

  return (
    <View style={styles.root}>
      <Card style={styles.card}>
        <TextField
          label={m.me_nickname_label()}
          description={m.me_nickname_notice({
            min: String(VALUES.account.nicknameMinLength),
            max: String(VALUES.account.nicknameMaxLength),
          })}
          error={nicknameError ? m.me_nickname_invalid() : undefined}
          value={nickname}
          onChangeText={setNickname}
          editable={!busy}
        />
        <View style={styles.action}>
          <Button size="sm" onPress={saveNickname} disabled={busy}>
            {m.me_nickname_save()}
          </Button>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.muted}>{m.me_language_label()}</Text>
        <View style={styles.row}>
          <Button
            size="sm"
            variant={profile.locale === 'ko' ? 'contained' : 'outlined'}
            onPress={() => saveLocale('ko')}
            disabled={busy}
          >
            {m.me_language_option_ko()}
          </Button>
          <Button
            size="sm"
            variant={profile.locale === 'en' ? 'contained' : 'outlined'}
            onPress={() => saveLocale('en')}
            disabled={busy}
          >
            {m.me_language_option_en()}
          </Button>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.muted}>{m.me_timezone_label()}</Text>
        <Text style={styles.text}>{m.me_timezone_current({ timezone: profile.timezone })}</Text>
        {!deviceTimeZone ? <Text style={styles.muted}>{m.me_timezone_unavailable()}</Text> : null}
        <Text style={styles.muted}>{m.me_timezone_notice()}</Text>
        <View style={styles.action}>
          <Button
            size="sm"
            onPress={saveTimeZone}
            disabled={busy || !deviceTimeZone || deviceTimeZone === profile.timezone}
          >
            {m.me_timezone_match_device()}
          </Button>
        </View>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  card: { gap: 12 },
  row: { flexDirection: 'row', gap: 8 },
  action: { alignItems: 'flex-end' },
  text: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
})
