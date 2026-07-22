import { useCallback, useEffect } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { createGetBalanceQueryOptions, createTwinkleServiceQueryKey } from '@cosimosi/api-client'
import { useTwinkleBalanceStore } from '../twinkle-balance-store.ts'

// entities/twinkle api: the twinkle.v1 GetBalance read mapped into the shared two-tier
// balance mirror (§3.4 proto→domain). The HUD reads the store; this hook owns the fetch
// and syncs `basic`/`additional` on every resolution. basic is always granted
// server-side ([G5]), so a resolved read is never empty. No polling (§2.7) — the balance
// refetches only when a spend or earn resolves, via useInvalidateTwinkleBalance.
export function useTwinkleBalanceQuery() {
  const transport = useTransport()
  const query = useQuery(createGetBalanceQueryOptions(transport))
  const setBalance = useTwinkleBalanceStore((state) => state.setBalance)
  useEffect(() => {
    if (query.data) setBalance(query.data.basic, query.data.additional)
  }, [query.data, setBalance])
  return query
}

// The refetch-on-spend/earn seam the recall/gist-view flows and the charge sheet call
// after their action resolves. It invalidates the whole twinkle service (GetBalance +
// any open QuoteSpend), so the HUD reflects the debit/credit AND a cost gate re-evaluates
// coverage after a charge or a stale-quote refusal — both without polling (§2.7). Stable
// identity so callers can list it in effect/callback deps without churn.
export function useInvalidateTwinkleBalance() {
  const queryClient = useQueryClient()
  return useCallback(() => {
    queryClient
      .invalidateQueries({ queryKey: createTwinkleServiceQueryKey() })
      .catch(() => undefined)
  }, [queryClient])
}
