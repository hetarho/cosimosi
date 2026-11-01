import { useState } from 'react'

import { asyncCommandMachine } from '@cosimosi/state-machine'
import { useMachine } from '@cosimosi/state-machine/react'

import type { Profile } from '@cosimosi/api-client'
import { validateNickname } from '../nickname.ts'
import { useCompletionScope } from '../react.ts'

export interface ProfileUpdate {
  nickname: string
  timezone: string
  locale: string
}

export interface ProfileControllerOptions<Locale extends string> {
  profile: Profile | undefined
  pending: boolean
  update(request: ProfileUpdate): Promise<unknown>
  invalidate(): Promise<unknown>
  locale: {
    read(): Locale
    activate(value: Locale): void
    persist(value: Locale): void | Promise<void>
  }
  deviceTimeZone: string | null | undefined
  onError(error: unknown): void
}

/** Product behavior is shared; query wiring, storage and DOM/RN controls are host capabilities. */
export function useAccountProfileController<Locale extends string>({
  profile,
  pending,
  update,
  invalidate,
  locale,
  deviceTimeZone,
  onError,
}: ProfileControllerOptions<Locale>) {
  const source = profile?.nickname ?? ''
  const [draft, setDraft] = useState({ source, value: source })
  const nickname = draft.source === source ? draft.value : source
  const [nicknameError, setNicknameError] = useState(false)
  const capture = useCompletionScope()
  const [snapshot, send, actor] = useMachine(asyncCommandMachine)
  const busy = pending || snapshot.value === 'submitting'
  const setNickname = (value: string) => setDraft({ source, value })

  async function save(change: Partial<ProfileUpdate>, optimisticLocale?: Locale): Promise<boolean> {
    if (!profile || pending || actor.getSnapshot().value === 'submitting') return false
    send({ type: 'SUBMIT', commandId: 'profile' })
    const attempt = actor.getSnapshot().context.attempt
    const isCurrent = capture()
    const previous = locale.read()
    try {
      if (optimisticLocale !== undefined) {
        locale.activate(optimisticLocale)
        await locale.persist(optimisticLocale)
        if (!isCurrent()) return false
      }
      await update({
        nickname: profile.nickname,
        timezone: profile.timezone,
        locale: profile.locale,
        ...change,
      })
      if (!isCurrent()) return false
      await invalidate()
      if (!isCurrent()) return false
      send({ type: 'RESOLVE', resultId: 'profile', attempt })
      return true
    } catch (error) {
      if (!isCurrent()) return false
      if (optimisticLocale !== undefined) {
        locale.activate(previous)
        try {
          await locale.persist(previous)
        } catch {
          /* The original failure remains the useful error. */
        }
        if (!isCurrent()) return false
      }
      send({ type: 'REJECT', error: 'profile-update-failed', attempt })
      onError(error)
      return false
    }
  }

  async function saveNickname() {
    const validation = validateNickname(nickname)
    setNicknameError(!validation.valid)
    if (validation.valid) await save({ nickname: validation.nickname })
  }

  async function saveLocale(next: Locale) {
    if (!profile || next === profile.locale) return
    await save({ locale: next }, next)
  }

  async function saveTimeZone() {
    if (deviceTimeZone && deviceTimeZone !== profile?.timezone)
      await save({ timezone: deviceTimeZone })
  }

  return { busy, nickname, setNickname, nicknameError, saveNickname, saveLocale, saveTimeZone }
}
