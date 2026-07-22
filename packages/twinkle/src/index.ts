import { useChargeRequestStore } from './charge-request-store.ts'
import { useTwinkleBalanceStore } from './twinkle-balance-store.ts'

export {
  PaymentUnavailableError,
  chargeTwinkle,
  claimInvite,
  startStorePurchase,
} from './charge.ts'
export { useChargeRequestStore, type ChargeRequestState } from './charge-request-store.ts'
export { CHARGE_PACK } from './pack.ts'
export { diaryRecallSpend, gistViewSpend, recallSpend, type PendingSpend } from './pending-spend.ts'
export {
  twinkleTotal,
  useTwinkleBalanceStore,
  type TwinkleBalance,
  type TwinkleBalanceState,
} from './twinkle-balance-store.ts'

export function resetTwinkleUserState(): void {
  useTwinkleBalanceStore.getState().clear()
  useChargeRequestStore.getState().clear()
}
