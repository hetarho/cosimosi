import { useTransport } from '@connectrpc/connect-query'
import { useInfiniteQuery } from '@tanstack/react-query'

import { createGetLedgerInfiniteQueryOptions } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'

// entities/twinkle api: the twinkle.v1 GetLedger read, page size from generated config — the FE holds
// no economy constant, and the server clamps to the same cap regardless.
//
// It registers NO invalidation seam of its own. The shipped useInvalidateTwinkleBalance invalidates the
// whole TwinkleService key, which partially matches this infinite query, so a spend or an earn
// refreshes balance, quote and history together. No polling (§2.7) — the history moves only when
// something moved it.
export function useTwinkleLedgerInfiniteQuery() {
  const transport = useTransport()
  return useInfiniteQuery(
    createGetLedgerInfiniteQueryOptions(transport, VALUES.twinkle.ledgerPageSize),
  )
}
