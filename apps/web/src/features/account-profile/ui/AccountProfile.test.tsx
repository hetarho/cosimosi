// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRouterTransport } from '@connectrpc/connect'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AccountService, type UpdateProfileRequest } from '@cosimosi/api-client'
import { ErrorToastContext } from '@cosimosi/errors/react'
import { getActiveLocale, m, setActiveLocale } from '../../../shared/i18n/index.ts'

import { readStoredLocale, writeStoredLocale } from '../../../shared/lib/locale-storage.ts'
import { AccountProfile } from './AccountProfile.tsx'

const storedLocales = new Map<string, string>()

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storedLocales.get(key) ?? null,
      setItem: (key: string, value: string) => storedLocales.set(key, value),
    },
  })
})

afterEach(() => {
  cleanup()
  storedLocales.clear()
  setActiveLocale('en')
})

describe('AccountProfile', () => {
  it('issues one complete update for one confirmed nickname edit', async () => {
    const requests: Array<{ nickname: string; timezone: string; locale: string }> = []
    const harness = renderProfile({
      updateProfile(request) {
        requests.push({
          nickname: request.nickname,
          timezone: request.timezone,
          locale: request.locale,
        })
        return { profile: { ...profile, nickname: request.nickname } }
      },
    })
    const user = userEvent.setup()

    await user.clear(await screen.findByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Nova')
    await user.click(screen.getByRole('button', { name: 'Keep this name' }))

    await waitFor(() =>
      expect(requests).toEqual([{ nickname: 'Nova', timezone: 'UTC', locale: 'en' }]),
    )
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText(/does not refill today's small stardust/)).toBeTruthy()
    harness.queryClient.clear()
  })

  it('applies and stores locale before the write, then rolls both back on refusal', async () => {
    const order: string[] = []
    const showError = vi.fn()
    let rejectUpdate!: (error: Error) => void
    writeStoredLocale('en')
    renderProfile(
      {
        updateProfile() {
          order.push(`${getActiveLocale()}:${readStoredLocale()}`)
          return new Promise((_, reject) => {
            rejectUpdate = reject
          })
        },
      },
      showError,
    )
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '한국어' }))

    expect(await screen.findByText('언어')).toBeTruthy()
    await act(async () => rejectUpdate(new Error('refused')))
    await waitFor(() => expect(showError).toHaveBeenCalledTimes(1))
    expect(order).toEqual(['ko:ko'])
    expect(getActiveLocale()).toBe('en')
    expect(readStoredLocale()).toBe('en')
    expect(screen.getByText('Language')).toBeTruthy()
    expect(screen.queryByText('언어')).toBeNull()
  })
})

const profile = {
  nickname: 'Test user',
  timezone: 'UTC',
  locale: 'en',
  email: 'test@example.test',
  createdAt: '2026-07-26T00:00:00Z',
}

function renderProfile(
  handlers: {
    updateProfile: (request: UpdateProfileRequest) => unknown
  },
  showError = vi.fn(),
) {
  const transport = createRouterTransport(({ service }) => {
    service(AccountService, {
      getProfile: () => ({ profile }),
      updateProfile: (request) => handlers.updateProfile(request) as never,
      getInviteLink: () => ({
        token: 'opaque',
        expiresAt: '2026-08-02T00:00:00Z',
      }),
    })
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <ErrorToastContext.Provider value={showError}>
      <TransportProvider transport={transport}>
        <QueryClientProvider client={queryClient}>
          <AccountProfile />
        </QueryClientProvider>
      </TransportProvider>
    </ErrorToastContext.Provider>,
  )
  return { queryClient }
}

import { createConnectQueryKey } from '@connectrpc/connect-query'
import {
  AdminService,
  MemoryService,
  TwinkleService,
  SpendKind,
  createGetProfileQueryKey,
  createGetProfileQueryOptions,
  createGetBalanceQueryOptions,
  createQuoteSpendQueryOptions,
  createGetLedgerInfiniteQueryOptions,
  createTwinkleServiceQueryKey,
  createSyncStatusQueryOptions,
  createGetUniverseQueryOptions,
  createGetDiaryCalendarInfiniteQueryOptions,
  createListUsersQueryOptions,
} from '@cosimosi/api-client'
import { createClientCacheQueryClient } from '@cosimosi/client-cache'
import { useTwinkleLedgerInfiniteQuery } from '@cosimosi/twinkle/react'
import { VALUES } from '@cosimosi/config'

// Only the device observation is injected; no date, cache, controller or currency code is mocked.
vi.mock('../../../shared/i18n/index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/i18n/index.ts')>()
  return { ...actual, resolveDeviceTimeZone: () => 'Asia/Seoul' }
})

