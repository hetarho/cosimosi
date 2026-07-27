// @vitest-environment jsdom

import { useState } from 'react'
import { renderToString } from 'react-dom/server'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  defaultLocale,
  LocaleRenderBoundary,
  m,
  setActiveLocale,
  subscribeLocale,
} from '../../shared/i18n/index.ts'

import { WebI18nProvider } from './i18n-provider.tsx'

describe('WebI18nProvider', () => {
  afterEach(() => {
    cleanup()
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

  it('re-renders mounted message copy after the active locale changes', () => {
    setActiveLocale('en')
    render(
      <WebI18nProvider locale="en">
        <LocaleRenderBoundary>{() => <MessageProbe />}</LocaleRenderBoundary>
      </WebI18nProvider>,
    )
    expect(screen.getByText('You')).toBeTruthy()
    expect(screen.getByText('Profile')).toBeTruthy()
    expect(screen.getByText('Retry')).toBeTruthy()

    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('1')).toBeTruthy()

    act(() => setActiveLocale('ko'))

    expect(screen.getByText('나')).toBeTruthy()
    expect(screen.getByText('프로필')).toBeTruthy()
    expect(screen.getByText('다시 시도')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
  })
})

function MessageProbe() {
  const [count, setCount] = useState(0)
  return (
    <>
      <span>{m.me_title()}</span>
      <span>{m.me_tab_profile()}</span>
      <span>{m.common_retry()}</span>
      <button type="button" onClick={() => setCount((current) => current + 1)}>
        {count}
      </button>
    </>
  )
}
