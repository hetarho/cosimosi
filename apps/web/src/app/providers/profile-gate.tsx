import { useEffect, useState, type ReactNode } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetProfileQueryOptions } from '@cosimosi/api-client'
import {
  hasSignupCompletion,
  pendingInvite,
  recordSignupCompletion,
  takeSignupCompletion,
} from '@cosimosi/auth'
import { useAuthFacade } from '@cosimosi/auth/react'
import { m } from '../../shared/i18n/index.ts'
import { Button, Card } from '@cosimosi/ui'

import { NicknameStep } from '../../features/sign-up/index.ts'
import { ChooseMoodColors } from '../../features/choose-mood-colors/index.ts'

export function ProfileGate({ children }: { children?: ReactNode }) {
  const transport = useTransport()
  const facade = useAuthFacade()
  const profile = useQuery({
    ...createGetProfileQueryOptions(transport),
    retry: false,
  })
  const profilePresent = profile.data?.profile !== undefined
  const [colorGate, setColorGate] = useState<'show' | 'done'>(() =>
    hasSignupCompletion() ? 'show' : 'done',
  )

  useEffect(() => {
    if (profilePresent) pendingInvite.clear()
  }, [profilePresent])
  useEffect(() => {
    if (colorGate === 'show') takeSignupCompletion()
  }, [colorGate])

  if (profile.isPending) return <ProfileGateHold />
  if (profile.isError) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg p-6 text-text">
        <Card className="flex w-full max-w-sm flex-col gap-4">
          <p className="text-sm text-text-muted">{m.signup_profile_refused()}</p>
          <Button onClick={() => profile.refetch()}>{m.signup_profile_retry()}</Button>
          <Button variant="text" color="neutral" onClick={() => facade.signOut()}>
            {m.signup_profile_sign_out()}
          </Button>
        </Card>
      </main>
    )
  }
  if (!profile.data.profile) {
    return (
      <NicknameStep
        onCompleted={async () => {
          setColorGate(takeSignupCompletion() ? 'show' : 'done')
          await profile.refetch()
        }}
      />
    )
  }
  if (colorGate === 'show') {
    return (
      <ChooseMoodColors
        onContinue={() => {
          recordSignupCompletion()
          setColorGate('done')
        }}
      />
    )
  }
  return <>{children}</>
}

function ProfileGateHold() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg text-text-muted">
      <p className="text-sm">{m.common_loading()}</p>
    </main>
  )
}
