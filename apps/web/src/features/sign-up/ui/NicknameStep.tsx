import { useState, type FormEvent } from 'react'

import { useTransport } from '@connectrpc/connect-query'

import { signUp } from '@cosimosi/api-client'
import {
  pendingInvite,
  readErrorMessage,
  recordSignupCompletion,
  validateNickname,
} from '@cosimosi/auth'
import { getActiveLocale, m, resolveDeviceTimeZone } from '../../../shared/i18n/index.ts'
import { asyncCommandMachine } from '@cosimosi/state-machine'
import { Button, Card, TextField } from '@cosimosi/ui'

import { useMachine } from '@cosimosi/state-machine/react'
import { InviteAcknowledgment } from './InviteAcknowledgment.tsx'

export interface NicknameStepProps {
  onCompleted: () => void | Promise<void>
}

export function NicknameStep({ onCompleted }: NicknameStepProps) {
  const transport = useTransport()
  const [value, setValue] = useState('')
  const [snapshot, send, actorRef] = useMachine(asyncCommandMachine)
  const pending = snapshot.context.status === 'submitting'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (actorRef.getSnapshot().context.status === 'submitting') return
    const validation = validateNickname(value)
    if (!validation.valid) {
      send({ type: 'SUBMIT', commandId: 'signup-profile' })
      const attempt = actorRef.getSnapshot().context.attempt
      send({ type: 'REJECT', error: 'invalid-nickname', attempt })
      return
    }

    send({ type: 'SUBMIT', commandId: 'signup-profile' })
    const attempt = actorRef.getSnapshot().context.attempt
    const inviteToken = pendingInvite.consume() ?? ''
    try {
      const response = await signUp(transport, {
        nickname: validation.nickname,
        timezone: resolveDeviceTimeZone() ?? 'UTC',
        locale: getActiveLocale(),
        inviteToken,
      })
      recordSignupCompletion()
      send({ type: 'RESOLVE', resultId: response.nickname, attempt })
      await onCompleted()
    } catch (error) {
      send({
        type: 'REJECT',
        error: readErrorMessage(error, 'signup failed'),
        attempt,
      })
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6 text-text">
      <Card className="w-full max-w-sm">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <h1 className="text-lg font-medium">{m.signup_nickname_title()}</h1>
          <InviteAcknowledgment />
          <TextField
            label={m.signup_nickname_label()}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={pending}
            autoComplete="nickname"
            required
          />
          {snapshot.context.status === 'failed' ? (
            <p role="alert" className="text-sm text-danger">
              {snapshot.context.error === 'invalid-nickname'
                ? m.signup_nickname_invalid()
                : m.signup_nickname_failed()}
            </p>
          ) : null}
          <Button type="submit" color="primary" disabled={pending}>
            {pending ? m.common_loading() : m.signup_nickname_submit()}
          </Button>
        </form>
      </Card>
    </main>
  )
}
