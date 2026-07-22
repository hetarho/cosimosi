import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

import { createRouterTransport, type Transport } from '@connectrpc/connect'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { MemoryService } from '@cosimosi/api-client'
import { createEmotion } from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'
import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'
import {
  useEpisodicMemoryStore,
  useRecallTargetStore,
  useUniverseClockStore,
} from '@cosimosi/universe'

import { useRecallDraftStore } from '../model/recall-draft-store.ts'
import { RecallFlowSheet } from './RecallFlowSheet.tsx'

// The cost gate's quote hook is mocked to a fixed covered quote so the flow reaches the rewrite
// phase without a QuoteSpend round-trip — the quote branch is pinned by the SpendCostDisplay test.
jest.mock('../../../features/spend-cost-display/api/quote-spend.ts', () => ({
  useSpendQuote: jest.fn(),
}))
import { useSpendQuote } from '../../../features/spend-cost-display/api/quote-spend.ts'
const mockUseSpendQuote = useSpendQuote as jest.Mock

const vividMemory: EpisodicMemory = {
  id: 'm1',
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

function renderSheet(transport: Transport) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>
        <RecallFlowSheet />
      </TransportProvider>
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

    // The cost gate shows first; proceed reveals the rewrite surface.
    await waitFor(() => expect(view.getByText(m.twinkle_cost_proceed())).toBeTruthy())
    fireEvent.press(view.getByText(m.twinkle_cost_proceed()))

    // R006: the faded prompt is the memory's real current decay text — never the unavailable copy.
    await waitFor(() => expect(view.getByText('the whole vivid afternoon')).toBeTruthy())
    expect(view.queryByText(m.star_detail_text_unavailable())).toBeNull()

    fireEvent.changeText(
      view.getByPlaceholderText(m.recall_rewrite_placeholder()),
      'a reworded afternoon',
    )
    fireEvent.press(view.getByText(m.recall_confirm()))

    // A7: the result shows the returned current text; A2: the paid call carried an operation id and
    // the (not-needed) consent flag.
    await waitFor(() => expect(view.getByText('a reworded afternoon')).toBeTruthy())
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

    await waitFor(() => expect(view.getByText(m.twinkle_cost_proceed())).toBeTruthy())
    fireEvent.press(view.getByText(m.twinkle_cost_proceed()))
    await waitFor(() =>
      expect(view.getByPlaceholderText(m.recall_rewrite_placeholder())).toBeTruthy(),
    )
    fireEvent.changeText(view.getByPlaceholderText(m.recall_rewrite_placeholder()), 'rewrite')
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
