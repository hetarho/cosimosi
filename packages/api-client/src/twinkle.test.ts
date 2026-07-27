import { describe, expect, it } from 'vitest'

import {
  SpendKind,
  TwinkleService,
  createGetBalanceQueryKey,
  createGetBalanceQueryOptions,
  createQuoteSpendQueryKey,
  createTwinkleClient,
  createTwinkleMockTransport,
  createTwinkleServiceQueryKey,
} from './twinkle.ts'

describe('twinkle transport facade', () => {
  it('calls TwinkleService.GetBalance and QuoteSpend through an in-memory transport', async () => {
    let quotedStage = 0
    const transport = createTwinkleMockTransport({
      getBalance: () => ({ basic: 100n, additional: 40n, total: 140n }),
      quoteSpend: (request) => {
        quotedStage = request.semanticStage
        return {
          cost: request.kind === SpendKind.RECALL ? 15n : 3n,
          covered: true,
          shortfall: 0n,
        }
      },
    })
    const client = createTwinkleClient(transport)

    const balance = await client.getBalance({})
    expect(balance.total).toBe(140n)

    const quote = await client.quoteSpend({ kind: SpendKind.RECALL, episodicMemoryId: 'memory-1' })
    expect(quote.cost).toBe(15n)
    expect(quote.covered).toBe(true)

    await client.quoteSpend({
      kind: SpendKind.GIST_VIEW,
      episodicMemoryId: 'memory-1',
      semanticStage: 2,
    })
    expect(quotedStage).toBe(2)
  })

  it('marks every method NO_SIDE_EFFECTS — the contract is read-only by design', () => {
    // 1 = google.protobuf.MethodOptions.NO_SIDE_EFFECTS (the client-cache policy
    // interceptor's GET-eligibility constant). Twinkle moves as a consequence of a memory action,
    // a purchase or a claim — never as a user step of its own — so there is nothing here to mutate.
    expect(TwinkleService.method.getBalance.idempotency).toBe(1)
    expect(TwinkleService.method.quoteSpend.idempotency).toBe(1)
    expect(TwinkleService.method.getLedger.idempotency).toBe(1)
    expect(Object.keys(TwinkleService.method)).toEqual(['getBalance', 'quoteSpend', 'getLedger'])
  })

  it('creates TanStack Query options for GetBalance without React or app globals', () => {
    const transport = createTwinkleMockTransport({ getBalance: () => ({ total: 0n }) })
    const options = createGetBalanceQueryOptions(transport)

    expect(options.queryKey[0]).toBe('connect-query')
    expect(typeof options.queryFn).toBe('function')
    expect(options.queryKey).toEqual(createGetBalanceQueryKey(transport))
    expect(createTwinkleServiceQueryKey()[1].serviceName).toContain('TwinkleService')
    expect(
      createQuoteSpendQueryKey({ kind: SpendKind.RECALL, episodicMemoryId: 'memory-1' })[1]
        .serviceName,
    ).toContain('TwinkleService')
    expect(
      createQuoteSpendQueryKey({
        kind: SpendKind.GIST_VIEW,
        episodicMemoryId: 'memory-1',
        semanticStage: 2,
      }),
    ).not.toEqual(
      createQuoteSpendQueryKey({
        kind: SpendKind.GIST_VIEW,
        episodicMemoryId: 'memory-1',
        semanticStage: 3,
      }),
    )
  })
})
