import { VALUES } from '@cosimosi/config'

// The one v1 pack projects its generated grant together with the backend-recognized identity.
export const CHARGE_PACK = {
  id: 'twinkle_pack_default',
  amount: VALUES.twinkle.chargePack,
} as const
