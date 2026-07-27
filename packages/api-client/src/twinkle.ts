import type { MessageInitShape } from '@bufbuild/protobuf'
import {
  createClient,
  createRouterTransport,
  type Client,
  type Transport,
} from '@connectrpc/connect'
import {
  createConnectQueryKey,
  createInfiniteQueryOptions,
  createQueryOptions,
} from '@connectrpc/connect-query-core'

import {
  GetBalanceResponseSchema,
  GetLedgerResponseSchema,
  QuoteSpendResponseSchema,
  TwinkleService,
  type GetLedgerRequest,
  type QuoteSpendRequest,
} from './gen/cosimosi/twinkle/v1/twinkle_pb.ts'

export {
  LedgerEntryKind,
  LedgerEntryReason,
  SpendKind,
  TwinkleService,
} from './gen/cosimosi/twinkle/v1/twinkle_pb.ts'
export type {
  GetBalanceRequest,
  GetBalanceResponse,
  GetLedgerRequest,
  GetLedgerResponse,
  LedgerEntry,
  QuoteSpendRequest,
  QuoteSpendResponse,
} from './gen/cosimosi/twinkle/v1/twinkle_pb.ts'

export function createTwinkleClient(transport: Transport): Client<typeof TwinkleService> {
  return createClient(TwinkleService, transport)
}

export function createTwinkleMockTransport(handlers: {
  getBalance?: () => MessageInitShape<typeof GetBalanceResponseSchema>
  quoteSpend?: (request: QuoteSpendRequest) => MessageInitShape<typeof QuoteSpendResponseSchema>
  getLedger?: (request: GetLedgerRequest) => MessageInitShape<typeof GetLedgerResponseSchema>
}): Transport {
  return createRouterTransport(({ service }) => {
    service(TwinkleService, {
      getBalance() {
        return handlers.getBalance?.() ?? {}
      },
      quoteSpend(request) {
        return handlers.quoteSpend?.(request) ?? {}
      },
      getLedger(request) {
        return handlers.getLedger?.(request) ?? {}
      },
    })
  })
}

export function createTwinkleServiceQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: TwinkleService,
    transport,
    cardinality: undefined,
  })
}

export function createGetBalanceQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: TwinkleService.method.getBalance,
    input: {},
    transport,
    cardinality: 'finite',
  })
}

export function createGetBalanceQueryOptions(transport: Transport) {
  return createQueryOptions(TwinkleService.method.getBalance, {}, { transport })
}

export function createQuoteSpendQueryKey(
  input: MessageInitShape<typeof TwinkleService.method.quoteSpend.input>,
  transport?: Transport,
) {
  return createConnectQueryKey({
    schema: TwinkleService.method.quoteSpend,
    input,
    transport,
    cardinality: 'finite',
  })
}

export function createQuoteSpendQueryOptions(
  input: MessageInitShape<typeof TwinkleService.method.quoteSpend.input>,
  transport: Transport,
) {
  return createQueryOptions(TwinkleService.method.quoteSpend, input, { transport })
}

// The ledger history is paginated newest-first with a keyset cursor ([G7]): page_token carries the
// opaque position, an empty next_page_token marks the last page. The caller passes the page size
// (config-owned, never hardcoded here); the server clamps it to the same cap either way.
export function createGetLedgerInfiniteQueryOptions(transport: Transport, pageSize: number) {
  return createInfiniteQueryOptions(
    TwinkleService.method.getLedger,
    { pageSize, pageToken: '' },
    {
      transport,
      pageParamKey: 'pageToken',
      getNextPageParam: (lastPage) =>
        lastPage.nextPageToken === '' ? undefined : lastPage.nextPageToken,
    },
  )
}
