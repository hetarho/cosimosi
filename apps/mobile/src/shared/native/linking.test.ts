import { inviteTokenFromUrl, isInviteUrl } from './linking.ts'

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
