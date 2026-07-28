import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'

import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { createAccountMockTransport } from '@cosimosi/api-client'
import { MOODS } from '@cosimosi/emotion'

import { defaultLocale, m, moodLabel, setActiveLocale } from '../../../shared/i18n/index.ts'
import { MoodColorSection } from './MoodColorSection.tsx'

function renderSection(): string {
  const queryClient = new QueryClient()
  return renderToString(
    <TransportProvider transport={createAccountMockTransport({})}>
      <QueryClientProvider client={queryClient}>
        <MoodColorSection />
      </QueryClientProvider>
    </TransportProvider>,
  )
}

describe('MoodColorSection', () => {
  afterEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('renders one editable row for every feeling', () => {
    const html = renderSection()
    expect(html).toContain(m.palette_editor_title())
    for (const mood of MOODS) expect(html).toContain(moodLabel(mood))
  })

  it('offers three recommendations per mood without fabricating a ratio', () => {
    const html = renderSection()
    expect(html.match(new RegExp(m.palette_recommendation_label(), 'g'))).toHaveLength(
      MOODS.length * 3,
    )
    expect(html).toContain(m.palette_recommendation_usual())
    expect(html).not.toContain('%')
  })
})
