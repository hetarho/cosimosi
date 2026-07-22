import { afterEach, describe, expect, it } from 'vitest'

import { requestTimeSyncConsent, useTimeSyncConsentStore } from './time-sync-consent-store.ts'

describe('time-sync consent contract', () => {
  afterEach(() => {
    // Drain any pending request so a module-level deferred can't leak across tests.
    useTimeSyncConsentStore.getState().settle('cancel')
  })

  it('parks a pending request the modal host can observe', () => {
    expect(useTimeSyncConsentStore.getState().pending).toBeNull()
    void requestTimeSyncConsent()
    expect(useTimeSyncConsentStore.getState().pending).not.toBeNull()
  })

  it('resolves 예 → proceed and clears the request', async () => {
    const decision = requestTimeSyncConsent()
    useTimeSyncConsentStore.getState().settle('proceed')
    await expect(decision).resolves.toBe('proceed')
    expect(useTimeSyncConsentStore.getState().pending).toBeNull()
  })

  it('resolves 아니오 → cancel', async () => {
    const decision = requestTimeSyncConsent()
    useTimeSyncConsentStore.getState().settle('cancel')
    await expect(decision).resolves.toBe('cancel')
  })

  it('shares one decision when asked twice while the modal is open', async () => {
    const first = requestTimeSyncConsent()
    const second = requestTimeSyncConsent()
    useTimeSyncConsentStore.getState().settle('proceed')
    await expect(first).resolves.toBe('proceed')
    await expect(second).resolves.toBe('proceed')
  })

  it('ignores a settle with nothing pending', () => {
    expect(() => useTimeSyncConsentStore.getState().settle('cancel')).not.toThrow()
  })
})
