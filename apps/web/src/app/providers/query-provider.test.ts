// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { useTransport } from '@connectrpc/connect-query'

import { createPlatformMockTransport, type ApiTransport } from '@cosimosi/api-client'
import { FakeAuthAdapter, createAuthFacade } from '@cosimosi/auth'
import { useSessionSnapshot } from '@cosimosi/auth/react'
import { createClientCacheQueryClient } from '@cosimosi/client-cache'
import { DEFAULT_PALETTE_ID } from '@cosimosi/emotion'
import { createObservabilityFacade } from '@cosimosi/observability'
import { ObservabilityProvider } from '@cosimosi/observability/react'
import {
  useChargeRequestStore,
  useEpisodicMemoryStore,
  useRecallTargetStore,
  useReleasedGroupsStore,
  useTwinkleBalanceStore,
} from '@cosimosi/universe'

import { useAdvanceAnnouncementStore } from '../../features/accelerate-time/index.ts'
import { usePalettePreferenceStore } from '../../features/change-palette/index.ts'
import {
  requestTimeSyncConsent,
  useTimeSyncConsentStore,
} from '../../features/confirm-time-sync/index.ts'
import { useLaunchedNeuronsStore } from '../../features/launch-stars/index.ts'
import { useDiaryDraftStore } from '../../features/write-diary/index.ts'
import { useDeletionDraftStore } from '../../widgets/deletion-flow/index.ts'
import { useRecallDraftStore } from '../../widgets/recall-flow/index.ts'
import { useProposalStore } from '../../widgets/writing-flow/index.ts'
import { resolveWebApiBaseUrl } from './query-config.ts'
import { WebAuthProvider } from './auth-provider.tsx'
import { WebClientCacheProvider } from './query-provider.tsx'

const cleanupTasks: Array<() => void> = []

