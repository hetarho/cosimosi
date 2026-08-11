import { render } from '@testing-library/react-native'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'

import { RecallDiaryStarsAction } from './RecallDiaryStarsAction.tsx'

// The action offers the jump whenever the diary has a still-live star and blocks it otherwise (a
// live memory is always priced above zero, so membership alone decides — no per-row quote).
function disabledState(liveCount: number): boolean {
  const view = render(<RecallDiaryStarsAction liveCount={liveCount} onInitiate={jest.fn()} />)
  return Boolean(view.getByRole('button').props.accessibilityState?.disabled)
}

describe('RecallDiaryStarsAction (mobile)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('offers the jump when the diary has a live star', () => {
    expect(disabledState(2)).toBe(false)
  })

  it('is disabled when the diary has no live star', () => {
    expect(disabledState(0)).toBe(true)
  })

  it('marks itself as the one door that spends, and still quotes no amount ([D11])', () => {
    const view = render(<RecallDiaryStarsAction liveCount={2} onInitiate={jest.fn()} />)
    expect(view.getByText(m.twinkle_balance_general_label())).toBeTruthy()
    // No price: the quote belongs to the jump dialog, never to a row.
    expect(view.queryByText(/\d/)).toBeNull()
  })
})
