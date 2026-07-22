import { createTwinkleClient, type ApiTransport } from '@cosimosi/api-client'

// The deferred store-purchase seam: v1 ships the earn contract (Charge) but not the
// platform store SDK (store-integration deferred), so the FE never fabricates a receipt
// to credit locally ([G3] — production value is granted only by the backend after it
// verifies a real receipt). Rejecting with this — rather than inventing a receipt — keeps
// the pay path honest until the real adapter is bound.
export class PaymentUnavailableError extends Error {
  constructor(packId: string, platform: string) {
    super(`store purchase for pack "${packId}" on ${platform} is not available in this build`)
    this.name = 'PaymentUnavailableError'
  }
}

// In production this drives the platform store SDK and resolves the verified receipt for
// the pack; it is unbound in v1, so it rejects. The pay path surfaces the tier + CTA, but
// a purchase completes only once the real store adapter replaces this seam.
export async function startStorePurchase(packId: string, platform: string): Promise<string> {
  throw new PaymentUnavailableError(packId, platform)
}

// features/charge-twinkle api: send a store receipt to twinkle.v1 Charge ([G3]). The FE
// never credits locally — the backend verifies the receipt and returns the new total; the
// sheet refetches GetBalance on success so the credit shows.
export async function chargeTwinkle(
  transport: ApiTransport,
  request: { packId: string; platform: string; receipt: string },
): Promise<bigint> {
  const response = await createTwinkleClient(transport).charge(request)
  return response.balanceTotal
}

// Redeem an inviter's code via twinkle.v1 ClaimInvite: the both-sides grant lands on a
// valid signup (the anti-abuse gate [G6] is the server's); the sheet refetches GetBalance
// so the credit shows.
export async function claimInvite(transport: ApiTransport, inviteCode: string): Promise<bigint> {
  const response = await createTwinkleClient(transport).claimInvite({ inviteCode })
  return response.balanceTotal
}
