import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { SpendKind, createQuoteSpendQueryOptions } from '@cosimosi/api-client'

import type { PendingSpend } from '../model/pending-spend.ts'

// features/spend-cost-display api: the read-only twinkle.v1 QuoteSpend call ([G4], §2.7
// unary, NO_SIDE_EFFECTS). It carries only the kind + target id; the server prices the
// spend and returns cost/covered/shortfall, which the display renders verbatim — the FE
// holds no cost curve (CC3). Disabled until there is a pending spend, so opening a free
// surface reads nothing.
export function useSpendQuote(pending: PendingSpend | null) {
  const transport = useTransport()
  const input = {
    kind: pending?.kind ?? SpendKind.UNSPECIFIED,
    episodicMemoryId: pending?.episodicMemoryId ?? '',
    diaryId: pending?.diaryId ?? '',
    semanticStage: pending?.semanticStage ?? 0,
  }
  return useQuery({
    ...createQuoteSpendQueryOptions(input, transport),
    enabled: pending !== null,
  })
}
