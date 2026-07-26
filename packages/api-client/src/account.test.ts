import { describe, expect, it } from 'vitest'

import {
  AuthProviderKind,
  createAccountClient,
  createAccountMockTransport,
  createGetInviteLinkQueryOptions,
  createGetProfileQueryOptions,
  createListAuthProvidersQueryOptions,
  signUp,
  updateProfile,
  withdraw,
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

  it('updates the complete editable profile and exposes account reads', async () => {
    const received: Array<Record<string, unknown>> = []
    const transport = createAccountMockTransport({
      updateProfile: (request) => {
        received.push({
          nickname: request.nickname,
          timezone: request.timezone,
          locale: request.locale,
        })
        return {
          profile: {
            nickname: request.nickname,
            timezone: request.timezone,
            locale: request.locale,
          },
        }
      },
      listAuthProviders: () => ({
        providers: [{ kind: AuthProviderKind.GOOGLE, linkedAt: '2026-07-26T00:00:00Z' }],
      }),
      getInviteLink: () => ({
        token: 'opaque',
        expiresAt: '2026-08-02T00:00:00Z',
      }),
    })

    await updateProfile(transport, {
      nickname: 'Nova',
      timezone: 'Asia/Seoul',
      locale: 'ko',
    })
    const providers = await createAccountClient(transport).listAuthProviders({})
    const invite = await createAccountClient(transport).getInviteLink({})

    expect(received).toEqual([{ nickname: 'Nova', timezone: 'Asia/Seoul', locale: 'ko' }])
    expect(providers.providers[0]?.kind).toBe(AuthProviderKind.GOOGLE)
    expect(invite.token).toBe('opaque')
    expect(createListAuthProvidersQueryOptions(transport).queryKey).toBeDefined()
    expect(createGetInviteLinkQueryOptions(transport).queryKey).toBeDefined()
  })

  it('withdraws without a client-supplied scope or purge field', async () => {
    let called = 0
    const transport = createAccountMockTransport({
      withdraw: () => {
        called += 1
        return {
          withdrawnAt: '2026-07-26T00:00:00Z',
          restoreDeadlineAt: '2026-08-25T00:00:00Z',
        }
      },
    })

    const response = await withdraw(transport)

    expect(called).toBe(1)
    expect(response.restoreDeadlineAt).toBe('2026-08-25T00:00:00Z')
  })
})
