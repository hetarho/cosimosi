import { type FormEvent } from 'react'

import { useTransport } from '@connectrpc/connect-query'

import { signUp } from '@cosimosi/api-client'
import { useSignupProfileController } from '@cosimosi/auth/react/signup'
import { getActiveLocale, m, resolveDeviceTimeZone } from '../../../shared/i18n/index.ts'
import { Button, Card, TextField } from '@cosimosi/ui'

import { InviteAcknowledgment } from './InviteAcknowledgment.tsx'

export interface NicknameStepProps {
  onCompleted: () => void | Promise<void>
}

export function NicknameStep({ onCompleted }: NicknameStepProps) {
  const transport = useTransport()
  const { value, setValue, pending, status, error, submitProfile } = useSignupProfileController({
    submit: (request) => signUp(transport, request),
    locale: getActiveLocale,
    timeZone: resolveDeviceTimeZone,
    onCompleted,
  })
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitProfile()
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
          {status === 'failed' ? (
            <p role="alert" className="text-sm text-danger">
              {error === 'invalid-nickname'
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
