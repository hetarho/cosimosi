import { useEffect, type ReactNode } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetProfileQueryOptions } from '@cosimosi/api-client'
import { pendingInvite } from '@cosimosi/auth'
import { m } from '../../shared/i18n/index.ts'
import { Button, Card } from '@cosimosi/ui'

import { NicknameStep } from '../../features/sign-up/index.ts'
import { useAuthFacade, useSessionSnapshot } from '../../shared/auth/index.ts'

export function ProfileGate({ children }: { children?: ReactNode }) {
  const transport = useTransport()
  const facade = useAuthFacade()
  const { userId } = useSessionSnapshot()
  const profile = useQuery({
    ...createGetProfileQueryOptions(transport),
    enabled: userId !== null,
    retry: false,
  })
  const profilePresent = profile.data?.profile !== undefined

  useEffect(() => {
    if (profilePresent) pendingInvite.clear()
  }, [profilePresent])

  if (profile.isPending) return <ProfileGateHold />
  if (profile.isError) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-text">
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
          await profile.refetch()
        }}
      />
    )
  }
  return <>{children}</>
}

function ProfileGateHold() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background text-text-muted">
      <p className="text-sm">{m.common_loading()}</p>
    </main>
  )
}
