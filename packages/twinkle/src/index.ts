import { useEarnRequestStore } from './earn-request-store.ts'
import { useTwinkleBalanceStore } from './twinkle-balance-store.ts'

export { useEarnRequestStore, type EarnRequestState } from './earn-request-store.ts'
export {
  groupLedgerByDay,
  todayRefillMarker,
  type LedgerDay,
  type RefillMarker,
} from './ledger-day.ts'
export { diaryRecallSpend, gistViewSpend, recallSpend, type PendingSpend } from './pending-spend.ts'
export {
  twinkleTotal,
  useTwinkleBalanceStore,
  type TwinkleBalance,
  type TwinkleBalanceState,
} from './twinkle-balance-store.ts'

export function resetTwinkleUserState(): void {
  useTwinkleBalanceStore.getState().clear()
  useEarnRequestStore.getState().clear()
}
