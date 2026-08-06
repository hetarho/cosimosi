import { fireEvent, render } from '@testing-library/react-native'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'
import { gistViewSpend, recallSpend } from '@cosimosi/twinkle'
import { useSpendQuote } from '@cosimosi/twinkle/react'

import { SpendCostDisplay } from './SpendCostDisplay.tsx'

// The quote hook is mocked so the display renders a fixed server quote and the branches can
// be pressed live. A4/A9: a covered quote reaches proceed and issues NO spend call (the
// display returns a decision only); a shortfall offers charge instead of dead-ending.
jest.mock('@cosimosi/twinkle/react', () => ({ useSpendQuote: jest.fn() }))

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
    const onEarn = jest.fn()
    const fetchSpy = jest.spyOn(globalThis, 'fetch')

    const view = render(
      <SpendCostDisplay
        pending={recallSpend('memory-1')}
        onProceed={onProceed}
        onCancel={jest.fn()}
        onEarn={onEarn}
      />,
    )

    expect(view.getByText('8')).toBeTruthy() // the server figure, verbatim
    fireEvent.press(view.getByText(m.twinkle_cost_proceed()))
    expect(onProceed).toHaveBeenCalledTimes(1)
    expect(onEarn).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled() // returns a decision; never spends
    fetchSpy.mockRestore()
  })

  it('a shortfall offers charge, not proceed (A4)', () => {
    mockUseSpendQuote.mockReturnValue({
      data: { cost: 40n, covered: false, shortfall: 13n },
      isError: false,
    })
    const onProceed = jest.fn()
    const onEarn = jest.fn()

    const view = render(
      <SpendCostDisplay
        pending={recallSpend('memory-1')}
        onProceed={onProceed}
        onCancel={jest.fn()}
        onEarn={onEarn}
      />,
    )

    expect(view.getByText('13')).toBeTruthy() // the shortfall amount
    fireEvent.press(view.getByText(m.twinkle_cost_earn()))
    expect(onEarn).toHaveBeenCalledTimes(1)
    expect(onProceed).not.toHaveBeenCalled()
  })

  it('passes a gist target through the shared quote surface, naming no depth', () => {
    mockUseSpendQuote.mockReturnValue({
      data: { cost: 3n, covered: true, shortfall: 0n },
      isError: false,
    })

    render(
      <SpendCostDisplay
        pending={gistViewSpend('memory-1')}
        onProceed={jest.fn()}
        onCancel={jest.fn()}
        onEarn={jest.fn()}
      />,
    )

    // The target and nothing else — the rung it is priced at is the memory's own, derived by the
    // server for the quote and the read alike, so the client cannot ask to be quoted cheaper.
    expect(mockUseSpendQuote).toHaveBeenCalledWith({
      kind: expect.anything(),
      episodicMemoryId: 'memory-1',
    })
  })
})
