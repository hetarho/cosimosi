// @vitest-environment jsdom

import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createRouterTransport } from '@connectrpc/connect'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AccountService } from '@cosimosi/api-client'

import { LocaleRenderBoundary, m, setActiveLocale } from '../../shared/i18n/index.ts'
import { WebI18nProvider } from './i18n-provider.tsx'
import { LocaleBootstrap } from './locale-bootstrap.tsx'

afterEach(() => {
  cleanup()
  setActiveLocale('en')
})

it('applies the server locale without withholding its sibling render', async () => {
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
    <WebI18nProvider locale="en">
      <LocaleRenderBoundary>
        {() => (
          <TransportProvider transport={transport}>
            <QueryClientProvider client={queryClient}>
              <LocaleBootstrap />
              <MessageProbe />
            </QueryClientProvider>
          </TransportProvider>
        )}
      </LocaleRenderBoundary>
    </WebI18nProvider>,
  )

  expect(await screen.findByText('나')).toBeTruthy()
})

function MessageProbe() {
  return <span>{m.me_title()}</span>
}
