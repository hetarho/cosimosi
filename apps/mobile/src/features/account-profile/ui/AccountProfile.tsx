import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createGetProfileQueryKey,
  createGetProfileQueryOptions,
  updateProfile,
  type Profile,
} from '@cosimosi/api-client'
import { validateNickname } from '@cosimosi/auth'
import { VALUES } from '@cosimosi/config'
import {
  getActiveLocale,
  m,
  resolveDeviceTimeZone,
  setActiveLocale,
  type Locale,
} from '@cosimosi/i18n'
import { Button, Card, TextField, tokens } from '@cosimosi/ui'

import { writeStoredLocale } from '../../../shared/native/index.ts'
import { useErrorToast } from '../../../shared/model/index.ts'

export function AccountProfile() {
  const transport = useTransport()
  const queryClient = useQueryClient()
  const showError = useErrorToast()
  const query = useQuery(createGetProfileQueryOptions(transport))
  const [nickname, setNickname] = useState('')
  const [nicknameError, setNicknameError] = useState(false)
  const deviceTimeZone = resolveDeviceTimeZone()

  useEffect(() => {
    if (query.data?.profile) setNickname(query.data.profile.nickname)
  }, [query.data?.profile])

  const mutation = useMutation({
    gcTime: 0,
    mutationFn: (request: ProfileUpdate) => updateProfile(transport, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: createGetProfileQueryKey(transport) })
    },
  })

  if (query.isPending) return <Text style={styles.muted}>{m.me_profile_loading()}</Text>
  if (query.isError || !query.data.profile) {
    return <Text style={styles.muted}>{m.me_profile_refused()}</Text>
  }
  const profile = query.data.profile

  const save = async (next: ProfileUpdate) => {
    try {
      await mutation.mutateAsync(next)
    } catch (error) {
      showError(error)
      throw error
    }
  }

  const saveNickname = async () => {
    const validation = validateNickname(nickname)
    if (!validation.valid) {
      setNicknameError(true)
      return
    }
    setNicknameError(false)
    await save(profileRequest(profile, { nickname: validation.nickname })).catch(() => undefined)
  }

  const saveLocale = async (next: Locale) => {
    if (next === profile.locale || mutation.isPending) return
    const previous = getActiveLocale()
    setActiveLocale(next)
    writeStoredLocale(next)
    try {
      await save(profileRequest(profile, { locale: next }))
    } catch {
      setActiveLocale(previous)
      writeStoredLocale(previous)
    }
  }

  const saveTimeZone = async () => {
    if (!deviceTimeZone || deviceTimeZone === profile.timezone || mutation.isPending) return
    await save(profileRequest(profile, { timezone: deviceTimeZone })).catch(() => undefined)
  }

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
          editable={!mutation.isPending}
        />
        <View style={styles.action}>
          <Button size="sm" onPress={saveNickname} disabled={mutation.isPending}>
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
            disabled={mutation.isPending}
          >
            {m.me_language_option_ko()}
          </Button>
          <Button
            size="sm"
            variant={profile.locale === 'en' ? 'contained' : 'outlined'}
            onPress={() => saveLocale('en')}
            disabled={mutation.isPending}
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
            disabled={mutation.isPending || !deviceTimeZone || deviceTimeZone === profile.timezone}
          >
            {m.me_timezone_match_device()}
          </Button>
        </View>
      </Card>
    </View>
  )
}

function profileRequest(
  profile: Profile,
  change: Partial<Pick<Profile, 'nickname' | 'timezone' | 'locale'>>,
): ProfileUpdate {
  return {
    nickname: change.nickname ?? profile.nickname,
    timezone: change.timezone ?? profile.timezone,
    locale: change.locale ?? profile.locale,
  }
}

interface ProfileUpdate {
  nickname: string
  timezone: string
  locale: string
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  card: { gap: 12 },
  row: { flexDirection: 'row', gap: 8 },
  action: { alignItems: 'flex-end' },
  text: { color: tokens.color.text, fontSize: 14 },
  muted: { color: tokens.color['text-muted'], fontSize: 14 },
})
