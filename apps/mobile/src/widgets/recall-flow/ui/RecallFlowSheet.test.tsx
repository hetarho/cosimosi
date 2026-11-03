import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

import { Code, ConnectError, createRouterTransport, type Transport } from '@connectrpc/connect'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ErrorInfoSchema, MemoryService } from '@cosimosi/api-client'
import { createEmotion } from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'
import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'
import {
  useEpisodicMemoryStore,
  useRecallTargetStore,
  useUniverseClockStore,
} from '@cosimosi/universe'

import { useRecallDraftStore } from '@cosimosi/universe/testing'
import { ErrorToastContext } from '@cosimosi/errors/react'
import { RecallFlowSheet } from './RecallFlowSheet.tsx'

// Only stored-text restoration quotes a price; free reconstruction must never use this hook.
jest.mock('@cosimosi/twinkle/react', () => ({
  useInvalidateTwinkleBalance: () => jest.fn(async () => undefined),
  useSpendQuote: jest.fn(),
}))
import { useSpendQuote } from '@cosimosi/twinkle/react'
const mockUseSpendQuote = useSpendQuote as jest.Mock

const vividMemory: EpisodicMemory = {
  id: 'm1',
  diaryId: 'd',
  name: 'Market run',
  emotion: createEmotion('CALM'),
  baseStrength: 0.9,
  recallCount: 0,
  createdUniverseTime: '2026-07-02',
  lastRecalledUniverseTime: null,
  seed: 7n,
  activations: [],
  decayStages: [],
  forgettingOffsetDays: 0,
  currentText: 'the whole vivid afternoon',
  semanticStage: 0,
}

const fadedMemory: EpisodicMemory = {
  ...vividMemory,
  baseStrength: 0,
  createdUniverseTime: '2026-05-18',
  currentText: 'I met Ada at Seoul today.',
  decayStages: ['I xxxx at xxxx today.'],
}

// Every client this suite creates is cleared after each test: clearing cancels the cache's
// pending gc timers (default gcTime is minutes), which would otherwise hold the Jest worker's
// event loop open after the suite and trip the force-exit warning.
const queryClients: QueryClient[] = []

afterEach(() => {
  for (const client of queryClients.splice(0)) client.clear()
})

function renderSheet(transport: Transport, showError: (error: unknown) => void = () => {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  })
  queryClients.push(queryClient)
  return render(
    <QueryClientProvider client={queryClient}>
      <ErrorToastContext.Provider value={showError}>
        <TransportProvider transport={transport}>
          <RecallFlowSheet />
        </TransportProvider>
      </ErrorToastContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  setActiveLocale(defaultLocale)
  useRecallTargetStore.getState().clear()
  useEpisodicMemoryStore.getState().setAll([vividMemory])
  useUniverseClockStore.getState().setCurrent('2026-07-02')
  useRecallDraftStore.getState().reset()
  mockUseSpendQuote.mockReset()
  mockUseSpendQuote.mockReturnValue({
    data: { cost: 8n, covered: true, shortfall: 0n },
    isError: false,
  })
})

