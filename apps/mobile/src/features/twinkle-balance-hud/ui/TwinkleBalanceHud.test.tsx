import { act, render } from '@testing-library/react-native'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'
import { useTwinkleBalanceStore } from '@cosimosi/twinkle'

import { TwinkleBalanceHud } from './TwinkleBalanceHud.tsx'

// The live half of A1 (the web SSR side pins the initial placeholder): a GetBalance fixture
// renders both tiers distinctly + the derived total, and a refetch updates the figures.
describe('TwinkleBalanceHud (mobile)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
    useTwinkleBalanceStore.getState().clear()
  })

  it('renders basic, additional, and the derived total from a GetBalance fixture (A1)', () => {
    useTwinkleBalanceStore.getState().setBalance(120n, 35n)
    const view = render(<TwinkleBalanceHud />)
    expect(view.getByText('155')).toBeTruthy() // total = 120 + 35, derived
    expect(view.getByText(`${m.twinkle_balance_basic_label()} 120`)).toBeTruthy()
    expect(view.getByText(`${m.twinkle_balance_additional_label()} 35`)).toBeTruthy()
  })

  it('reflects a refetched balance after a spend (A1)', () => {
    useTwinkleBalanceStore.getState().setBalance(120n, 0n)
    const view = render(<TwinkleBalanceHud />)
    expect(view.getByText('120')).toBeTruthy()
    act(() => {
      useTwinkleBalanceStore.getState().setBalance(80n, 0n)
    })
    expect(view.getByText('80')).toBeTruthy()
  })
})
