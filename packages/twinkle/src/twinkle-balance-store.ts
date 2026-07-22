import { create } from 'zustand'

// The FE mirror of the two-tier Twinkle balance ([G2]): `basic` is the daily-reset
// allowance ([G5] refills it every day, so the HUD is never an empty state), `additional`
// is the permanent carry-over reserve. `total` is a derived display value (basic +
// additional), never a stored field — the basic→additional spend order is the ledger's,
// not the HUD's. Data store (§3.2), populated from twinkle.v1 GetBalance by
// entities/twinkle and refetched on every spend/earn; never advanced client-side, the
// server balance is authoritative. `loaded` distinguishes the pre-fetch blank from a
// server-reported zero so the HUD can hold a placeholder until the first read resolves.
export interface TwinkleBalance {
  readonly basic: bigint
  readonly additional: bigint
}

export interface TwinkleBalanceState extends TwinkleBalance {
  readonly loaded: boolean
  setBalance: (basic: bigint, additional: bigint) => void
  clear: () => void
}

export const useTwinkleBalanceStore = create<TwinkleBalanceState>()((set) => ({
  basic: 0n,
  additional: 0n,
  loaded: false,
  setBalance: (basic, additional) => set({ basic, additional, loaded: true }),
  clear: () => set({ basic: 0n, additional: 0n, loaded: false }),
}))

// total is derived, never stored (A2): the spendable sum of the two tiers. Which tier
// pays first is the ledger's concern, so the HUD only reads the sum.
export function twinkleTotal(balance: TwinkleBalance): bigint {
  return balance.basic + balance.additional
}
