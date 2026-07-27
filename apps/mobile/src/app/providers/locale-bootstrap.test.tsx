import { Text } from 'react-native'

import { cleanup, render, screen } from '@testing-library/react-native'
import { createRouterTransport } from '@connectrpc/connect'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AccountService } from '@cosimosi/api-client'

import { LocaleRenderBoundary, m, setActiveLocale } from '../../shared/i18n/index.ts'
import { MobileI18nProvider } from './i18n-provider.tsx'
import { MobileLocaleBootstrap } from './locale-bootstrap.tsx'

describe('MobileLocaleBootstrap', () => {
  afterEach(() => {
    cleanup()
    setActiveLocale('en')
  })

  it('re-renders mounted copy when the server profile applies a later locale', async () => {
    const transport = createRouterTransport(({ service }) => {
      service(AccountService, {
        getProfile: () => ({
          profile: {
            nickname: 'Nova',
            timezone: 'Asia/Seoul',
            locale: 'ko',
          },
        }),
      })
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })

    render(
      <MobileI18nProvider locale="en">
        <LocaleRenderBoundary>
          {() => (
            <TransportProvider transport={transport}>
              <QueryClientProvider client={queryClient}>
                <MobileLocaleBootstrap />
                <MessageProbe />
              </QueryClientProvider>
            </TransportProvider>
          )}
        </LocaleRenderBoundary>
      </MobileI18nProvider>,
    )

    expect(await screen.findByText('나')).toBeTruthy()
    expect(screen.getByText('프로필')).toBeTruthy()
    expect(screen.getByText('다시 시도')).toBeTruthy()
  })
})

function MessageProbe() {
  return (
    <>
      <Text>{m.me_title()}</Text>
      <Text>{m.me_tab_profile()}</Text>
      <Text>{m.common_retry()}</Text>
    </>
  )
}
