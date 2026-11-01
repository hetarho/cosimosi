import { useState } from 'react'
import { asyncCommandMachine } from '@cosimosi/state-machine'
import { useMachine } from '@cosimosi/state-machine/react'
import { validateNickname } from '../nickname.ts'
import { pendingInvite } from '../pending-invite.ts'
import { readErrorMessage } from '../error.ts'
import { recordSignupCompletion } from '../signup-completion.ts'
import { useCompletionScope } from '../react.ts'

export function useSignupProfileController({
  submit,
  locale,
  timeZone,
  onCompleted,
}: {
  submit(request: {
    nickname: string
    timezone: string
    locale: string
    inviteToken: string
  }): Promise<{ nickname: string }>
  locale(): string
  timeZone(): string | null | undefined
  onCompleted(): void | Promise<void>
}) {
  const [value, setValue] = useState('')
  const [snapshot, send, actor] = useMachine(asyncCommandMachine)
  const capture = useCompletionScope()
  const pending = snapshot.context.status === 'submitting'
  async function submitProfile() {
    if (actor.getSnapshot().context.status === 'submitting') return
    const validation = validateNickname(value)
    send({ type: 'SUBMIT', commandId: 'signup-profile' })
    const attempt = actor.getSnapshot().context.attempt
    if (!validation.valid) {
      send({ type: 'REJECT', error: 'invalid-nickname', attempt })
      return
    }
    const isCurrent = capture()
    const inviteToken = pendingInvite.consume() ?? ''
    try {
      const response = await submit({
        nickname: validation.nickname,
        timezone: timeZone() ?? 'UTC',
        locale: locale(),
        inviteToken,
      })
      if (!isCurrent()) return
      recordSignupCompletion()
      send({ type: 'RESOLVE', resultId: response.nickname, attempt })
      await onCompleted()
    } catch (error) {
      if (isCurrent())
        send({ type: 'REJECT', error: readErrorMessage(error, 'signup failed'), attempt })
    }
  }
  return {
    value,
    setValue,
    pending,
    status: snapshot.context.status,
    error: snapshot.context.error,
    submitProfile,
  }
}