function deferredReply() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function dayFixture(name: string) {
  const facts = {
    name,
    setup: {} as Record<string, boolean>,
    events: [] as Array<{ event: string; data: unknown }>,
    featureOracle: null as unknown,
    cleanup: { ok: false } as {
      ok: boolean
      error?: string
      mounted?: number
      unmounted?: number
      ownedQueries?: number
      ownedMutations?: number
    },
    final: null as unknown,
  }
  const counts: Record<string, number> = {}
  const requests: Array<Record<string, unknown>> = []
  const showError = vi.fn()
  const server = {
    profile: { ...profile },
    refuse: false,
    pending: null as ReturnType<typeof deferredReply> | null,
  }
  // A fixed server-response table, not client-side timezone/pricing math. The Go ledger source and
  // existing Seoul day control establish these dates; this probe tests client cache ownership only.
  const serverDay = () => (server.profile.timezone === 'Asia/Seoul' ? '2026-07-15' : '2026-07-14')
  const count = (transportName: string, method: string, request?: unknown) => {
    const key = `${transportName}.${method}`
    counts[key] = (counts[key] ?? 0) + 1
    requests.push({ transportName, method, request })
  }
  const makeTransport = (transportName: string) =>
    createRouterTransport(({ service }) => {
      service(AccountService, {
        getProfile() {
          count(transportName, 'GetProfile')
          return { profile: { ...server.profile } }
        },
        async updateProfile(request) {
          count(transportName, 'UpdateProfile', {
            nickname: request.nickname,
            timezone: request.timezone,
            locale: request.locale,
          })
          if (server.pending) await server.pending.promise
          if (server.refuse) throw new Error('fixture refusal before profile mutation')
          server.profile = {
            ...server.profile,
            nickname: request.nickname,
            timezone: request.timezone,
            locale: request.locale,
          }
          return { profile: { ...server.profile } }
        },
      })
      service(TwinkleService, {
        getBalance() {
          count(transportName, 'GetBalance')
          return { small: 0n, general: 7n, total: 7n }
        },
        quoteSpend(request) {
          count(transportName, 'QuoteSpend', {
            kind: request.kind,
            target: request.episodicMemoryId,
          })
          return { cost: 7n, covered: true, shortfall: 0n }
        },
        getLedger(request) {
          count(transportName, 'GetLedger', {
            pageSize: request.pageSize,
            pageToken: request.pageToken,
          })
          return {
            entries: [
              {
                id: 'known-entry',
                amount: 7n,
                occurredOn: serverDay(),
                occurredAt: '2026-07-14T23:00:00Z',
              },
            ],
            nextPageToken: '',
          }
        },
      })
      service(MemoryService, {
        syncStatus() {
          count(transportName, 'SyncStatus')
          return { today: serverDay(), needsSync: false }
        },
        getUniverse() {
          count(transportName, 'GetUniverse')
          return { universeTime: '2026-07-14', universeRevision: 1n }
        },
        getDiaryCalendar(request) {
          count(transportName, 'GetDiaryCalendar', { from: request.from, to: request.to })
          return { days: [{ diaryDate: '2026-07-14', moods: [] }], nextPageToken: '' }
        },
      })
      service(AdminService, {
        listUsers(request) {
          count(transportName, 'ListUsers', {
            page: request.page,
            pageSize: request.pageSize,
            query: request.query,
          })
          return {
            users: [{ userId: 'self-user', small: 0n, general: 7n, total: 7n }],
            page: request.page,
            hasMore: false,
          }
        },
      })
    })
  const transport = makeTransport('main')
  const otherTransport = makeTransport('other')
  const client = createClientCacheQueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
  const profileOptions = createGetProfileQueryOptions(transport)
  const balanceOptions = createGetBalanceQueryOptions(transport)
  const quoteOptions = [
    createQuoteSpendQueryOptions(
      { kind: SpendKind.RESTORE_MEMORY_TEXT, episodicMemoryId: 'memory-a' },
      transport,
    ),
    createQuoteSpendQueryOptions(
      { kind: SpendKind.GIST_VIEW, episodicMemoryId: 'memory-b' },
      transport,
    ),
  ]
  const ledgerOptions = [
    createGetLedgerInfiniteQueryOptions(transport, VALUES.twinkle.ledgerPageSize),
    createGetLedgerInfiniteQueryOptions(transport, 1),
  ]
  const syncOptions = createSyncStatusQueryOptions(transport)
  const adminOptions = [
    createListUsersQueryOptions(transport, { page: 0, pageSize: 20, query: '' }),
    createListUsersQueryOptions(transport, { page: 1, pageSize: 1, query: 'self' }),
  ]
  const universeOptions = createGetUniverseQueryOptions(transport)
  const calendarOptions = createGetDiaryCalendarInfiniteQueryOptions(transport, {
    from: '2026-07-01',
    to: '2026-07-31',
  })
  const otherLedgerOptions = createGetLedgerInfiniteQueryOptions(
    otherTransport,
    VALUES.twinkle.ledgerPageSize,
  )
  const affected = [balanceOptions, ...quoteOptions, ...ledgerOptions, syncOptions, ...adminOptions]
  const negatives = [universeOptions, calendarOptions, otherLedgerOptions]
  const views = new Set<ReturnType<typeof render>>()
  let mounted = 0
  let unmounted = 0
  const record = (event: string, data: unknown) => {
    facts.events.push({ event, data })
  }
  const setup = (key: string, value: boolean) => {
    facts.setup[key] = value
    if (!value) throw new Error(`SETUP ${key}`)
  }
  const state = (options: { queryKey: readonly unknown[] }) => {
    const query = client.getQueryCache().find({ queryKey: options.queryKey, exact: true })
    if (!query) throw new Error('Expected warmed query')
    return {
      key: query.queryKey,
      hash: query.queryHash,
      age: Date.now() - query.state.dataUpdatedAt,
      invalidated: query.state.isInvalidated,
      staleByTime: query.isStaleByTime(VALUES.clientCache.defaultStaleMs),
      fetchStatus: query.state.fetchStatus,
      observers: query.getObserversCount(),
    }
  }
  const snapshot = () => ({
    serverProfile: { ...server.profile },
    counts: { ...counts },
    requests: [...requests],
    profile: state(profileOptions),
    affected: affected.map(state),
    negatives: negatives.map(state),
    errors: showError.mock.calls.length,
  })

  async function warm() {
    await client.fetchQuery(profileOptions)
    await client.fetchQuery(balanceOptions)
    for (const options of quoteOptions) await client.fetchQuery(options)
    for (const options of ledgerOptions) await client.fetchInfiniteQuery(options)
    await client.fetchQuery(syncOptions)
    for (const options of adminOptions) await client.fetchQuery(options)
    await client.fetchQuery(universeOptions)
    await client.fetchInfiniteQuery(calendarOptions)
    await client.fetchInfiniteQuery(otherLedgerOptions)
    setup(
      'production staleTime 30000',
      client.getDefaultOptions().queries?.staleTime === VALUES.clientCache.defaultStaleMs,
    )
    setup(
      'owned retry false and gc Infinity',
      client.getDefaultOptions().queries?.retry === false &&
        client.getDefaultOptions().queries?.gcTime === Infinity,
    )
    setup(
      'different ledger page-size variants',
      new Set(ledgerOptions.map((options) => state(options).hash)).size === 2,
    )
    setup(
      'all primary cache entries fresh and idle',
      [profileOptions, ...affected, ...negatives]
        .map(state)
        .every(
          (item) =>
            item !== null &&
            !item.invalidated &&
            !item.staleByTime &&
            item.age >= 0 &&
            item.age < VALUES.clientCache.defaultStaleMs &&
            item.fetchStatus === 'idle',
        ),
    )
    setup(
      'all warmed queries inactive',
      client
        .getQueryCache()
        .getAll()
        .every((query) => query.getObserversCount() === 0),
    )
    setup('Query identity shared by provider', client instanceof QueryClient)
    record('warm fetched inactive cache', snapshot())
    // Reproduce the real tab lifecycle before the profile action: this is an actual old hook
    // mount/unmount, so the later LedgerProbe mount is a remount rather than its first subscription.
    const priorLedgerReads = counts['main.GetLedger']
    const oldLedgerView = await mountLedger()
    const oldLedgerState = state(ledgerOptions[0]!)
    setup(
      'warm actual ledger shows old server day',
      oldLedgerView.container.textContent === '2026-07-14',
    )
    setup('warm actual ledger observer one', oldLedgerState?.observers === 1)
    setup(
      'warm actual fresh hook added no ledger RPC',
      priorLedgerReads === 2 && counts['main.GetLedger'] === 2,
    )
    record('warm actual ledger mounted', {
      cache: snapshot(),
      text: oldLedgerView.container.textContent,
    })
    release(oldLedgerView)
    const releasedLedger = state(ledgerOptions[0]!)
    setup('warm actual ledger observer zero after release', releasedLedger?.observers === 0)
    setup(
      'warm actual ledger remains fresh after release',
      releasedLedger !== null &&
        !releasedLedger.invalidated &&
        !releasedLedger.staleByTime &&
        releasedLedger.age >= 0 &&
        releasedLedger.age < VALUES.clientCache.defaultStaleMs &&
        releasedLedger.fetchStatus === 'idle',
    )
    record('warm actual ledger released before profile action', snapshot())
  }
  function wrap(child: React.ReactNode) {
    const view = render(
      <ErrorToastContext.Provider value={showError}>
        <TransportProvider transport={transport}>
          <QueryClientProvider client={client}>{child}</QueryClientProvider>
        </TransportProvider>
      </ErrorToastContext.Provider>,
    )
    views.add(view)
    mounted += 1
    return view
  }
  function release(view: ReturnType<typeof render>) {
    if (views.delete(view)) {
      view.unmount()
      unmounted += 1
    }
  }
  function LedgerProbe() {
    const query = useTwinkleLedgerInfiniteQuery()
    return (
      <output data-testid="actual-ledger-days">
        {query.data?.pages
          .flatMap((page) => page.entries.map((entry) => entry.occurredOn))
          .join('|') ?? 'pending'}
      </output>
    )
  }
  async function mountProfile() {
    const view = wrap(<AccountProfile />)
    await waitFor(
      () => {
        if (!view.container.textContent?.includes('UTC')) throw new Error('profile not rendered')
      },
      { timeout: 1200 },
    )
    setup(
      'actual match-device button enabled',
      !(screen.getByRole('button', { name: m.me_timezone_match_device() }) as HTMLButtonElement)
        .disabled,
    )
    return view
  }
  async function matchDevice() {
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: m.me_timezone_match_device() }))
  }
  async function settledProfile(zone: string, expectedWrites: number) {
    await waitFor(
      () => {
        if (
          server.profile.timezone !== zone ||
          counts['main.UpdateProfile'] !== expectedWrites ||
          client.getQueryState(profileOptions.queryKey)?.fetchStatus !== 'idle' ||
          client.getQueryData<{ profile?: typeof profile }>(profileOptions.queryKey)?.profile
            ?.timezone !== zone
        )
          throw new Error('actual profile mutation/refetch not settled')
      },
      { timeout: 1200 },
    )
  }
  async function mountLedger() {
    const view = wrap(<LedgerProbe />)
    await waitFor(
      () => {
        if (
          !view.container.textContent?.includes('2026-07-') ||
          client.getQueryState(ledgerOptions[0]!.queryKey)?.fetchStatus !== 'idle'
        )
          throw new Error('ledger mount not settled')
      },
      { timeout: 1200 },
    )
    await act(async () => {
      await Promise.resolve()
    })
    return view
  }
  async function targetedInvalidation() {
    await Promise.all([
      client.invalidateQueries({ queryKey: createGetProfileQueryKey(transport) }),
      client.invalidateQueries({ queryKey: createTwinkleServiceQueryKey(transport) }),
      client.invalidateQueries({ queryKey: createSyncStatusQueryOptions(transport).queryKey }),
      client.invalidateQueries({
        queryKey: createConnectQueryKey({
          schema: AdminService.method.listUsers,
          transport,
          cardinality: 'finite',
        }),
      }),
    ])
  }
  async function finish() {
    try {
      for (const view of [...views]) release(view)
      client.clear()
      await act(async () => {
        await Promise.resolve()
      })
      facts.cleanup = {
        ok:
          views.size === 0 &&
          mounted === unmounted &&
          client.getQueryCache().getAll().length === 0 &&
          client.getMutationCache().getAll().length === 0,
        mounted,
        unmounted,
        ownedQueries: client.getQueryCache().getAll().length,
        ownedMutations: client.getMutationCache().getAll().length,
      }
    } catch (error) {
      facts.cleanup = { ok: false, error: String(error) }
    }
    facts.final = { serverProfile: { ...server.profile }, counts: { ...counts } }
    if (!facts.cleanup.ok) throw new Error('OWNED CLEANUP FAILED')
  }
  return {
    facts,
    counts,
    requests,
    server,
    showError,
    client,
    affected,
    negatives,
    state,
    snapshot,
    record,
    setup,
    warm,
    wrap,
    release,
    mountProfile,
    matchDevice,
    settledProfile,
    mountLedger,
    targetedInvalidation,
    finish,
  }
}

