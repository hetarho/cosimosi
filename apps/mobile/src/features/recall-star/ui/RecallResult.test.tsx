import { render } from '@testing-library/react-native'

import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'

import { m } from '../../../shared/i18n/index.ts'
import { RecallResult } from './RecallResult.tsx'

// A6/A7, RN fork: reconsolidated shows the newly-kept text (distortion unannounced); reinforced
// states plainly that nothing changed. Same invariant as the web RecallResult test.
describe('RecallResult (mobile)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('reconsolidated shows the new current text', () => {
    const view = render(
      <RecallResult outcome="reconsolidated" currentText="a reworded afternoon" />,
    )
    expect(view.getByText('a reworded afternoon')).toBeTruthy()
    expect(view.getByText(m.recall_result_reconsolidated())).toBeTruthy()
  })

  it('reinforced states plainly that nothing changed', () => {
    const view = render(<RecallResult outcome="reinforced" currentText="ignored" />)
    expect(view.getByText(m.recall_result_reinforced())).toBeTruthy()
    expect(view.queryByText('ignored')).toBeNull()
  })
})
