import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'

import { gistViewSpend, recallSpend } from '../model/pending-spend.ts'
import { SpendCostDisplay } from './SpendCostDisplay.tsx'

// The quote hook is mocked so the display renders a fixed server quote with no transport —
// the display renders the figure verbatim and never prices (A3). SSR can't click, so the
// coverage/shortfall branches are asserted by which affordances render; the "never calls
// spend" guarantee is structural (the feature imports no spend RPC — see the boundary audit).
vi.mock('../api/quote-spend.ts', () => ({ useSpendQuote: vi.fn() }))
import { useSpendQuote } from '../api/quote-spend.ts'

const mockUseSpendQuote = vi.mocked(useSpendQuote)

function render() {
  return renderToString(
    createElement(SpendCostDisplay, {
      pending: recallSpend('memory-1'),
      onProceed: () => {},
      onCancel: () => {},
      onCharge: () => {},
    }),
  )
}

describe('SpendCostDisplay (web)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
    mockUseSpendQuote.mockReset()
  })

  it('renders the server cost figure verbatim (A3 — the FE never prices)', () => {
    mockUseSpendQuote.mockReturnValue({
      data: { cost: 17n, covered: true, shortfall: 0n },
      isError: false,
    } as ReturnType<typeof useSpendQuote>)
    expect(render()).toContain('17')
  })

  it('a covered quote reaches the proceed path with no shortfall/charge (A9)', () => {
    mockUseSpendQuote.mockReturnValue({
      data: { cost: 8n, covered: true, shortfall: 0n },
      isError: false,
    } as ReturnType<typeof useSpendQuote>)
    const html = render()
    expect(html).toContain(m.twinkle_cost_proceed())
    expect(html).not.toContain(m.twinkle_cost_charge())
  })

  it('a shortfall shows the amount short and offers charge instead of dead-ending (A4)', () => {
    mockUseSpendQuote.mockReturnValue({
      data: { cost: 40n, covered: false, shortfall: 13n },
      isError: false,
    } as ReturnType<typeof useSpendQuote>)
    const html = render()
    expect(html).toContain('13') // the shortfall amount
    expect(html).toContain(m.twinkle_cost_charge())
    expect(html).not.toContain(m.twinkle_cost_proceed())
  })

  it('prices a gist-view through the same display from its own quote (A3/A5)', () => {
    mockUseSpendQuote.mockReturnValue({
      data: { cost: 3n, covered: true, shortfall: 0n },
      isError: false,
    } as ReturnType<typeof useSpendQuote>)
    const html = renderToString(
      createElement(SpendCostDisplay, {
        pending: gistViewSpend('memory-1'),
        onProceed: () => {},
        onCancel: () => {},
        onCharge: () => {},
      }),
    )
    expect(html).toContain('3')
    expect(html).toContain(m.twinkle_cost_gist_label())
  })
})
