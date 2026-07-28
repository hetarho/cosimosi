import { Linking, Share, TextInput } from 'react-native'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { createRouterTransport } from '@connectrpc/connect'

import type { LinkingOptions } from '@react-navigation/native'

import {
  AccountService,
  AuthProviderKind,
  createGetUniverseQueryKey,
  ExportFormat,
  MemoryService,
  type GetUniverseResponse,
} from '@cosimosi/api-client'
import { pendingInvite, resetSignupUserState, takeSignupCompletion } from '@cosimosi/auth'
import { VALUES } from '@cosimosi/config'
import { DEFAULT_PALETTE_ID, moodColor, resetMoodPalette } from '@cosimosi/emotion'
import { setClientCacheData } from '@cosimosi/client-cache'
import { m } from '@cosimosi/i18n'
import { useEarnRequestStore, useTwinkleBalanceStore } from '@cosimosi/twinkle'
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
    profilePresent?: boolean
    profileError?: boolean
    onGetProfile?: () => void
    onGetUniverse?: () => void
    onGetPalettePreference?: () => void
    onGetMoodColors?: () => void
    onSignUp?: (request: {
      nickname: string
      timezone: string
      locale: string
      inviteToken: string
    }) => void
    onUpdateProfile?: (request: { nickname: string; timezone: string; locale: string }) => void
    onWithdraw?: () => void
    onExport?: (format: ExportFormat) => void
    getPalettePreference?: () => string
    getMoodColors?: () => Array<{ mood: string; color: string }>
    setPalettePreference?: (paletteId: string) => Promise<string>
    onSetMoodColor?: (request: { mood: string; color: string }) => void
  } = {},
) {
  let profilePresent = options.profilePresent !== false
  let currentProfile = {
    nickname: 'Test user',
    timezone: 'UTC',
    locale: 'en',
    email: 'test@example.test',
    createdAt: '2026-07-26T00:00:00Z',
  }
  return createRouterTransport(({ service }) => {
    service(AccountService, {
      getProfile: () => {
        options.onGetProfile?.()
        if (options.profileError) throw new Error('profile refused')
        return !profilePresent
          ? {}
          : {
              profile: currentProfile,
            }
      },
      signUp(request) {
        options.onSignUp?.({
          nickname: request.nickname,
          timezone: request.timezone,
          locale: request.locale,
          inviteToken: request.inviteToken,
        })
        profilePresent = true
        return {
          nickname: request.nickname,
          timezone: request.timezone,
          locale: request.locale,
          inviteBound: request.inviteToken !== '',
        }
      },
      updateProfile(request) {
        options.onUpdateProfile?.({
          nickname: request.nickname,
          timezone: request.timezone,
          locale: request.locale,
        })
        currentProfile = {
          ...currentProfile,
          nickname: request.nickname,
          timezone: request.timezone,
          locale: request.locale,
        }
        return { profile: currentProfile }
      },
      listAuthProviders: () => ({
        providers: [
          {
            kind: AuthProviderKind.GOOGLE,
            linkedAt: '2026-07-26T00:00:00Z',
          },
        ],
      }),
      getInviteLink: () => ({
        token: 'invite-token',
        expiresAt: '2026-08-02T00:00:00Z',
      }),
      withdraw: () => {
        options.onWithdraw?.()
        return {
          withdrawnAt: '2026-07-26T00:00:00Z',
          restoreDeadlineAt: '2026-08-25T00:00:00Z',
        }
      },
      getPalettePreference: () => {
        options.onGetPalettePreference?.()
        return {
          paletteId: options.getPalettePreference?.() ?? DEFAULT_PALETTE_ID,
        }
      },
      async setPalettePreference(request) {
        return {
          paletteId: options.setPalettePreference
            ? await options.setPalettePreference(request.paletteId)
            : request.paletteId,
        }
      },
      getMoodColors: () => {
        options.onGetMoodColors?.()
        return { colors: options.getMoodColors?.() ?? [] }
      },
      setMoodColor: (request) => {
        options.onSetMoodColor?.({ mood: request.mood, color: request.color })
        return { mood: request.mood, color: request.color }
      },
      getMoodColorStats: () => ({ stats: [] }),
    })
    service(MemoryService, {
      getUniverse: () => {
        options.onGetUniverse?.()
        return emptyUniverse
      },
      export: (request) => {
        options.onExport?.(request.format)
        return {
          content: new TextEncoder().encode('date,body\\n2026-07-26,hello'),
          contentType: 'text/plain',
          filename: request.format === ExportFormat.CSV ? 'diaries.csv' : 'diaries.md',
        }
      },
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
  useTwinkleBalanceStore.setState({ small: 4n, general: 7n, loaded: true })
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
  useEarnRequestStore.setState({ requested: true })
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
    small: 0n,
    general: 0n,
    loaded: false,
  })
  expect(useReleasedGroupsStore.getState().groups).toEqual([])
  expect(useRecallTargetStore.getState().memoryId).toBeNull()
  expect(useOpenDiaryTargetStore.getState().memoryId).toBeNull()
  expect(usePendingFlyTargetStore.getState().nodeId).toBeNull()
  expect(useEarnRequestStore.getState().requested).toBe(false)
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

  it('navigates reciprocally between sign-in and sign-up with both methods visible', async () => {
    const fakes = createMobileShellFakes({})
    const view = renderShell(fakes)
    try {
      await waitFor(() => expect(screen.getByText(m.login_title())).toBeTruthy())
      fireEvent.press(screen.getByText(m.login_to_signup()))
      await waitFor(() => expect(screen.getByText(m.signup_title())).toBeTruthy())
      expect(screen.getByText(m.signup_google())).toBeTruthy()
      expect(screen.getByText(m.signup_submit())).toBeTruthy()

      fireEvent.press(screen.getByText(m.signup_to_login()))
      await waitFor(() => expect(screen.getByText(m.login_title())).toBeTruthy())
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })

  it('captures an exact invite deep link and opens signup without a code field', async () => {
    const initialUrl = jest
      .spyOn(Linking, 'getInitialURL')
      .mockResolvedValue('cosimosi://invite/opaque-token')
    const fakes = createMobileShellFakes({})
    const view = renderShell(fakes)
    try {
      await waitFor(() => expect(screen.getByText(m.signup_title())).toBeTruthy())
      expect(screen.getByText(m.invite_acknowledgment())).toBeTruthy()
      expect(pendingInvite.peek()).toBe('opaque-token')
      expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(2)
    } finally {
      view.unmount()
      fakes.dispose()
      pendingInvite.clear()
      initialUrl.mockResolvedValue(null)
    }
  })

  it('withholds every product read and shows one nickname field when profile is absent', async () => {
    let profileReads = 0
    let paletteReads = 0
    let universeReads = 0
    const fakes = createMobileShellFakes({
      userId: 'new-user',
      transport: createMobileAppTransport({
        profilePresent: false,
        onGetProfile: () => {
          profileReads += 1
        },
        onGetMoodColors: () => {
          paletteReads += 1
        },
        onGetUniverse: () => {
          universeReads += 1
        },
      }),
    })
    const view = renderShell(fakes)
    try {
      await waitFor(() => expect(screen.getByText(m.signup_nickname_title())).toBeTruthy())
      expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(1)
      expect(profileReads).toBe(1)
      expect(paletteReads).toBe(0)
      expect(universeReads).toBe(0)
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })

  it('shows the neutral retry-or-sign-out arm only for a refused profile read', async () => {
    const fakes = createMobileShellFakes({
      userId: 'refused-user',
      transport: createMobileAppTransport({ profileError: true }),
    })
    const view = renderShell(fakes)
    try {
      await waitFor(() => expect(screen.getByText(m.signup_profile_refused())).toBeTruthy())
      expect(screen.getByText(m.signup_profile_retry())).toBeTruthy()
      expect(screen.getByText(m.signup_profile_sign_out())).toBeTruthy()
      expect(screen.queryByText(m.signup_nickname_title())).toBeNull()
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })

  it('places the color screen after nickname, then hands the first universe signal on', async () => {
    let payload:
      { nickname: string; timezone: string; locale: string; inviteToken: string } | undefined
    let moodColorWrites = 0
    const fakes = createMobileShellFakes({
      userId: 'new-user',
      transport: createMobileAppTransport({
        profilePresent: false,
        onSignUp: (request) => {
          payload = request
        },
        onSetMoodColor: () => {
          moodColorWrites += 1
        },
      }),
    })
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    const view = renderShell(fakes)
    try {
      await waitFor(() => expect(screen.getByText(m.signup_nickname_title())).toBeTruthy())
      pendingInvite.capture('stale-token')
      fireEvent.changeText(screen.UNSAFE_getByType(TextInput), 'Nova')
      fireEvent.press(screen.getByText(m.signup_nickname_submit()))

      await waitFor(() => expect(screen.getByText(m.mood_color_onboarding_title())).toBeTruthy())
      expect(screen.queryByText(m.universe_first_run_welcome())).toBeNull()
      expect(payload).toMatchObject({
        nickname: 'Nova',
        locale: 'en',
        inviteToken: 'stale-token',
      })
      expect(payload?.timezone).toBeTruthy()
      expect(takeSignupCompletion()).toBe(false)
      fireEvent.press(screen.getByText(m.mood_color_onboarding_skip()))
      await waitFor(() => expect(screen.getByText(m.universe_first_run_welcome())).toBeTruthy())
      expect(moodColorWrites).toBe(0)
      expect(takeSignupCompletion()).toBe(true)
      expect(takeSignupCompletion()).toBe(false)
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })

  it('applies and persists a recommendation live on the color screen', async () => {
    let saved: { mood: string; color: string } | undefined
    const fakes = createMobileShellFakes({
      userId: 'color-onboarding-user',
      transport: createMobileAppTransport({
        profilePresent: false,
        onSetMoodColor: (request) => {
          saved = request
        },
      }),
    })
    const view = renderShell(fakes)
    try {
      await waitFor(() => expect(screen.getByText(m.signup_nickname_title())).toBeTruthy())
      fireEvent.changeText(screen.UNSAFE_getByType(TextInput), 'Nova')
      fireEvent.press(screen.getByText(m.signup_nickname_submit()))
      await waitFor(() => expect(screen.getByText(m.mood_color_onboarding_title())).toBeTruthy())
      fireEvent.press(screen.getAllByLabelText(m.palette_recommendation_label())[1])
      await waitFor(() => expect(saved).toBeDefined())
      expect(saved?.mood).toBe('JOY')
      expect(moodColor('JOY')).toBe(saved?.color)
    } finally {
      view.unmount()
      fakes.dispose()
      resetSignupUserState()
      resetMoodPalette()
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
    const fakes = createMobileShellFakes({
      userId: 'gate-test-user',
      diagnosticsEnabled: true,
      transport: createMobileAppTransport(),
    })
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

  it('isolates every client-state category across universe and diary, A → logout → B', async () => {
    let colorReads = 0
    const fakes = createMobileShellFakes({
      userId: 'user-a',
      transport: createMobileAppTransport({
        getMoodColors: () => (++colorReads === 1 ? [{ mood: 'JOY', color: '#f2b036' }] : []),
      }),
    })
    const view = renderShell(fakes)
    try {
      await waitFor(() => expect(screen.getByText(m.universe_first_run_welcome())).toBeTruthy())
      expect(moodColor('JOY')).toBe('#f2b036')

      fireEvent.press(screen.getByRole('button', { name: m.diary_reader_title() }))
      await waitFor(() => expect(screen.getByText(m.diary_reader_back())).toBeTruthy())
      fireEvent.press(screen.getByRole('button', { name: m.diary_reader_back() }))
      await waitFor(() => expect(screen.getByRole('button', { name: m.me_title() })).toBeTruthy())

      await act(async () => {
        seedEveryMobileUserState()
      })
      fakes.queryClient.setQueryData(['user-a-only'], 'A private query')
      let consent!: Promise<'proceed' | 'cancel'>
      act(() => {
        consent = requestTimeSyncConsent()
      })

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

      expect(usePalettePreferenceStore.getState()).toMatchObject({
        paletteId: DEFAULT_PALETTE_ID,
        confirmedPaletteId: DEFAULT_PALETTE_ID,
      })

      fireEvent.press(screen.getByRole('button', { name: m.me_title() }))
      await waitFor(() => expect(screen.getByText(m.me_tab_profile())).toBeTruthy())
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })
})

describe('mobile me screen', () => {
  afterEach(() => {
    act(() => {
      usePalettePreferenceStore.getState().setPaletteId(DEFAULT_PALETTE_ID)
      resetMoodPalette()
    })
  })

  async function openMe(fakes: MobileShellFakes) {
    const view = renderShell(fakes)
    await waitFor(() => expect(screen.getByText(m.me_title())).toBeTruthy())
    fireEvent.press(screen.getByText(m.me_title()))
    await waitFor(() => expect(screen.getByText(m.me_nickname_label())).toBeTruthy())
    return view
  }

  it('opens Me with five local-state tabs and no decoration controls', async () => {
    const fakes = createMobileShellFakes({
      userId: 'me-test-user',
      transport: createMobileAppTransport(),
    })
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    const view = await openMe(fakes)
    try {
      expect(screen.getAllByRole('tab')).toHaveLength(5)
      expect(screen.getByText(m.me_tab_profile())).toBeTruthy()
      expect(screen.getByText(m.me_tab_stardust())).toBeTruthy()
      expect(screen.getByText(m.me_tab_achievements())).toBeTruthy()
      expect(screen.getByText(m.me_tab_diary())).toBeTruthy()
      expect(screen.getByText(m.me_tab_account())).toBeTruthy()
      expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(1)
      expect(screen.queryByText(m.settings_palette_selected())).toBeNull()

      fireEvent.press(screen.getByText(m.me_tab_achievements()))
      expect(screen.getByText(m.me_achievements_pending())).toBeTruthy()
      fireEvent.press(screen.getByText(m.me_tab_diary()))
      expect(screen.getByText(m.me_export_action())).toBeTruthy()
      fireEvent.press(screen.getByText(m.me_tab_account()))
      await waitFor(() => expect(screen.getByText('test@example.test')).toBeTruthy())
      await waitFor(() => expect(screen.getByText(m.me_provider_google())).toBeTruthy())
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })

  // A3: sign-out sits behind a plain confirm — cancel does nothing, confirm signs out once and
  // the plan-53 gate lands on login (the section itself never navigates).
  it('signs out through the confirm step and returns to login; cancel stays put', async () => {
    const fakes = createMobileShellFakes({
      userId: 'me-test-user',
      transport: createMobileAppTransport(),
    })
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    const view = await openMe(fakes)
    try {
      fireEvent.press(screen.getByText(m.me_tab_account()))
      fireEvent.press(screen.getByText(m.me_sign_out()))
      await waitFor(() => expect(screen.getByText(m.me_sign_out_confirm())).toBeTruthy())
      fireEvent.press(screen.getByText(m.common_cancel()))
      await waitFor(() => expect(screen.queryByText(m.me_sign_out_confirm())).toBeNull())
      expect(screen.getByText(m.me_tab_account())).toBeTruthy()
      expect(fakes.authFacade.snapshot.status).toBe('authenticated')

      fireEvent.press(screen.getByText(m.me_sign_out()))
      await waitFor(() => expect(screen.getByText(m.me_sign_out_confirm())).toBeTruthy())
      fireEvent.press(screen.getAllByText(m.me_sign_out()).at(-1) as never)
      await waitFor(() => expect(screen.getByText(m.login_title())).toBeTruthy())
      expect(fakes.authFacade.snapshot.status).toBe('signedOut')
      expect(screen.queryByText(m.me_tab_account())).toBeNull()
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })

  it('exports both formats through the native share sheet without query retention', async () => {
    const formats: ExportFormat[] = []
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' })
    const fakes = createMobileShellFakes({
      userId: 'me-test-user',
      transport: createMobileAppTransport({
        onExport: (format) => formats.push(format),
      }),
    })
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    const view = await openMe(fakes)
    try {
      fireEvent.press(screen.getByText(m.me_tab_diary()))
      fireEvent.press(screen.getByText(m.me_export_action()))
      await waitFor(() => expect(formats).toEqual([ExportFormat.CSV]))
      fireEvent.press(screen.getByText(m.me_export_format_md()))
      fireEvent.press(screen.getByText(m.me_export_action()))
      await waitFor(() => expect(formats).toEqual([ExportFormat.CSV, ExportFormat.MD]))
      expect(share).toHaveBeenCalledTimes(2)
      expect(fakes.queryClient.getQueryCache().findAll({ queryKey: ['export'] })).toHaveLength(0)
    } finally {
      share.mockRestore()
      view.unmount()
      fakes.dispose()
    }
  })

  it('offers export at withdrawal, interpolates retention, then withdraws and signs out', async () => {
    let withdrawals = 0
    const fakes = createMobileShellFakes({
      userId: 'me-test-user',
      transport: createMobileAppTransport({
        onWithdraw: () => {
          withdrawals += 1
        },
      }),
    })
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    const view = await openMe(fakes)
    try {
      fireEvent.press(screen.getByText(m.me_tab_account()))
      fireEvent.press(screen.getByText(m.withdraw_start()))
      expect(
        screen.getByText(
          m.withdraw_description({
            days: String(VALUES.release.softDeleteRetentionDays),
          }),
        ),
      ).toBeTruthy()
      expect(screen.getByText(m.withdraw_export_offer())).toBeTruthy()
      expect(screen.getByText(m.me_export_action())).toBeTruthy()

      fireEvent.press(screen.getByText(m.withdraw_confirm()))
      await waitFor(() => expect(screen.getByText(m.login_title())).toBeTruthy())
      expect(withdrawals).toBe(1)
      expect(fakes.authFacade.snapshot.status).toBe('signedOut')
    } finally {
      view.unmount()
      fakes.dispose()
    }
  })
})
