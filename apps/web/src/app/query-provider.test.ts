import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { useTransport } from '@connectrpc/connect-query'

import { createPlatformMockTransport, type ApiTransport } from '@cosimosi/api-client'
import { FakeAuthAdapter, createAuthFacade } from '@cosimosi/auth'
import { createClientCacheQueryClient } from '@cosimosi/client-cache'
import { createObservabilityFacade } from '@cosimosi/observability'
import { ObservabilityProvider } from '@cosimosi/observability/react'

import { resolveWebApiBaseUrl } from './query-config.ts'
import { WebAuthProvider } from './auth-provider.tsx'
import { WebClientCacheProvider } from './query-provider.tsx'

describe('web client cache provider config', () => {
  it('prefers the explicit client cache API base URL', () => {
    expect(resolveWebApiBaseUrl({ VITE_API_BASE_URL: 'https://api.example.test', VITE_API_URL: 'https://legacy.test' })).toBe(
      'https://api.example.test',
    )
  })

  it('falls back to the existing API URL env name and then local API origin', () => {
    expect(resolveWebApiBaseUrl({ VITE_API_BASE_URL: '', VITE_API_URL: 'https://api.test' })).toBe('https://api.test')
    expect(resolveWebApiBaseUrl({ VITE_API_BASE_URL: '', VITE_API_URL: '' })).toBe('http://localhost:8080')
  })

  it('provides the generated Connect transport through connect-query context', () => {
    const facade = createAuthFacade({ adapter: new FakeAuthAdapter() })
    const observability = createObservabilityFacade()
    const queryClient = createClientCacheQueryClient()
    const transport = createPlatformMockTransport(() => ({ message: 'pong' }))
    let contextTransport: ApiTransport | null = null

    function Probe() {
      contextTransport = useTransport()
      return null
    }

    renderToString(
      createElement(
        ObservabilityProvider,
        { facade: observability },
        createElement(
          WebAuthProvider,
          { facade },
          createElement(WebClientCacheProvider, { queryClient, transport }, createElement(Probe)),
        ),
      ),
    )

    expect(contextTransport).toBe(transport)
    facade.dispose()
    observability.dispose()
    queryClient.clear()
  })
})
