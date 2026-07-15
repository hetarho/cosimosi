import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'

import { WriteEarnFeedback } from './WriteEarnFeedback.tsx'

describe('WriteEarnFeedback (web)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('renders the restrained write-earn confirmation with the earned amount (A7)', () => {
    const html = renderToString(
      createElement(WriteEarnFeedback, { amount: 100, onDismiss: () => {} }),
    )
    expect(html).toContain(m.twinkle_write_earn_notice())
    expect(html).toContain('100')
  })
})
