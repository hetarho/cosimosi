import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { createObservabilityFacade } from '@cosimosi/observability'

import { createTestHarnessFakes } from '../shared/test-panel/index.ts'
import App from './App.tsx'

describe('web app test harness route', () => {
  it('renders /test inside the app provider stack with fake platform helpers', () => {
    const fakes = createTestHarnessFakes({
      userId: 'test-user',
      ping: () => ({ message: 'pong', requestId: 'app-route-test' }),
    })
    const observability = createObservabilityFacade()

    try {
      const html = renderToString(
        <App
          routePath="/test"
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
})
