import { describe, expect, it } from 'vitest'

import { createTwinkleMockTransport } from '@cosimosi/api-client'

import {
  InviteRedemptionUnavailableError,
  PaymentUnavailableError,
  redeemInvite,
  startStorePurchase,
} from './charge.ts'

describe('charge-twinkle api', () => {
  it('the store purchase is a deferred seam — it never fabricates a receipt', async () => {
    await expect(startStorePurchase('twinkle_pack_default', 'web')).rejects.toBeInstanceOf(
      PaymentUnavailableError,
    )
  })

  it('an invite code has nowhere to go — an invite is redeemed by its link ([U8])', async () => {
    await expect(
      redeemInvite(createTwinkleMockTransport({}), 'friend-code'),
    ).rejects.toBeInstanceOf(InviteRedemptionUnavailableError)
  })
})
