import { create } from 'zustand'

// The FE mirror of the two-kind Twinkle balance ([G2]): `small` is the recall-only daily
// allowance ([G5] refills it on the user's own calendar day, so the HUD is never an empty
// state), `general` is the universal permanent reserve. `total` is a derived display value
// (small + general), never a stored field — which kind pays first is the ledger's concern,
// not the HUD's. Data store (§3.2), populated from twinkle.v1 GetBalance by
// entities/twinkle and refetched on every spend/earn; never advanced client-side, the
// server balance is authoritative. `loaded` distinguishes the pre-fetch blank from a
// server-reported zero so the HUD can hold a placeholder until the first read resolves.
export interface TwinkleBalance {
  readonly small: bigint
  readonly general: bigint
}

export interface TwinkleBalanceState extends TwinkleBalance {
  readonly loaded: boolean
  setBalance: (small: bigint, general: bigint) => void
  clear: () => void
}

export const useTwinkleBalanceStore = create<TwinkleBalanceState>()((set) => ({
  small: 0n,
  general: 0n,
  loaded: false,
  setBalance: (small, general) => set({ small, general, loaded: true }),
  clear: () => set({ small: 0n, general: 0n, loaded: false }),
}))

// total is derived, never stored (A2): the spendable sum of the two kinds. Which kind pays
// first is the ledger's concern, so the HUD only reads the sum.
export function twinkleTotal(balance: TwinkleBalance): bigint {
  return balance.small + balance.general
}
