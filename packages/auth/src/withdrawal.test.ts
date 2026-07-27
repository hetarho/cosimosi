import { describe, expect, it, vi } from 'vitest'

import { commitWithdrawalAndEndSession } from './withdrawal.ts'

describe('commitWithdrawalAndEndSession', () => {
  it('does not touch the session when withdrawal itself fails', async () => {
    const signOut = vi.fn(async () => {})
    const forceLocalSignOut = vi.fn()

    await expect(
      commitWithdrawalAndEndSession(
        async () => {
          throw new Error('withdrawal failed')
        },
        { signOut, forceLocalSignOut },
      ),
    ).rejects.toThrow('withdrawal failed')
    expect(signOut).not.toHaveBeenCalled()
    expect(forceLocalSignOut).not.toHaveBeenCalled()
  })

  it('uses normal sign-out after a committed withdrawal', async () => {
    const signOut = vi.fn(async () => {})
    const forceLocalSignOut = vi.fn()

    await commitWithdrawalAndEndSession(async () => {}, { signOut, forceLocalSignOut })

    expect(signOut).toHaveBeenCalledOnce()
    expect(forceLocalSignOut).not.toHaveBeenCalled()
  })

  it('falls back to local teardown without failing the committed withdrawal', async () => {
    const signOut = vi.fn(async () => {
      throw new Error('network unavailable')
    })
    const forceLocalSignOut = vi.fn()

    await expect(
      commitWithdrawalAndEndSession(async () => {}, { signOut, forceLocalSignOut }),
    ).resolves.toBeUndefined()
    expect(forceLocalSignOut).toHaveBeenCalledOnce()
  })
})
