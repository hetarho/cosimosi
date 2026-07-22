import { TextInput } from 'react-native'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { createRouterTransport } from '@connectrpc/connect'

import type { LinkingOptions } from '@react-navigation/native'

import {
  AccountService,
  createGetUniverseQueryKey,
  MemoryService,
  type GetUniverseResponse,
} from '@cosimosi/api-client'
import { DEFAULT_PALETTE_ID, moodColor, resetMoodPalette } from '@cosimosi/emotion'
import { setClientCacheData } from '@cosimosi/client-cache'
import { m } from '@cosimosi/i18n'
import { useChargeRequestStore, useTwinkleBalanceStore } from '@cosimosi/twinkle'
import {
  useAwakenRegistryStore,
  useDeletionTargetStore,
  useDiaryStore,
  useEpisodicMemoryStore,
  useLatentConsumedStore,
  useNeuronStore,
  useOpenDiaryTargetStore,
  usePendingFlyTargetStore,
  useRecallTargetStore,
  useReleasedGroupsStore,
  useSynapseStore,
  useUniverseClockStore,
} from '@cosimosi/universe'

import { useAdvanceAnnouncementStore } from '../features/accelerate-time/index.ts'
import { usePalettePreferenceStore } from '../features/change-palette/index.ts'
import {
  requestTimeSyncConsent,
  useTimeSyncConsentStore,
} from '../features/confirm-time-sync/index.ts'
import { useLaunchedNeuronsStore } from '../features/launch-stars/index.ts'
import { useDiaryDraftStore } from '../features/write-diary/index.ts'
import { fallbackSafeAreaMetrics } from '../shared/native/index.ts'
import { createMobileShellFakes, type MobileShellFakes } from '../shared/testing/index.ts'
import { useDeletionDraftStore } from '../widgets/deletion-flow/index.ts'
import { useRecallDraftStore } from '../widgets/recall-flow/index.ts'
import { useProposalStore } from '../widgets/writing-flow/index.ts'
import App from './App.tsx'
import { ROUTES, type RootStackParamList } from './navigation/routes.ts'

// A settled universe read with zero episodic memories — the first-run beginning ([V7]).
const emptyUniverse = {
  $typeName: 'cosimosi.memory.v1.GetUniverseResponse',
  memories: [],
  neurons: [],
  synapses: [],
  universeTime: '',
} as unknown as GetUniverseResponse

function createMobileAppTransport(
  options: {
    getPalettePreference?: () => string
    setPalettePreference?: (paletteId: string) => Promise<string>
  } = {},
) {
  return createRouterTransport(({ service }) => {
    service(AccountService, {
      getPalettePreference: () => ({
        paletteId: options.getPalettePreference?.() ?? DEFAULT_PALETTE_ID,
      }),
      async setPalettePreference(request) {
        return {
          paletteId: options.setPalettePreference
            ? await options.setPalettePreference(request.paletteId)
            : request.paletteId,
        }
      },
    })
    service(MemoryService, {
      getUniverse: () => emptyUniverse,
    })
  })
}

function renderShell(
  fakes: MobileShellFakes,
  navigationLinking: LinkingOptions<RootStackParamList> | null = null,
) {
  return render(
    <App
      authFacade={fakes.authFacade}
      observabilityFacade={fakes.observabilityFacade}
      queryClient={fakes.queryClient}
      transport={fakes.transport}
      locale="en"
      safeAreaMetrics={fallbackSafeAreaMetrics}
      navigationLinking={navigationLinking}
    />,
  )
}

