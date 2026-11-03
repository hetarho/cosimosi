import { act, fireEvent, render } from '@testing-library/react-native'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'
import { useTwinkleBalanceStore } from '@cosimosi/twinkle'

import { BalanceHud } from './BalanceHud.tsx'

// The live half of A1 (the web SSR side pins the initial placeholder): a GetBalance fixture renders
// both tiers distinctly, and a refetch updates the figures. The fixture uses two different numbers so
// a pill that lost its per-kind binding cannot pass. The glance is figures only; the names live in
// the panel the reading opens (TWINK-32).
describe('BalanceHud (mobile)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
    useTwinkleBalanceStore.getState().clear()
  })

  it('shows both figures, and pressing them opens the panel (A1)', () => {
    useTwinkleBalanceStore.getState().setBalance(120n, 35n)
    const onOpenDetail = jest.fn()
    const view = render(<BalanceHud onOpenDetail={onOpenDetail} />)
    // The glance is figures only — the glyphs carry which kind is which.
    expect(view.getByText('120')).toBeTruthy()
    expect(view.getByText('35')).toBeTruthy()
    expect(view.queryByText(m.twinkle_balance_small_label())).toBeNull()

    fireEvent.press(view.getByRole('button', { name: m.twinkle_balance_title() }))
    expect(onOpenDetail).toHaveBeenCalledTimes(1)
  })

  it('reflects a refetched balance after a spend (A1)', () => {
    useTwinkleBalanceStore.getState().setBalance(120n, 0n)
    const view = render(<BalanceHud />)
    expect(view.getByText('120')).toBeTruthy()
    act(() => {
      useTwinkleBalanceStore.getState().setBalance(80n, 0n)
    })
    expect(view.getByText('80')).toBeTruthy()
  })
})
