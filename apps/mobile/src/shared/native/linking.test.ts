import { Linking } from 'react-native'

import {
  forgetDeliveredUrlsForTests,
  inviteTokenFromUrl,
  isInviteUrl,
  subscribeToAuthCallbackUrls,
} from './linking.ts'

describe('mobile invite URL parsing', () => {
  it('accepts one exact opaque path token', () => {
    expect(isInviteUrl('cosimosi://invite/opaque-token')).toBe(true)
    expect(inviteTokenFromUrl('cosimosi://invite/a%2Db')).toBe('a-b')
  })

  it.each([
    'cosimosi://invite',
    'cosimosi://invite/',
    'cosimosi://invite/token/extra',
    'cosimosi://invite/token?extra=1',
    'cosimosi://invite.evil/token',
    'https://app.example/invite/token',
  ])('rejects the near-miss %s', (url) => {
    expect(isInviteUrl(url)).toBe(false)
    expect(inviteTokenFromUrl(url)).toBeNull()
  })
})

describe('auth callback delivery', () => {
  const callback = 'cosimosi://auth-callback?code=single-use'
  let emit: (url: string) => void = () => undefined

  beforeEach(() => {
    forgetDeliveredUrlsForTests()
    jest.spyOn(Linking, 'addEventListener').mockImplementation((_type, handler) => {
      emit = (url) => handler({ url })
      return { remove: jest.fn() } as unknown as ReturnType<typeof Linking.addEventListener>
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('ignores the initial URL after unsubscribe', async () => {
    let resolveInitial: (url: string | null) => void = () => undefined
    jest
      .spyOn(Linking, 'getInitialURL')
      .mockReturnValue(new Promise((resolve) => (resolveInitial = resolve)))
    const onUrl = jest.fn()

    const unsubscribe = subscribeToAuthCallbackUrls(onUrl)
    unsubscribe()
    resolveInitial(callback)
    await Promise.resolve()

    expect(onUrl).not.toHaveBeenCalled()
  })

  it('does not redeliver the initial URL to a new subscription', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(callback)
    const first = jest.fn()
    const second = jest.fn()

    const unsubscribeFirst = subscribeToAuthCallbackUrls(first)
    await Promise.resolve()
    unsubscribeFirst()
    const unsubscribeSecond = subscribeToAuthCallbackUrls(second)
    await Promise.resolve()
    emit(callback)
    unsubscribeSecond()

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })

  it('delivers later events', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null)
    const onUrl = jest.fn()

    const unsubscribe = subscribeToAuthCallbackUrls(onUrl)
    await Promise.resolve()
    emit('cosimosi://auth-callback?code=later')
    unsubscribe()

    expect(onUrl).toHaveBeenCalledWith('cosimosi://auth-callback?code=later')
  })
})
