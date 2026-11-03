import { fireEvent, render } from '@testing-library/react-native'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'
import { useTwinkleBalanceStore } from '@cosimosi/twinkle'

import { TwinkleDetailSheet } from './TwinkleDetailSheet.tsx'

// TWINK-32 on mobile: the panel the balance reading opens carries the same three parts as the web
// one, in the reader's question order — what is held, the way to get more (present but disabled, its
// reason beside it), then how it gathers.
describe('TwinkleDetailSheet (mobile)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
    useTwinkleBalanceStore.getState().clear()
    useTwinkleBalanceStore.getState().setBalance(120n, 35n)
  })

  it('reads held figures, then the disabled way to get more, then the earn guide', () => {
    const view = render(
      <TwinkleDetailSheet open onOpenAchievements={jest.fn()} onClose={jest.fn()} />,
    )
    const text = JSON.stringify(view.toJSON())
    const held = text.indexOf(m.twinkle_detail_held_label())
    const charge = text.indexOf(m.twinkle_charge_action())
    const earn = text.indexOf(m.twinkle_earn_title())
    expect(held).toBeGreaterThan(-1)
    expect(held).toBeLessThan(charge)
    expect(charge).toBeLessThan(earn)
    // The held figures are named, both kinds, with no total.
    expect(view.getByText(m.twinkle_balance_small_label())).toBeTruthy()
    // The general kind's name is also the panel's own title, so it appears twice.
    expect(view.getAllByText(m.twinkle_balance_general_label()).length).toBeGreaterThan(0)
    expect(view.getByText('120')).toBeTruthy()
    expect(view.getByText('35')).toBeTruthy()
  })

  it('keeps the way to get more present but disabled, with its reason beside it', () => {
    const view = render(
      <TwinkleDetailSheet open onOpenAchievements={jest.fn()} onClose={jest.fn()} />,
    )
    const charge = view.getByRole('button', { name: m.twinkle_charge_action() })
    expect(charge.props.accessibilityState).toMatchObject({ disabled: true })
    expect(view.getByText(m.twinkle_charge_unavailable())).toBeTruthy()
  })

  it('leads the earn guide to the achievements and closes on dismiss', () => {
    const onOpenAchievements = jest.fn()
    const onClose = jest.fn()
    const view = render(
      <TwinkleDetailSheet open onOpenAchievements={onOpenAchievements} onClose={onClose} />,
    )
    fireEvent.press(view.getByText(m.twinkle_earn_achievement_action()))
    expect(onOpenAchievements).toHaveBeenCalledTimes(1)
    fireEvent.press(view.getByLabelText(m.common_dismiss()))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
