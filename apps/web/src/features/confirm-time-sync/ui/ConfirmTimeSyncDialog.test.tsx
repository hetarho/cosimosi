import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'
import { m } from '@cosimosi/i18n'

import { requestTimeSyncConsent, useTimeSyncConsentStore } from '../model/consent.ts'
import { ConfirmTimeSyncDialog } from './ConfirmTimeSyncDialog.tsx'

// The web half of the [R1a] consent contract. The dialog body mounts through a DOM portal, which
// the SSR-string harness cannot host — the mobile ConfirmTimeSyncDialog.test.tsx renders it live
// and presses both decisions; this side pins what is testable without a DOM: the closed state, the
// consent copy the component resolves (the consequence stated verbatim, PRD §3.1 voice), and that
// a full request → settle round trip performs no transport call.
describe('ConfirmTimeSyncDialog (web)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })
  afterEach(() => {
    useTimeSyncConsentStore.getState().settle('cancel')
    vi.restoreAllMocks()
  })

  it('renders nothing while closed', () => {
    const html = renderToString(
      createElement(ConfirmTimeSyncDialog, { open: false, onAccept: () => {}, onReject: () => {} }),
    )
    expect(html).toBe('')
  })

  it('states the consequence and offers 예 / 아니오 in the ko copy', () => {
    setActiveLocale('ko')
    expect(m.universe_time_sync_consent_body()).toBe(
      '회상하려면 우주 시간을 오늘로 맞춰야 해요. 그 사이 안 쓴 과거 날짜의 일기는 이후 추가할 수 없게 됩니다. 진행할까요?',
    )
    expect(m.universe_time_sync_accept()).toBe('예')
    expect(m.universe_time_sync_reject()).toBe('아니오')
  })

  it('resolves both decisions without any transport call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const proceed = requestTimeSyncConsent()
    useTimeSyncConsentStore.getState().settle('proceed')
    await expect(proceed).resolves.toBe('proceed')

    const cancel = requestTimeSyncConsent()
    useTimeSyncConsentStore.getState().settle('cancel')
    await expect(cancel).resolves.toBe('cancel')

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
