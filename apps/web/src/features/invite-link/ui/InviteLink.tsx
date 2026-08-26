import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetInviteLinkQueryOptions } from '@cosimosi/api-client'
import { inviteLinkPath } from '@cosimosi/auth'
import { VALUES } from '@cosimosi/config'
import { Button, Card } from '@cosimosi/ui'

import { useErrorToast } from '@cosimosi/errors/react'
import { m } from '../../../shared/i18n/index.ts'
export function InviteLink() {
  const transport = useTransport()
  const showError = useErrorToast()
  const query = useQuery(createGetInviteLinkQueryOptions(transport))

  if (query.isPending) return null
  if (query.isError || !query.data.token) {
    return <p className="text-sm text-text-muted">{m.invite_unavailable()}</p>
  }

  const link = new URL(inviteLinkPath(query.data.token), window.location.origin).toString()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
    } catch (error) {
      showError(error)
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-text">{m.invite_title()}</h2>
      <p className="break-all text-sm text-text-muted">{link}</p>
      <p className="text-sm text-text-muted">
        {m.invite_expires({ expiresAt: query.data.expiresAt })}
      </p>
      <p className="text-sm text-text-muted">
        {m.invite_reward_line({ amount: String(VALUES.twinkle.earnInviteInviter) })}
      </p>
      <div className="flex justify-end">
        <Button size="sm" onClick={copy}>
          {m.invite_copy()}
        </Button>
      </div>
    </Card>
  )
}
