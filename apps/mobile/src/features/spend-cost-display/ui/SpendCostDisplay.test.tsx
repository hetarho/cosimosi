import { fireEvent, render } from '@testing-library/react-native'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'

import { recallSpend } from '../model/pending-spend.ts'
import { SpendCostDisplay } from './SpendCostDisplay.tsx'

// The quote hook is mocked so the display renders a fixed server quote and the branches can
// be pressed live. A4/A9: a covered quote reaches proceed and issues NO spend call (the
// display returns a decision only); a shortfall offers charge instead of dead-ending.
jest.mock('../api/quote-spend.ts', () => ({ useSpendQuote: jest.fn() }))
import { useSpendQuote } from '../api/quote-spend.ts'

const mockUseSpendQuote = useSpendQuote as jest.Mock

describe('SpendCostDisplay (mobile)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
    mockUseSpendQuote.mockReset()
  })

  it('a covered quote reaches proceed and issues no spend call (A4/A9)', () => {
    mockUseSpendQuote.mockReturnValue({
      data: { cost: 8n, covered: true, shortfall: 0n },
      isError: false,
    })
    const onProceed = jest.fn()
    const onCharge = jest.fn()
    const fetchSpy = jest.spyOn(globalThis, 'fetch')

    const view = render(
      <SpendCostDisplay
        pending={recallSpend('memory-1')}
        onProceed={onProceed}
        onCancel={jest.fn()}
        onCharge={onCharge}
      />,
    )

    expect(view.getByText('8')).toBeTruthy() // the server figure, verbatim
    fireEvent.press(view.getByText(m.twinkle_cost_proceed()))
    expect(onProceed).toHaveBeenCalledTimes(1)
    expect(onCharge).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled() // returns a decision; never spends
    fetchSpy.mockRestore()
  })

  it('a shortfall offers charge, not proceed (A4)', () => {
    mockUseSpendQuote.mockReturnValue({
      data: { cost: 40n, covered: false, shortfall: 13n },
      isError: false,
    })
    const onProceed = jest.fn()
    const onCharge = jest.fn()

    const view = render(
      <SpendCostDisplay
        pending={recallSpend('memory-1')}
        onProceed={onProceed}
        onCancel={jest.fn()}
        onCharge={onCharge}
      />,
    )

    expect(view.getByText('13')).toBeTruthy() // the shortfall amount
    fireEvent.press(view.getByText(m.twinkle_cost_charge()))
    expect(onCharge).toHaveBeenCalledTimes(1)
    expect(onProceed).not.toHaveBeenCalled()
  })
})
