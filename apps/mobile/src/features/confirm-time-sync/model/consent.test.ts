import { requestTimeSyncConsent, useTimeSyncConsentStore } from './consent.ts'

// The [R1a] consent contract, pinned on mobile's byte-for-byte fork of the store (web pins the same
// contract). The store holds one shared deferred so a modal host can observe a pending decision and
// resolve it once; a settle with nothing pending is a no-op.
describe('time-sync consent contract', () => {
  afterEach(() => {
    // Drain any pending request so a module-level deferred can't leak across tests.
    useTimeSyncConsentStore.getState().settle('cancel')
  })

  it('parks a pending request the modal host can observe', async () => {
    expect(useTimeSyncConsentStore.getState().pending).toBeNull()
    const decision = requestTimeSyncConsent()
    expect(useTimeSyncConsentStore.getState().pending).not.toBeNull()
    useTimeSyncConsentStore.getState().settle('cancel')
    await decision
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
