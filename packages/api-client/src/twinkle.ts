import type { MessageInitShape } from '@bufbuild/protobuf'
import {
  createClient,
  createRouterTransport,
  type Client,
  type Transport,
} from '@connectrpc/connect'
import { createConnectQueryKey, createQueryOptions } from '@connectrpc/connect-query-core'

import {
  GetBalanceResponseSchema,
  QuoteSpendResponseSchema,
  TwinkleService,
  type QuoteSpendRequest,
} from './gen/cosimosi/twinkle/v1/twinkle_pb.ts'

export { SpendKind, TwinkleService } from './gen/cosimosi/twinkle/v1/twinkle_pb.ts'
export type {
  ChargeRequest,
  ChargeResponse,
  ClaimInviteRequest,
  ClaimInviteResponse,
  GetBalanceRequest,
  GetBalanceResponse,
  QuoteSpendRequest,
  QuoteSpendResponse,
} from './gen/cosimosi/twinkle/v1/twinkle_pb.ts'

export function createTwinkleClient(transport: Transport): Client<typeof TwinkleService> {
  return createClient(TwinkleService, transport)
}

export function createTwinkleMockTransport(handlers: {
  getBalance?: () => MessageInitShape<typeof GetBalanceResponseSchema>
  quoteSpend?: (request: QuoteSpendRequest) => MessageInitShape<typeof QuoteSpendResponseSchema>
}): Transport {
  return createRouterTransport(({ service }) => {
    service(TwinkleService, {
      getBalance() {
        return handlers.getBalance?.() ?? {}
      },
      quoteSpend(request) {
        return handlers.quoteSpend?.(request) ?? {}
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
