import { useEffect, useState } from 'react'

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
  resolveDeviceTimeZone,
  setActiveLocale,
  type Locale,
} from '@cosimosi/i18n'
import { Button, Card, TextField } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import { writeStoredLocale } from '../../../shared/lib/locale-storage.ts'
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

  if (query.isPending) return <p className="text-sm text-text-muted">{m.me_profile_loading()}</p>
  if (query.isError || !query.data.profile) {
    return <p className="text-sm text-text-muted">{m.me_profile_refused()}</p>
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
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <TextField
          label={m.me_nickname_label()}
          description={m.me_nickname_notice({
            min: String(VALUES.account.nicknameMinLength),
            max: String(VALUES.account.nicknameMaxLength),
          })}
          error={nicknameError ? m.me_nickname_invalid() : undefined}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          disabled={mutation.isPending}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={saveNickname} disabled={mutation.isPending}>
            {m.me_nickname_save()}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-sm text-text-muted">{m.me_language_label()}</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={profile.locale === 'ko' ? 'contained' : 'outlined'}
            onClick={() => saveLocale('ko')}
            disabled={mutation.isPending}
          >
            {m.me_language_option_ko()}
          </Button>
          <Button
            size="sm"
            variant={profile.locale === 'en' ? 'contained' : 'outlined'}
            onClick={() => saveLocale('en')}
            disabled={mutation.isPending}
          >
            {m.me_language_option_en()}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-sm text-text-muted">{m.me_timezone_label()}</p>
        <p className="text-sm text-text">{m.me_timezone_current({ timezone: profile.timezone })}</p>
        {!deviceTimeZone ? (
          <p className="text-sm text-text-muted">{m.me_timezone_unavailable()}</p>
        ) : null}
        <p className="text-sm text-text-muted">{m.me_timezone_notice()}</p>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={saveTimeZone}
            disabled={mutation.isPending || !deviceTimeZone || deviceTimeZone === profile.timezone}
          >
            {m.me_timezone_match_device()}
          </Button>
        </div>
      </Card>
    </div>
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