describe('profile-dependent reads', () => {
  it('refreshes the day on a warm ledger remount after the actual timezone save', async () => {
    const h = dayFixture('primary-timezone-back-tab')
    let observed: unknown
    try {
      await h.warm()
      const view = await h.mountProfile()
      await h.matchDevice()
      await h.settledProfile('Asia/Seoul', 1)
      h.setup(
        'successful actual full payload and profile refetch',
        h.requests.some(
          (x) =>
            x.method === 'UpdateProfile' &&
            JSON.stringify(x.request) ===
              JSON.stringify({
                nickname: profile.nickname,
                timezone: 'Asia/Seoul',
                locale: profile.locale,
              }),
        ) && h.counts['main.GetProfile'] === 2,
      )
      const before = h.snapshot()
      h.record('after profile success before back-tab', before)
      h.release(view)
      const ledger = await h.mountLedger()
      const after = h.snapshot()
      h.record('actual back-tab mounted', { ...after, text: ledger.container.textContent })
      h.setup(
        'primary actions completed within fresh age',
        before.affected.every(
          (item) => item.age >= 0 && item.age < VALUES.clientCache.defaultStaleMs,
        ),
      )
      observed = {
        staleAffectedBeforeBack: before.affected.filter((item) => item.invalidated).length,
        dateAfterBack: ledger.container.textContent,
        ledgerReads: h.counts['main.GetLedger'],
        unrelatedFresh: after.negatives.every((item) => !item.invalidated && !item.staleByTime),
      }
      h.facts.featureOracle = {
        observed,
        expected: {
          staleAffectedBeforeBack: 8,
          dateAfterBack: '2026-07-15',
          ledgerReads: 3,
          unrelatedFresh: true,
        },
      }
    } finally {
      await h.finish()
    }
    // Every action, setup fact and raw record above is completed before this designated feature assertion.
    expect(observed, JSON.stringify(h.facts)).toEqual({
      staleAffectedBeforeBack: 8,
      dateAfterBack: '2026-07-15',
      ledgerReads: 3,
      unrelatedFresh: true,
    })
  })
  it('exact existing key targets positive control', async () => {
    const h = dayFixture('exact-key-targets')
    let observed: unknown
    try {
      await h.warm()
      h.server.profile.timezone = 'Asia/Seoul'
      await h.targetedInvalidation()
      const before = h.snapshot()
      const ledger = await h.mountLedger()
      const after = h.snapshot()
      h.record('target matcher before/after', { before, after, text: ledger.container.textContent })
      observed = {
        profileStale: before.profile?.invalidated,
        affected: before.affected.map((item) => item.invalidated),
        negatives: before.negatives.map((item) => item.invalidated),
        date: ledger.container.textContent,
        ledgerReads: h.counts['main.GetLedger'],
        otherReads: h.counts['other.GetLedger'],
      }
      h.facts.featureOracle = { observed }
    } finally {
      await h.finish()
    }
    expect(observed, JSON.stringify(h.facts)).toEqual({
      profileStale: true,
      affected: Array(8).fill(true),
      negatives: [false, false, false],
      date: '2026-07-15',
      ledgerReads: 3,
      otherReads: 1,
    })
  })
  it('pre-mutation refusal', async () => {
    const h = dayFixture('pre-mutation-refusal')
    let observed: unknown
    try {
      await h.warm()
      h.server.refuse = true
      await h.mountProfile()
      await h.matchDevice()
      await waitFor(
        () => {
          if (h.showError.mock.calls.length !== 1) throw new Error('refusal not observed')
        },
        { timeout: 1200 },
      )
      h.record('refused save', h.snapshot())
      observed = {
        zone: h.server.profile.timezone,
        writes: h.counts['main.UpdateProfile'],
        profileReads: h.counts['main.GetProfile'],
        affectedInvalidated: h.snapshot().affected.some((x) => x.invalidated),
        errors: h.showError.mock.calls.length,
      }
      h.facts.featureOracle = { observed }
    } finally {
      await h.finish()
    }
    expect(observed, JSON.stringify(h.facts)).toEqual({
      zone: 'UTC',
      writes: 1,
      profileReads: 1,
      affectedInvalidated: false,
      errors: 1,
    })
  })
  it('nickname locale same-zone success semantics', async () => {
    const h = dayFixture('same-zone-success')
    let observed: unknown
    try {
      await h.warm()
      await h.mountProfile()
      const user = userEvent.setup()
      await user.clear(screen.getByLabelText('Name'))
      await user.type(screen.getByLabelText('Name'), 'Nova')
      await user.click(screen.getByRole('button', { name: 'Keep this name' }))
      await waitFor(
        () => {
          if (
            h.server.profile.nickname !== 'Nova' ||
            h.counts['main.GetProfile'] !== 2 ||
            screen.getByRole('button', { name: '한국어' }).hasAttribute('disabled')
          )
            throw new Error('nickname save not settled')
        },
        { timeout: 1200 },
      )
      await user.click(screen.getByRole('button', { name: '한국어' }))
      await waitFor(
        () => {
          if (h.server.profile.locale !== 'ko' || h.counts['main.GetProfile'] !== 3)
            throw new Error('changed locale save not settled')
        },
        { timeout: 1200 },
      )
      observed = {
        zone: h.server.profile.timezone,
        nickname: h.server.profile.nickname,
        locale: h.server.profile.locale,
        writes: h.counts['main.UpdateProfile'],
        payloads: h.requests.filter((x) => x.method === 'UpdateProfile').map((x) => x.request),
        activeLocale: getActiveLocale(),
      }
      h.record('two actual same-zone full writes', { observed, cache: h.snapshot() })
      h.facts.featureOracle = { observed }
    } finally {
      await h.finish()
    }
    expect(observed, JSON.stringify(h.facts)).toEqual({
      zone: 'UTC',
      nickname: 'Nova',
      locale: 'ko',
      writes: 2,
      payloads: [
        { nickname: 'Nova', timezone: 'UTC', locale: 'en' },
        { nickname: 'Nova', timezone: 'UTC', locale: 'ko' },
      ],
      activeLocale: 'ko',
    })
  })
  it('late completion owner-unmount fence', async () => {
    const h = dayFixture('late-owner-completion')
    let observed: unknown
    try {
      await h.warm()
      const gate = deferredReply()
      h.server.pending = gate
      const view = await h.mountProfile()
      await h.matchDevice()
      await waitFor(
        () => {
          if (h.counts['main.UpdateProfile'] !== 1) throw new Error('pending request not started')
        },
        { timeout: 1200 },
      )
      const pendingMutations = h.client.getMutationCache().getAll()
      const pendingMutation = pendingMutations[0]
      h.setup(
        'one actual pending mutation before cleanup',
        pendingMutations.length === 1 && pendingMutation?.state.status === 'pending',
      )
      h.record('retained pending actual mutation before owner release', {
        mutationId: pendingMutation?.mutationId,
        status: pendingMutation?.state.status,
        cacheEntries: pendingMutations.length,
      })
      h.release(view)
      gate.resolve()
      // Observe the actual object, independent of its gcTime:0 cache removal after owner release.
      await waitFor(
        () => {
          if (
            h.server.profile.timezone !== 'Asia/Seoul' ||
            pendingMutation?.state.status !== 'success'
          )
            throw new Error('pending actual mutation not settled')
        },
        { timeout: 1200 },
      )
      // Success dispatch precedes mutateAsync resolution. Cross one real macrotask so the
      // controller's await/update continuation and queued notifications can finish; never wait
      // for desired invalidation, a refetch, a new ledger day, or cache retention as setup.
      await act(async () => {
        await Promise.resolve()
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
        await Promise.resolve()
      })
      h.record('retained mutation success after controller settle boundary', {
        mutationId: pendingMutation?.mutationId,
        status: pendingMutation?.state.status,
        retainedInCache: pendingMutation
          ? h.client.getMutationCache().getAll().includes(pendingMutation)
          : false,
        cacheEntries: h.client.getMutationCache().getAll().length,
      })
      observed = {
        zone: h.server.profile.timezone,
        writes: h.counts['main.UpdateProfile'],
        profileReads: h.counts['main.GetProfile'],
        profileInvalidated: h.snapshot().profile?.invalidated,
        affectedInvalidated: h.snapshot().affected.some((x) => x.invalidated),
        errors: h.showError.mock.calls.length,
      }
      h.record('old owner after settlement', { observed, cache: h.snapshot() })
      h.facts.featureOracle = { observed }
    } finally {
      await h.finish()
    }
    expect(observed, JSON.stringify(h.facts)).toEqual({
      zone: 'Asia/Seoul',
      writes: 1,
      profileReads: 1,
      profileInvalidated: false,
      affectedInvalidated: false,
      errors: 0,
    })
  })
})