describe('web client cache provider config', () => {
  afterEach(() => {
    while (cleanupTasks.length) cleanupTasks.pop()?.()
  })

  it('prefers the explicit client cache API base URL', () => {
    expect(
      resolveWebApiBaseUrl({
        VITE_API_BASE_URL: 'https://api.example.test',
        VITE_API_URL: 'https://legacy.test',
      }),
    ).toBe('https://api.example.test')
  })

  it('falls back to the existing API URL env name and then local API origin', () => {
    expect(resolveWebApiBaseUrl({ VITE_API_BASE_URL: '', VITE_API_URL: 'https://api.test' })).toBe(
      'https://api.test',
    )
    expect(resolveWebApiBaseUrl({ VITE_API_BASE_URL: '', VITE_API_URL: '' })).toBe(
      'http://localhost:8080',
    )
  })

  it('provides the generated Connect transport through connect-query context', () => {
    const facade = createAuthFacade({ adapter: new FakeAuthAdapter() })
    const observability = createObservabilityFacade()
    const queryClient = createClientCacheQueryClient()
    cleanupTasks.push(
      () => queryClient.clear(),
      () => observability.dispose(),
      () => facade.dispose(),
    )
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
  })

  it('clears all client state before direct A → B and B → anonymous → C commits', async () => {
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean
    }
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    const adapter = new FakeAuthAdapter({
      initial: { userId: 'user-a', expiresAt: Date.now() + 60_000 },
    })
    const facade = createAuthFacade({ adapter })
    const observability = createObservabilityFacade()
    const queryClient = createClientCacheQueryClient()
    const transport = createPlatformMockTransport(() => ({ message: 'pong' }))
    const container = document.createElement('div')
    const root = createRoot(container)
    const committed: string[] = []
    cleanupTasks.push(
      () => queryClient.clear(),
      () => observability.dispose(),
      () => facade.dispose(),
      () => useEpisodicMemoryStore.getState().clear(),
    )
    await expect.poll(() => facade.snapshot.userId).toBe('user-a')
    queryClient.setQueryData(['scope-probe'], 'user-a query')
    useEpisodicMemoryStore.setState({ byId: { 'memory-a': {} as never }, ids: ['memory-a'] })
    useTwinkleBalanceStore.setState({ basic: 4n, additional: 7n, loaded: true })
    useReleasedGroupsStore.setState({ groups: [{} as never] })
    useRecallTargetStore.setState({ memoryId: 'memory-a' })
    useChargeRequestStore.setState({ requested: true })
    useAdvanceAnnouncementStore.setState({ pending: {} as never })
    useLaunchedNeuronsStore.setState({ newNeuronIds: ['neuron-a'] })
    useDiaryDraftStore.setState({ body: 'A private draft', diaryDate: '2026-07-22' })
    useProposalStore.setState({ memories: [{} as never] })
    useRecallDraftStore.setState({ rewrite: 'A private recall', result: {} as never })
    useDeletionDraftStore.setState({
      phrase: 'A private deletion',
      candidates: [{} as never],
      selectedNeuronIds: ['neuron-a'],
      heavyDetected: true,
    })
    usePalettePreferenceStore.setState({
      paletteId: 'muted-dusk',
      confirmedPaletteId: 'muted-dusk',
    })
    const consent = requestTimeSyncConsent()

    function Probe() {
      const { userId } = useSessionSnapshot()
      const memoryIds = useEpisodicMemoryStore((state) => state.ids)
      const value = `${userId}:${memoryIds.join(',') || 'empty'}`
      committed.push(value)
      return createElement('span', null, value)
    }

    try {
      await act(async () => {
        root.render(
          createElement(
            ObservabilityProvider,
            { facade: observability },
            createElement(
              WebAuthProvider,
              { facade },
              createElement(
                WebClientCacheProvider,
                { queryClient, transport },
                createElement(Probe),
              ),
            ),
          ),
        )
      })
      expect(container.textContent).toBe('user-a:memory-a')

      await act(async () => {
        adapter.emit({
          status: 'authenticated',
          userId: 'user-b',
          expiresAt: Date.now() + 60_000,
          error: null,
        })
      })

      await expect.poll(() => container.textContent).toBe('user-b:empty')
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
      expect(committed).not.toContain('user-b:memory-a')
      await expect(consent).resolves.toBe('cancel')
      expect(useTwinkleBalanceStore.getState()).toMatchObject({
        basic: 0n,
        additional: 0n,
        loaded: false,
      })
      expect(useReleasedGroupsStore.getState().groups).toEqual([])
      expect(useRecallTargetStore.getState().memoryId).toBeNull()
      expect(useChargeRequestStore.getState().requested).toBe(false)
      expect(useAdvanceAnnouncementStore.getState().pending).toBeNull()
      expect(useLaunchedNeuronsStore.getState().newNeuronIds).toEqual([])
      expect(useDiaryDraftStore.getState()).toMatchObject({ body: '', diaryDate: '' })
      expect(useProposalStore.getState().memories).toEqual([])
      expect(useRecallDraftStore.getState()).toMatchObject({ rewrite: '', result: null })
      expect(useDeletionDraftStore.getState()).toMatchObject({
        phrase: '',
        candidates: [],
        selectedNeuronIds: [],
        heavyDetected: false,
      })
      expect(useTimeSyncConsentStore.getState().pending).toBeNull()
      expect(usePalettePreferenceStore.getState()).toMatchObject({
        paletteId: DEFAULT_PALETTE_ID,
        confirmedPaletteId: DEFAULT_PALETTE_ID,
      })

      queryClient.setQueryData(['user-b-only'], 'user-b query')
      useEpisodicMemoryStore.setState({ byId: { 'memory-b': {} as never }, ids: ['memory-b'] })
      await act(async () => {
        adapter.emit({ status: 'signedOut', userId: null, expiresAt: null, error: null })
      })
      await expect.poll(() => container.textContent).toBe('null:empty')
      expect(committed).not.toContain('null:memory-b')
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0)

      await act(() => facade.signIn({ email: 'user-c@example.test', password: 'test-password' }))
      await expect.poll(() => container.textContent).toBe('fake-user-user-c@example.test:empty')
      expect(committed).not.toContain('fake-user-user-c@example.test:memory-b')
    } finally {
      await act(async () => root.unmount())
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = false
    }
  })
})