function seedEveryMobileUserState() {
  useEpisodicMemoryStore.getState().setAll([
    {
      id: 'memory-a',
      name: 'A private memory',
      emotion: { mood: 'JOY', valence: 0.82, arousal: 0.72, intensity: 0.7 },
      baseStrength: 0.61,
      recallCount: 0,
      createdUniverseTime: '2026-07-22',
      lastRecalledUniverseTime: null,
      seed: null,
      activations: [{ neuronId: 'neuron-a', weight: 1 }],
      decayStages: [],
      forgettingOffsetDays: 0,
      currentText: 'A private memory',
      semanticStage: 0,
    },
  ])
  useNeuronStore.getState().setAll([
    { id: 'neuron-a', name: 'private', neuronType: 'semantic', connectivity: 1 },
    { id: 'neuron-b', name: 'memory', neuronType: 'semantic', connectivity: 1 },
  ])
  useSynapseStore.getState().setAll([
    {
      id: 'synapse-a',
      neuronAId: 'neuron-a',
      neuronBId: 'neuron-b',
      strength: 0.5,
      coActivationCount: 1,
      lastActivatedUniverseTime: '2026-07-22',
    },
  ])
  useUniverseClockStore.setState({ currentUniverseTime: '2026-07-22' })
  useDiaryStore.getState().setAll([
    {
      id: 'diary-a',
      body: 'A private diary',
      diaryDate: '2026-07-22',
      createdUniverseTime: '2026-07-22',
      memories: [{ episodicMemoryId: 'memory-a', name: 'A private memory', mood: 'JOY' }],
    },
  ])
  useTwinkleBalanceStore.setState({ basic: 4n, additional: 7n, loaded: true })
  useReleasedGroupsStore.setState({
    groups: [
      {
        diaryId: 'diary-a',
        deletedAt: '2026-07-22T00:00:00Z',
        episodicMemoryIds: ['memory-a'],
        removedMemories: [],
      },
    ],
  })
  useRecallTargetStore.setState({ memoryId: 'memory-a' })
  useOpenDiaryTargetStore.setState({ memoryId: 'memory-a' })
  usePendingFlyTargetStore.setState({ nodeId: 'memory-a' })
  useChargeRequestStore.setState({ requested: true })
  useDeletionTargetStore.setState({ target: { mode: 'delete', diaryId: 'diary-a' } })
  useLatentConsumedStore.setState({ consumed: new Set([1]) })
  useAwakenRegistryStore.setState({ claimed: new Set(['neuron-a']) })
  useAdvanceAnnouncementStore.setState({
    pending: {
      interval: { previous: '2026-07-21', current: '2026-07-22' },
      revealNeuronIds: ['neuron-a'],
    },
  })
  useLaunchedNeuronsStore.setState({ newNeuronIds: ['neuron-a'] })
  useDiaryDraftStore.setState({ body: 'A private diary draft', diaryDate: '2026-07-22' })
  useProposalStore.setState({ memories: [{} as never] })
  useRecallDraftStore.setState({ rewrite: 'A private recall', result: {} as never })
  useDeletionDraftStore.setState({
    phrase: 'A private letting-go phrase',
    candidates: [{} as never],
    selectedNeuronIds: ['neuron-a'],
    heavyDetected: true,
  })
}

function expectEveryMobileUserStateEmpty() {
  expect(useEpisodicMemoryStore.getState()).toMatchObject({ byId: {}, ids: [] })
  expect(useNeuronStore.getState()).toMatchObject({ byId: {}, ids: [] })
  expect(useSynapseStore.getState()).toMatchObject({ byId: {}, ids: [] })
  expect(useUniverseClockStore.getState().currentUniverseTime).toBeNull()
  expect(useDiaryStore.getState()).toMatchObject({ byId: {}, ids: [] })
  expect(useTwinkleBalanceStore.getState()).toMatchObject({
    basic: 0n,
    additional: 0n,
    loaded: false,
  })
  expect(useReleasedGroupsStore.getState().groups).toEqual([])
  expect(useRecallTargetStore.getState().memoryId).toBeNull()
  expect(useOpenDiaryTargetStore.getState().memoryId).toBeNull()
  expect(usePendingFlyTargetStore.getState().nodeId).toBeNull()
  expect(useChargeRequestStore.getState().requested).toBe(false)
  expect(useDeletionTargetStore.getState().target).toBeNull()
  expect(useLatentConsumedStore.getState().consumed.size).toBe(0)
  expect(useAwakenRegistryStore.getState().claimed.size).toBe(0)
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
}

