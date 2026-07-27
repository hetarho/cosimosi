import { type ApiTransport } from '@cosimosi/api-client'

// Two earn affordances the sheet still renders and this build cannot complete. Both reject rather
// than fabricate, because a client that invents value is worse than a client that says no.

// Payment (스토어/PG) is deferred to v3 (PRD §8.3): the server contract is gone, and the platform
// store SDK was never bound. Rejecting here — rather than inventing a receipt to credit locally —
// keeps the pay path honest until a real adapter exists.
export class PaymentUnavailableError extends Error {
  constructor(packId: string, platform: string) {
    super(`store purchase for pack "${packId}" on ${platform} is not available in this build`)
    this.name = 'PaymentUnavailableError'
  }
}

// In production this would drive the platform store SDK and resolve a verified receipt; nothing binds
// it, so it rejects.
export async function startStorePurchase(packId: string, platform: string): Promise<string> {
  throw new PaymentUnavailableError(packId, platform)
}

// An invite is LINK-BOUND ([U8]): the user never types a code, and the both-sides credit is settled
// server-side when the invited friend's signup settles. So there is no redemption RPC to call — a
// typed code has nowhere to go, and saying so is more honest than a silent no-op.
export class InviteRedemptionUnavailableError extends Error {
  constructor() {
    super('an invite is redeemed by following its link, not by entering a code')
    this.name = 'InviteRedemptionUnavailableError'
  }
}

export async function redeemInvite(_transport: ApiTransport, _inviteCode: string): Promise<bigint> {
  throw new InviteRedemptionUnavailableError()
}
