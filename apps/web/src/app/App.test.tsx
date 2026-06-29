import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'

import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'
import { createObservabilityFacade } from '@cosimosi/observability'

import { createTestHarnessFakes } from '../pages/test/index.ts'
import App from './App.tsx'

describe('web app test harness route', () => {
  afterEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('renders /test inside the app provider stack with fake platform helpers', () => {
    const fakes = createTestHarnessFakes({
      userId: 'test-user',
      ping: () => ({ message: 'pong', requestId: 'app-route-test' }),
    })
    const observability = createObservabilityFacade()

    try {
      const html = renderToString(
        <App
          routePath="/test/?probe=1"
          authFacade={fakes.authFacade}
          queryClient={fakes.queryClient}
          transport={fakes.transport}
          observabilityFacade={observability}
          locale="en"
        />,
      )

      expect(html).toContain('Test harness')
      expect(html).toContain('Transport ping')
      expect(html).toContain('Design system')
      expect(html).not.toContain('ui-showcase')
    } finally {
      fakes.dispose()
      observability.dispose()
    }
  })

  it('honors the locale override during server rendering', () => {
    const fakes = createTestHarnessFakes()
    const observability = createObservabilityFacade()

    try {
      const html = renderToString(
        <App
          routePath="/test"
          authFacade={fakes.authFacade}
          queryClient={fakes.queryClient}
          transport={fakes.transport}
          observabilityFacade={observability}
          locale="ko"
        />,
      )

      expect(html).toContain('테스트 하네스')
      expect(html).not.toContain('Test harness')
    } finally {
      fakes.dispose()
      observability.dispose()
    }
  })
})
