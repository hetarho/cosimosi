import { useState, type ReactNode } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useMutation } from '@tanstack/react-query'

import { withdraw } from '@cosimosi/api-client'
import { useAccountSession } from '@cosimosi/auth/react'
import { VALUES } from '@cosimosi/config'
import { Button, Card } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import { useErrorToast } from '../../../shared/model/index.ts'

export function WithdrawAccount({ exportOffer }: { exportOffer: ReactNode }) {
  const transport = useTransport()
  const { signOut } = useAccountSession()
  const showError = useErrorToast()
  const [confirming, setConfirming] = useState(false)
  const mutation = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      await withdraw(transport)
      await signOut()
    },
    onError: showError,
  })

  if (!confirming) {
    return (
      <div className="flex justify-end">
        <Button color="danger" variant="text" size="sm" onClick={() => setConfirming(true)}>
          {m.withdraw_start()}
        </Button>
      </div>
    )
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-text">{m.withdraw_title()}</h2>
        <p className="text-sm text-text-muted">
          {m.withdraw_description({
            days: String(VALUES.release.softDeleteRetentionDays),
          })}
        </p>
        <p className="text-sm text-text-muted">{m.withdraw_export_offer()}</p>
      </div>
      {exportOffer}
      <div className="flex justify-end gap-2">
        <Button
          color="neutral"
          variant="text"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={mutation.isPending}
        >
          {m.common_cancel()}
        </Button>
        <Button
          color="danger"
          size="sm"
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
        >
          {m.withdraw_confirm()}
        </Button>
      </div>
    </Card>
  )
}
