// @vitest-environment jsdom

import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createRouterTransport } from '@connectrpc/connect'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AccountService } from '@cosimosi/api-client'
import { getActiveLocale, setActiveLocale } from '@cosimosi/i18n'

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
    <TransportProvider transport={transport}>
      <QueryClientProvider client={queryClient}>
        <LocaleBootstrap />
        <span>product-child</span>
      </QueryClientProvider>
    </TransportProvider>,
  )

  expect(screen.getByText('product-child')).toBeTruthy()
  await vi.waitFor(() => expect(getActiveLocale()).toBe('ko'))
})