describe('mobile auth gate', () => {
  it('lands an authenticated session on the universe with the first-run welcome', async () => {
    const fakes = createMobileShellFakes({
      userId: 'gate-test-user',
      diagnosticsEnabled: true,
      transport: createMobileAppTransport(),
    })
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    // Unmount BEFORE dispose, here and below: disposing (cache.clear) under a mounted tree lets
    // the still-subscribed query observers re-create their cache entries, and the later automatic
    // unmount then schedules fresh gc timers (defaultGcMs = minutes) that outlive the suite.
    const view = renderShell(fakes)
    try {
      // The universe stack: the quiet archive entry sits outside the canvas error boundary, so it
      // is present whether or not the (host-stubbed) 3D renderer mounts.
      await waitFor(() => expect(screen.getByText(m.diary_reader_title())).toBeTruthy())
      // First-run welcome for a zero-memory read ([V7]) — the same widget tree, no separate route.
      await waitFor(() => expect(screen.getByText(m.universe_first_run_welcome())).toBeTruthy())
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })

  it('lands a settled signed-out session on the login stack, not the universe', async () => {
    const fakes = createMobileShellFakes({})
    const view = renderShell(fakes)
    try {
      await waitFor(() => expect(screen.getByText(m.login_title())).toBeTruthy())
      // The universe never mounts for a signed-out session (its GetUniverse read never issues).
      expect(screen.queryByText(m.diary_reader_title())).toBeNull()
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })

  it('holds the neutral splash while the session bootstraps — never a signed-out flash', async () => {
    const fakes = createMobileShellFakes({
      userId: 'gate-test-user',
      transport: createMobileAppTransport(),
    })
    const view = renderShell(fakes)
    try {
      // The fake adapter settles on a microtask, so synchronously after render the session is
      // still bootstrapping: the splash is mounted and neither the login stack nor the universe is.
      expect(screen.getByText(m.common_loading())).toBeTruthy()
      expect(screen.queryByText(m.login_title())).toBeNull()
      expect(screen.queryByText(m.diary_reader_title())).toBeNull()
      // Once settled, the gate swaps to the universe stack — the splash was a hold, not a route.
      await waitFor(() => expect(screen.getByText(m.diary_reader_title())).toBeTruthy())
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })

  it('sign-out unmounts the universe and returns to the login stack', async () => {
    const fakes = createMobileShellFakes({
      userId: 'gate-test-user',
      transport: createMobileAppTransport(),
    })
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    const view = renderShell(fakes)
    try {
      await waitFor(() => expect(screen.getByText(m.diary_reader_title())).toBeTruthy())
      // The [04] facade action settles the session to signedOut; the gate observes the same
      // snapshot and swaps stacks — the universe view unmounts, nothing is deleted server-side.
      await act(() => fakes.authFacade.signOut())
      await waitFor(() => expect(screen.getByText(m.login_title())).toBeTruthy())
      expect(screen.queryByText(m.diary_reader_title())).toBeNull()
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })

  it('reaches the dev diagnostics surface by deep link without leaking secrets', async () => {
    const fakes = createMobileShellFakes({ userId: 'gate-test-user', diagnosticsEnabled: true })
    const view = renderShell(fakes, {
      prefixes: ['cosimosi://'],
      config: {
        screens: {
          [ROUTES.diagnostics]: 'diagnostics',
          [ROUTES.universe]: 'universe',
          [ROUTES.diaryReader]: 'diary',
        },
      },
      getInitialURL: async () => 'cosimosi://diagnostics',
    })
    try {
      await waitFor(() => expect(screen.getByText(m.mobile_diagnostics_title())).toBeTruthy())
      // Provider health only — never the access token or product/private data.
      expect(screen.queryByText(/fake-token/)).toBeNull()
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })

  it('registers no landing/marketing route — login and the universe are the only entries', () => {
    const names = Object.values(ROUTES)
    expect(names).not.toContain('Landing')
    expect(names).toContain('Login')
    expect(names).toContain('Universe')
  })

  it('isolates every client-state category across universe, diary, settings, A → logout → B', async () => {
    let paletteReads = 0
    let resolveLatePalette = (_paletteId: string) => {}
    const latePalette = new Promise<string>((resolve) => {
      resolveLatePalette = resolve
    })
    const fakes = createMobileShellFakes({
      userId: 'user-a',
      transport: createMobileAppTransport({
        getPalettePreference: () => (++paletteReads === 1 ? 'muted-dusk' : DEFAULT_PALETTE_ID),
        setPalettePreference: () => latePalette,
      }),
    })
    const view = renderShell(fakes)
    try {
      await waitFor(() => expect(screen.getByText(m.universe_first_run_welcome())).toBeTruthy())
      expect(usePalettePreferenceStore.getState()).toMatchObject({
        paletteId: 'muted-dusk',
        confirmedPaletteId: 'muted-dusk',
      })
      expect(moodColor('JOY')).toBe('#e8c07d')

      fireEvent.press(screen.getByRole('button', { name: m.diary_reader_title() }))
      await waitFor(() => expect(screen.getByText(m.diary_reader_back())).toBeTruthy())
      fireEvent.press(screen.getByRole('button', { name: m.diary_reader_back() }))
      await waitFor(() =>
        expect(screen.getByRole('button', { name: m.settings_title() })).toBeTruthy(),
      )
      fireEvent.press(screen.getByRole('button', { name: m.settings_title() }))
      await waitFor(() => expect(screen.getByText(m.settings_section_account())).toBeTruthy())

      await act(async () => {
        seedEveryMobileUserState()
      })
      fakes.queryClient.setQueryData(['user-a-only'], 'A private query')
      let consent!: Promise<'proceed' | 'cancel'>
      act(() => {
        consent = requestTimeSyncConsent()
      })
      fireEvent.press(screen.getByRole('button', { name: m.palette_name_cosimosi_default() }))
      await waitFor(() =>
        expect(usePalettePreferenceStore.getState().paletteId).toBe(DEFAULT_PALETTE_ID),
      )

      await act(() => fakes.authFacade.signOut())
      await waitFor(() => expect(screen.getByText(m.login_title())).toBeTruthy())
      expectEveryMobileUserStateEmpty()
      expect(fakes.queryClient.getQueryCache().getAll()).toHaveLength(0)
      await expect(consent).resolves.toBe('cancel')

      await act(() =>
        fakes.authFacade.signIn({ email: 'user-b@example.test', password: 'test-password' }),
      )
      await waitFor(() => expect(screen.getByText(m.universe_first_run_welcome())).toBeTruthy())
      expectEveryMobileUserStateEmpty()
      expect(fakes.queryClient.getQueryData(['user-a-only'])).toBeUndefined()

      await act(async () => {
        resolveLatePalette('muted-dusk')
        await latePalette
      })
      expect(usePalettePreferenceStore.getState()).toMatchObject({
        paletteId: DEFAULT_PALETTE_ID,
        confirmedPaletteId: DEFAULT_PALETTE_ID,
      })

      fireEvent.press(screen.getByRole('button', { name: m.settings_title() }))
      await waitFor(() => expect(screen.getByText('fake-user-user-b@example.test')).toBeTruthy())
      expect(screen.queryByText('user-a')).toBeNull()
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })
})

describe('mobile settings screen', () => {
  afterEach(() => {
    act(() => {
      usePalettePreferenceStore.getState().setPaletteId(DEFAULT_PALETTE_ID)
      resetMoodPalette()
    })
  })

  async function openSettings(fakes: MobileShellFakes) {
    const view = renderShell(fakes)
    await waitFor(() => expect(screen.getByText(m.settings_title())).toBeTruthy())
    fireEvent.press(screen.getByText(m.settings_title()))
    await waitFor(() => expect(screen.getByText(m.settings_section_account())).toBeTruthy())
    return view
  }

  // A1/A3/A6/A11: the universe affordance reaches the registered SettingsScreen; the composition
  // renders the identity from the snapshot, the registry palettes with the stored preference
  // marked, and the reserved staging slot — from the same message keys as web.
  it('opens settings from the universe with the three sections composed', async () => {
    const fakes = createMobileShellFakes({
      userId: 'settings-test-user',
      transport: createMobileAppTransport(),
    })
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    const view = await openSettings(fakes)
    try {
      expect(screen.getByText('settings-test-user')).toBeTruthy()
      expect(screen.getByText(m.settings_section_palette())).toBeTruthy()
      expect(screen.getByText(m.palette_name_cosimosi_default())).toBeTruthy()
      expect(screen.getByText(m.palette_name_muted_dusk())).toBeTruthy()
      expect(screen.getByText(m.settings_palette_selected())).toBeTruthy()
      expect(screen.getByText(m.settings_staging_notice())).toBeTruthy()
      expect(screen.getByText(m.settings_staging_boundary())).toBeTruthy()
      // A7 structurally: nothing on the page edits anything — no switch/slider/text input exists.
      expect(screen.queryAllByRole('switch')).toHaveLength(0)
      expect(screen.queryAllByRole('adjustable')).toHaveLength(0)
      expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0)
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })

  // A3: sign-out sits behind a plain confirm — cancel does nothing, confirm signs out once and
  // the plan-53 gate lands on login (the section itself never navigates).
  it('signs out through the confirm step and returns to login; cancel stays put', async () => {
    const fakes = createMobileShellFakes({
      userId: 'settings-test-user',
      transport: createMobileAppTransport(),
    })
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    const view = await openSettings(fakes)
    try {
      fireEvent.press(screen.getByText(m.settings_sign_out()))
      await waitFor(() => expect(screen.getByText(m.settings_sign_out_confirm())).toBeTruthy())
      fireEvent.press(screen.getByText(m.common_cancel()))
      await waitFor(() => expect(screen.queryByText(m.settings_sign_out_confirm())).toBeNull())
      expect(screen.getByText(m.settings_section_account())).toBeTruthy()
      expect(fakes.authFacade.snapshot.status).toBe('authenticated')

      fireEvent.press(screen.getByText(m.settings_sign_out()))
      await waitFor(() => expect(screen.getByText(m.settings_sign_out_confirm())).toBeTruthy())
      fireEvent.press(screen.getAllByText(m.settings_sign_out()).at(-1) as never)
      await waitFor(() => expect(screen.getByText(m.login_title())).toBeTruthy())
      expect(fakes.authFacade.snapshot.status).toBe('signedOut')
      expect(screen.queryByText(m.settings_section_account())).toBeNull()
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })

  // A4: selecting a palette goes through [51]'s set-and-apply — the optimistic flip is immediate,
  // and when the controlled persist is rejected the store reverts. A bare setMoodPalette call
  // would do neither.
  it('routes a palette selection through set-and-apply (optimistic flip, revert on failure)', async () => {
    let rejectPersist = (_error: Error) => {}
    let persistStarted = false
    const persistBlocked = new Promise<string>((_resolve, reject) => {
      rejectPersist = reject
    })
    const fakes = createMobileShellFakes({
      userId: 'settings-test-user',
      transport: createMobileAppTransport({
        setPalettePreference: () => {
          persistStarted = true
          return persistBlocked
        },
      }),
    })
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    const view = await openSettings(fakes)
    try {
      fireEvent.press(
        screen.getByRole('button', { name: m.palette_name_muted_dusk(), disabled: false }),
      )
      await waitFor(() => expect(persistStarted).toBe(true))
      await waitFor(() => expect(usePalettePreferenceStore.getState().paletteId).toBe('muted-dusk'))
      await act(() => {
        rejectPersist(new Error('server refused'))
      })
      await waitFor(() =>
        expect(usePalettePreferenceStore.getState().paletteId).toBe(DEFAULT_PALETTE_ID),
      )
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })
})
