import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { createRouterTransport, type Transport } from '@connectrpc/connect'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { MemoryService } from '@cosimosi/api-client'
import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'
import {
  useDeletionTargetStore,
  useDiaryStore,
  useEpisodicMemoryStore,
  useReleasedGroupsStore,
} from '@cosimosi/universe'

import { DeletionFlowSheet } from './DeletionFlowSheet.tsx'

function renderSheet(transport: Transport) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>
        <DeletionFlowSheet />
      </TransportProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  setActiveLocale(defaultLocale)
  useDeletionTargetStore.getState().clear()
  useReleasedGroupsStore.getState().reset()
  useEpisodicMemoryStore.getState().setAll([])
  useDiaryStore.getState().setAll([])
})

describe('DeletionFlowSheet — letting-go (mobile)', () => {
  it('says the words → suggests → shows the heavy notice before approve → seals only the toggled subset (A4–A9)', async () => {
    let letGoRequest: Record<string, unknown> | undefined
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        suggestLetGo: () => ({
          candidates: [
            { neuronId: 'n1', name: 'the argument', reason: 'only here' },
            { neuronId: 'n2', name: 'the rain', reason: 'only here' },
          ],
          heavyState: { detected: true, severity: 'elevated' },
        }),
        letGo(request) {
          letGoRequest = { ...request }
          return { sealedNeuronIds: [...request.approvedNeuronIds] }
        },
      })
    })

    useDeletionTargetStore.getState().openLetGo('m1')
    const view = renderSheet(transport)

    // Step 1 — say the words (symbolic framing note present).
    await waitFor(() => expect(view.getByText(m.deletion_letgo_phrasing_note())).toBeTruthy())
    fireEvent.changeText(view.getByLabelText(m.deletion_letgo_phrasing_label()), 'let this go')
    fireEvent.press(view.getByText(m.deletion_letgo_suggest_action()))

    // Step 3 — the candidates render, and the professional-resource notice sits BEFORE approve.
    await waitFor(() => expect(view.getByText('the argument')).toBeTruthy())
    expect(view.getByText('the rain')).toBeTruthy()
    expect(view.getByText(m.deletion_letgo_resource_title())).toBeTruthy()
    expect(view.getByText(m.deletion_letgo_kept_facts())).toBeTruthy()

    // The diarist toggles off 'the rain' — only 'the argument' stays approved.
    fireEvent.press(view.getByLabelText('the rain'))
    fireEvent.press(view.getByText(m.deletion_letgo_seal_action()))

    await waitFor(() => expect(letGoRequest).toBeDefined())
    const letGoKeys = Object.keys(letGoRequest ?? {}).filter((key) => key !== '$typeName')
    expect(letGoKeys.sort()).toEqual(['approvedNeuronIds', 'episodicMemoryId'])
    expect(letGoRequest?.episodicMemoryId).toBe('m1')
    expect(letGoRequest?.approvedNeuronIds).toEqual(['n1'])

    // The flow closed with no undo affordance left behind (A6).
    await waitFor(() => expect(view.queryByText(m.deletion_letgo_seal_action())).toBeNull())
  })

  it('does not surface the resource notice when heavy-state is not set (A8)', async () => {
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        suggestLetGo: () => ({
          candidates: [{ neuronId: 'n1', name: 'the argument', reason: 'only here' }],
          heavyState: { detected: false, severity: '' },
        }),
        letGo: (request) => ({ sealedNeuronIds: [...request.approvedNeuronIds] }),
      })
    })

    useDeletionTargetStore.getState().openLetGo('m1')
    const view = renderSheet(transport)

    await waitFor(() => expect(view.getByText(m.deletion_letgo_phrasing_note())).toBeTruthy())
    fireEvent.changeText(view.getByLabelText(m.deletion_letgo_phrasing_label()), 'let this go')
    fireEvent.press(view.getByText(m.deletion_letgo_suggest_action()))

    await waitFor(() => expect(view.getByText('the argument')).toBeTruthy())
    expect(view.queryByText(m.deletion_letgo_resource_title())).toBeNull()
  })
})

describe('DeletionFlowSheet — full delete (mobile)', () => {
  it('confirms → fires Release carrying only diary_id → records the restore group (A1/A2/A9)', async () => {
    let releaseRequest: Record<string, unknown> | undefined
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        release(request) {
          releaseRequest = { ...request }
          return {
            diaryId: request.diaryId,
            episodicMemoryIds: ['m1'],
            deletedAt: '2026-07-15T00:00:00Z',
          }
        },
      })
    })

    useDiaryStore.getState().setAll([
      {
        id: 'd1',
        body: 'a day',
        diaryDate: '2026-07-01',
        createdUniverseTime: '2026-07-01',
        memories: [{ episodicMemoryId: 'm1', name: 'first swim', mood: 'JOY' }],
      },
    ])
    useDeletionTargetStore.getState().openFullDelete('d1')
    const view = renderSheet(transport)

    // The confirm states all stars born from the diary + both reassurances before the act.
    await waitFor(() => expect(view.getByText(m.deletion_delete_lead())).toBeTruthy())
    expect(view.getByText('first swim')).toBeTruthy()
    expect(view.getByText(m.deletion_delete_restore_reassurance({ days: 30 }))).toBeTruthy()

    fireEvent.press(view.getByText(m.deletion_delete_confirm()))

    await waitFor(() => expect(releaseRequest).toBeDefined())
    const releaseKeys = Object.keys(releaseRequest ?? {}).filter((key) => key !== '$typeName')
    expect(releaseKeys).toEqual(['diaryId'])
    await waitFor(() => expect(useReleasedGroupsStore.getState().groups).toHaveLength(1))
  })
})
