import { useMemo } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useMutation } from '@tanstack/react-query'

import { createAdminClient } from '@cosimosi/api-client'

// features/admin-users api: the writes a user row can issue. One mutation carries all three, because
// the list runs them one at a time and disables every row while one is in flight.

export type AdminUserAction =
  | {
      readonly kind: 'grant-stardust'
      readonly userId: string
      readonly amount: bigint
      readonly note: string
      /** The grant's idempotency key, minted once per submit (ADMIN-9). */
      readonly grantId: string
    }
  | { readonly kind: 'grant-admin'; readonly userId: string }
  | { readonly kind: 'revoke-admin'; readonly userId: string }

export function useAdminUserAction() {
  const transport = useTransport()
  const client = useMemo(() => createAdminClient(transport), [transport])
  return useMutation({
    // The list refetches after any of them, so no response is read back.
    mutationFn: async (action: AdminUserAction): Promise<void> => {
      switch (action.kind) {
        case 'grant-stardust':
          await client.grantStardust({
            userId: action.userId,
            amount: action.amount,
            note: action.note,
            grantId: action.grantId,
          })
          return
        case 'grant-admin':
          await client.grantAdmin({ userId: action.userId })
          return
        case 'revoke-admin':
          await client.revokeAdmin({ userId: action.userId })
          return
      }
    },
  })
}
