import { describe, expect, it } from 'vitest'

import {
  createAccountClient,
  createAccountMockTransport,
  createGetProfileQueryOptions,
  signUp,
} from './account.ts'

describe('account client helpers', () => {
  it('represents an absent profile as an unset response field', async () => {
    const transport = createAccountMockTransport({})
    const response = await createAccountClient(transport).getProfile({})

    expect(response.profile).toBeUndefined()
    expect(createGetProfileQueryOptions(transport).queryKey).toBeDefined()
  })

  it('sends exactly the signup profile fields and held invite token', async () => {
    let received: Record<string, unknown> | undefined
    const transport = createAccountMockTransport({
      signUp: (request) => {
        received = {
          nickname: request.nickname,
          timezone: request.timezone,
          locale: request.locale,
          inviteToken: request.inviteToken,
        }
        return {
          nickname: request.nickname,
          timezone: request.timezone,
          locale: request.locale,
          inviteBound: false,
        }
      },
    })

    await signUp(transport, {
      nickname: 'Nova',
      timezone: 'UTC',
      locale: 'en',
      inviteToken: 'opaque',
    })

    expect(received).toEqual({
      nickname: 'Nova',
      timezone: 'UTC',
      locale: 'en',
      inviteToken: 'opaque',
    })
    expect(received).not.toHaveProperty('userId')
    expect(received).not.toHaveProperty('provider')
    expect(received).not.toHaveProperty('amount')
    expect(received).not.toHaveProperty('memory')
    expect(received).not.toHaveProperty('palette')
  })
})
