import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'

import { defaultLocale, setActiveLocale, subscribeLocale } from '@cosimosi/i18n'

import { WebI18nProvider } from './i18n-provider.tsx'

describe('WebI18nProvider', () => {
  afterEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('does not notify locale subscribers during render', () => {
    let notifications = 0
    const unsubscribe = subscribeLocale(() => {
      notifications += 1
    })

    try {
      renderToString(
        <WebI18nProvider locale="ko">
          <span>probe</span>
        </WebI18nProvider>,
      )

      expect(notifications).toBe(0)
    } finally {
      unsubscribe()
    }
  })
})
