import { createRouterTransport } from '@connectrpc/connect'
import { describe, expect, it } from 'vitest'

import { TwinkleService } from '@cosimosi/api-client'

import {
  PaymentUnavailableError,
  chargeTwinkle,
  claimInvite,
  startStorePurchase,
} from './charge.ts'

describe('charge-twinkle api', () => {
  it('sends the store receipt to Charge and returns the verified total (A7)', async () => {
    let received: { packId: string; platform: string; receipt: string } | undefined
    const transport = createRouterTransport(({ service }) => {
      service(TwinkleService, {
        charge(request) {
          received = request
          return { balanceTotal: 250n }
        },
      })
    })

    const total = await chargeTwinkle(transport, {
      packId: 'twinkle_pack_default',
      platform: 'web',
      receipt: 'receipt-1',
    })

    // Credit lands only from the backend's returned total — the FE never credits locally.
    expect(received?.receipt).toBe('receipt-1')
    expect(received?.packId).toBe('twinkle_pack_default')
    expect(total).toBe(250n)
  })

  it('claims an invite and returns the both-sides granted total (A7)', async () => {
    const transport = createRouterTransport(({ service }) => {
      service(TwinkleService, {
        claimInvite(request) {
          return { balanceTotal: request.inviteCode === 'friend-code' ? 600n : 0n }
        },
      })
    })

    expect(await claimInvite(transport, 'friend-code')).toBe(600n)
  })

  it('the store purchase is a deferred seam — it never fabricates a receipt', async () => {
    await expect(startStorePurchase('twinkle_pack_default', 'web')).rejects.toBeInstanceOf(
      PaymentUnavailableError,
    )
  })
})
