import { useTransport } from '@connectrpc/connect-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createGetProfileQueryKey,
  createGetProfileQueryOptions,
  updateProfile,
} from '@cosimosi/api-client'
import { useAccountProfileController, type ProfileUpdate } from '@cosimosi/auth/react/profile'
import { VALUES } from '@cosimosi/config'
import {
  getActiveLocale,
  m,
  resolveDeviceTimeZone,
  setActiveLocale,
} from '../../../shared/i18n/index.ts'
import { Button, Card, TextField } from '@cosimosi/ui'

import { useErrorToast } from '@cosimosi/errors/react'
import { writeStoredLocale } from '../../../shared/lib/locale-storage.ts'
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
  if (query.isPending) return <p className="text-sm text-text-muted">{m.me_profile_loading()}</p>
  if (query.isError || !query.data.profile) {
    return <p className="text-sm text-text-muted">{m.me_profile_refused()}</p>
  }
  const profile = query.data.profile

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
          disabled={busy}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={saveNickname} disabled={busy}>
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
            disabled={busy}
          >
            {m.me_language_option_ko()}
          </Button>
          <Button
            size="sm"
            variant={profile.locale === 'en' ? 'contained' : 'outlined'}
            onClick={() => saveLocale('en')}
            disabled={busy}
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
            disabled={busy || !deviceTimeZone || deviceTimeZone === profile.timezone}
          >
            {m.me_timezone_match_device()}
          </Button>
        </div>
      </Card>
    </div>
  )
}
