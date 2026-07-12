import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'

import { m } from '../../../shared/i18n/index.ts'
import { RecallResult } from './RecallResult.tsx'

// A6/A7: the result reflects the server branch. Reconsolidated shows the newly-kept text (distortion
// unannounced, A12); reinforced states plainly that nothing changed.
describe('RecallResult', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('reconsolidated shows the new current text without announcing distortion', () => {
    const html = renderToString(
      createElement(RecallResult, {
        outcome: 'reconsolidated',
        currentText: 'a reworded afternoon',
      }),
    )
    expect(html).toContain('a reworded afternoon')
    expect(html).toContain(m.recall_result_reconsolidated())
  })

  it('reinforced states plainly that nothing changed', () => {
    const html = renderToString(
      createElement(RecallResult, { outcome: 'reinforced', currentText: 'ignored' }),
    )
    expect(html).toContain(m.recall_result_reinforced())
    expect(html).not.toContain('ignored')
  })
})
