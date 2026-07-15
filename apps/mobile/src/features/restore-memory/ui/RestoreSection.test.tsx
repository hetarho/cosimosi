import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { createRouterTransport, type Transport } from '@connectrpc/connect'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { MemoryService } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'
import { remainingRestoreDays, useReleasedGroupsStore } from '@cosimosi/universe'

import { RestoreSection } from './RestoreSection.tsx'

function renderSection(transport: Transport) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>
        <RestoreSection />
      </TransportProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  setActiveLocale(defaultLocale)
  useReleasedGroupsStore.getState().reset()
})

describe('RestoreSection (mobile)', () => {
  it('lists a same-session release with its config-derived remaining window and restores it (A3)', async () => {
    let restoreRequest: Record<string, unknown> | undefined
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        restore(request) {
          restoreRequest = { ...request }
          return { diaryId: request.diaryId, episodicMemoryIds: ['m1', 'm2'] }
        },
      })
    })

    const deletedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    useReleasedGroupsStore.getState().record({
      diaryId: 'd1',
      deletedAt,
      episodicMemoryIds: ['m1', 'm2'],
      removedMemories: [],
    })
    const remaining = remainingRestoreDays(deletedAt, VALUES.release.softDeleteRetentionDays)

    const view = renderSection(transport)

    expect(view.getByText(m.deletion_restore_section_title())).toBeTruthy()
    expect(view.getByText(m.deletion_restore_group_summary({ count: 2 }))).toBeTruthy()
    expect(view.getByText(m.deletion_restore_window_remaining({ days: remaining }))).toBeTruthy()

    fireEvent.press(view.getByText(m.deletion_restore_action()))

    await waitFor(() => expect(restoreRequest).toBeDefined())
    const keys = Object.keys(restoreRequest ?? {}).filter((key) => key !== '$typeName')
    expect(keys).toEqual(['diaryId'])
    // The restored group is dropped from the list.
    await waitFor(() => expect(useReleasedGroupsStore.getState().groups).toHaveLength(0))
  })

  it('renders nothing when there is no released group', () => {
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, { restore: (r) => ({ diaryId: r.diaryId, episodicMemoryIds: [] }) })
    })
    const view = renderSection(transport)
    expect(view.queryByText(m.deletion_restore_section_title())).toBeNull()
  })
})
