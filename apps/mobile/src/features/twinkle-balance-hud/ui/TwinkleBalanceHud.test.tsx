import { act, fireEvent, render } from '@testing-library/react-native'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'
import { useTwinkleBalanceStore } from '@cosimosi/twinkle'

import { TwinkleBalanceHud } from './TwinkleBalanceHud.tsx'

// The live half of A1 (the web SSR side pins the initial placeholder): a GetBalance fixture renders
// both tiers distinctly, and a refetch updates the figures. The fixture uses two different numbers so
// a pill that lost its per-kind binding cannot pass, and the labels are asserted through the
// disclosure — collapsed, the glance is figures only.
describe('TwinkleBalanceHud (mobile)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
    useTwinkleBalanceStore.getState().clear()
  })

  it('shows both figures collapsed, and names them once expanded (A1)', () => {
    useTwinkleBalanceStore.getState().setBalance(120n, 35n)
    const view = render(<TwinkleBalanceHud />)
    // Collapsed, the glance is figures only — the glyphs carry which kind is which.
    expect(view.getByText('120')).toBeTruthy()
    expect(view.getByText('35')).toBeTruthy()
    expect(view.queryByText(m.twinkle_balance_small_label())).toBeNull()

    fireEvent.press(view.getByRole('button', { name: m.twinkle_balance_title() }))
    expect(view.getByText(m.twinkle_balance_small_label())).toBeTruthy()
    expect(view.getByText(m.twinkle_balance_general_label())).toBeTruthy()
    // The figures stay put — expanding adds each label beside its own figure, it does not repeat them.
    expect(view.getByText('120')).toBeTruthy()
    expect(view.getByText('35')).toBeTruthy()
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