describe('RecallFlowSheet (mobile)', () => {
  it('surfaces a settled SyncStatus failure through the shared error seam', async () => {
    const error = new ConnectError('internal server error', Code.Internal, undefined, [
      {
        desc: ErrorInfoSchema,
        value: {
          reason: 'INTERNAL',
          domain: 'platform',
          requestId: 'request-sync-status',
        },
      },
    ])
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        syncStatus: () => {
          throw error
        },
      })
    })
    const showError = jest.fn()
    useRecallTargetStore.getState().request('m1')

    renderSheet(transport, showError)

    await waitFor(() => expect(showError).toHaveBeenCalledTimes(1))
    const surfaced = showError.mock.calls[0]?.[0]
    expect(surfaced).toBeInstanceOf(ConnectError)
    expect((surfaced as ConnectError).findDetails(ErrorInfoSchema)[0]?.requestId).toBe(
      'request-sync-status',
    )
  })

  it('drives the sync-consent gate from the SERVER status, not a local date (A1/R008)', async () => {
    // The client clock is at today; only the server says a sync is still needed. A local-date
    // check would skip consent — the server-driven read must still gate it.
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        syncStatus: () => ({ today: '2026-07-03', needsSync: true }),
      })
    })
    useRecallTargetStore.getState().request('m1')
    const view = renderSheet(transport)

    await waitFor(() => expect(view.getByText(m.universe_time_sync_consent_body())).toBeTruthy())
  })

  it('renders the real faded prompt and applies the returned current text, carrying the operation id (R006/A2/A7)', async () => {
    useEpisodicMemoryStore.getState().setAll([fadedMemory])
    let recallRequest: Record<string, unknown> | undefined
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        syncStatus: () => ({ today: '2026-07-02', needsSync: false }),
        recall(request) {
          recallRequest = { ...request }
          return {
            reconsolidated: true,
            currentText: 'a reworded afternoon',
            seed: 99n,
            recallCount: 1,
            effectiveStrength: 0.9,
            previousUniverseTime: '2026-07-02',
            universeTime: '2026-07-02',
          }
        },
      })
    })
    useRecallTargetStore.getState().request('m1')
    const view = renderSheet(transport)

    await waitFor(() =>
      expect(view.getByLabelText(m.recall_blank_label({ position: 1 }))).toBeTruthy(),
    )
    expect(view.getByText('I ')).toBeTruthy()
    expect(view.getByText(' at ')).toBeTruthy()
    expect(view.queryByText(m.twinkle_cost_proceed())).toBeNull()
    expect(mockUseSpendQuote).not.toHaveBeenCalled()
    expect(view.queryByText(fadedMemory.currentText)).toBeNull()
    expect(view.queryByText(m.star_detail_text_unavailable())).toBeNull()

    fireEvent.changeText(view.getByLabelText(m.recall_blank_label({ position: 1 })), 'met a friend')
    fireEvent.changeText(view.getByLabelText(m.recall_blank_label({ position: 2 })), 'home')
    fireEvent.press(view.getByText(m.recall_confirm()))

    await waitFor(() => expect(view.getByText('a reworded afternoon')).toBeTruthy())
    expect(recallRequest?.rewriteText).toBe('I met a friend at home today.')
    expect(typeof recallRequest?.operationId).toBe('string')
    expect(recallRequest?.operationId).not.toBe('')
    expect(recallRequest?.syncConsent).toBe(false)
    expect(useEpisodicMemoryStore.getState().byId.m1?.currentText).toBe('a reworded afternoon')
  })

  it('suppresses repeat submit and ignores a response that arrives after unmount (A4)', async () => {
    const response = {
      reconsolidated: true,
      currentText: 'must remain invisible',
      seed: 101n,
      recallCount: 1,
      effectiveStrength: 0.9,
      previousUniverseTime: '2026-07-02',
      universeTime: '2026-07-02',
    }
    let completeRecall: ((value: typeof response) => void) | undefined
    let recallCalls = 0
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        syncStatus: () => ({ today: '2026-07-02', needsSync: false }),
        recall() {
          recallCalls += 1
          return new Promise<typeof response>((resolve) => {
            completeRecall = resolve
          })
        },
      })
    })
    useRecallTargetStore.getState().request('m1')
    const view = renderSheet(transport)

    await waitFor(() => expect(view.getByText(m.recall_no_missing_words())).toBeTruthy())
    const confirm = view.getByText(m.recall_confirm())
    fireEvent.press(confirm)
    fireEvent.press(confirm)
    await waitFor(() => expect(recallCalls).toBe(1))

    view.unmount()
    await act(async () => {
      completeRecall?.(response)
      await Promise.resolve()
    })
    expect(useEpisodicMemoryStore.getState().byId.m1?.currentText).toBe('the whole vivid afternoon')
  })
})
