// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRouterTransport } from '@connectrpc/connect'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AdminService } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'

import { ErrorToastContext } from '@cosimosi/errors/react'
import { defaultLocale, m, setActiveLocale } from '../../../shared/i18n/index.ts'
import { UsersSection } from './UsersSection.tsx'

const queryClients = new Set<QueryClient>()

afterEach(() => {
  for (const queryClient of queryClients) queryClient.clear()
  queryClients.clear()
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  setActiveLocale(defaultLocale)
})

describe('UsersSection', () => {
  it('rejects non-integer spellings and out-of-range amounts before minting a grant id', async () => {
    const grants: GrantInput[] = []
    renderSection({ grantStardust: (request) => grants.push(request) })
    const user = userEvent.setup()
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
    const amount = await screen.findByLabelText(m.admin_users_grant_amount())

    expect(amount.getAttribute('step')).toBe('1')
    expect(amount.getAttribute('max')).toBe(String(VALUES.twinkle.adminGrantMax))

    for (const invalid of [
      '1.9',
      '1e2',
      String(VALUES.twinkle.adminGrantMax + 1),
      '9007199254740992',
    ]) {
      fireEvent.change(amount, { target: { value: invalid } })
      await user.click(screen.getByRole('button', { name: m.admin_users_grant_submit() }))
      expect(
        screen.getByText(
          m.admin_users_grant_amount_invalid({ max: String(VALUES.twinkle.adminGrantMax) }),
        ),
      ).toBeTruthy()
    }

    expect(grants).toHaveLength(0)
    expect(randomUUID).not.toHaveBeenCalled()
  })

  it('keeps the operator input when the server refuses the grant', async () => {
    const showError = vi.fn()
    renderSection(
      {
        grantStardust: () => {
          throw new Error('refused')
        },
      },
      showError,
    )
    const user = userEvent.setup()
    const amount = (await screen.findByLabelText(m.admin_users_grant_amount())) as HTMLInputElement
    const note = screen.getByLabelText(m.admin_users_grant_note()) as HTMLInputElement

    await user.type(amount, '42')
    await user.type(note, 'keep this context')
    await user.click(screen.getByRole('button', { name: m.admin_users_grant_submit() }))

    await waitFor(() => expect(showError).toHaveBeenCalledTimes(1))
    expect(amount.value).toBe('42')
    expect(note.value).toBe('keep this context')
  })

  it('clears a successful grant and gives each deliberate submit a fresh id', async () => {
    const grants: GrantInput[] = []
    renderSection({ grantStardust: (request) => grants.push(request) })
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
    const user = userEvent.setup()
    const amount = (await screen.findByLabelText(m.admin_users_grant_amount())) as HTMLInputElement
    const note = screen.getByLabelText(m.admin_users_grant_note()) as HTMLInputElement
    const submit = screen.getByRole('button', { name: m.admin_users_grant_submit() })

    await user.type(amount, '41')
    await user.type(note, 'first')
    await user.click(submit)
    await waitFor(() => expect(amount.value).toBe(''))
    expect(note.value).toBe('')

    await user.type(amount, '42')
    await user.type(note, 'second')
    await user.click(submit)
    await waitFor(() => expect(grants).toHaveLength(2))

    expect(grants).toEqual([
      {
        userId: 'user-1',
        amount: 41n,
        note: 'first',
        grantId: '00000000-0000-4000-8000-000000000001',
      },
      {
        userId: 'user-1',
        amount: 42n,
        note: 'second',
        grantId: '00000000-0000-4000-8000-000000000002',
      },
    ])
  })

  it('locks the submitted fields until a successful grant finishes', async () => {
    let finishGrant!: () => void
    renderSection({
      grantStardust: () =>
        new Promise<void>((resolve) => {
          finishGrant = resolve
        }),
    })
    const user = userEvent.setup()
    const amount = (await screen.findByLabelText(m.admin_users_grant_amount())) as HTMLInputElement
    const note = screen.getByLabelText(m.admin_users_grant_note()) as HTMLInputElement

    await user.type(amount, '42')
    await user.type(note, 'submitted values')
    await user.click(screen.getByRole('button', { name: m.admin_users_grant_submit() }))

    expect(amount.disabled).toBe(true)
    expect(note.disabled).toBe(true)
    expect(amount.value).toBe('42')
    expect(note.value).toBe('submitted values')

    await act(async () => finishGrant())
    await waitFor(() => expect(amount.value).toBe(''))
    expect(note.value).toBe('')
    expect(amount.disabled).toBe(false)
    expect(note.disabled).toBe(false)
  })

  it('debounces a typed prefix and aborts a superseded search request', async () => {
    const calls: SearchInput[] = []
    let firstSignal: AbortSignal | undefined
    renderSection({
      listUsers: (request, signal) => {
        calls.push(request)
        if (request.query === 'first') {
          firstSignal = signal
          return new Promise((_, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
          })
        }
        return userList(request.query || 'initial', request.query === '')
      },
    })
    const input = (await screen.findByLabelText(m.admin_users_search())) as HTMLInputElement
    await screen.findByText('initial@example.test')
    const next = screen.getByRole('button', { name: m.admin_users_next() }) as HTMLButtonElement
    const grant = screen.getByRole('button', {
      name: m.admin_users_grant_submit(),
    }) as HTMLButtonElement
    expect(calls).toEqual([{ page: 0, query: '' }])
    expect(next.disabled).toBe(false)
    expect(grant.disabled).toBe(false)

    fireEvent.click(next)
    await waitFor(() =>
      expect(calls).toEqual([
        { page: 0, query: '' },
        { page: 1, query: '' },
      ]),
    )

    vi.useFakeTimers()
    for (const value of ['f', 'fi', 'fir', 'firs', 'first']) {
      fireEvent.change(input, { target: { value } })
    }
    expect(calls).toEqual([
      { page: 0, query: '' },
      { page: 1, query: '' },
    ])
    expect(next.disabled).toBe(true)
    expect(
      (
        screen.getByRole('button', {
          name: m.admin_users_grant_submit(),
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
    fireEvent.click(next)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(VALUES.admin.searchDebounceMs)
    })
    expect(calls).toEqual([
      { page: 0, query: '' },
      { page: 1, query: '' },
      { page: 0, query: 'first' },
    ])
    expect(firstSignal?.aborted).toBe(false)

    for (const value of ['', 's', 'se', 'sec', 'seco', 'secon', 'second']) {
      fireEvent.change(input, { target: { value } })
    }
    expect(calls).toEqual([
      { page: 0, query: '' },
      { page: 1, query: '' },
      { page: 0, query: 'first' },
    ])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(VALUES.admin.searchDebounceMs)
    })

    expect(calls).toEqual([
      { page: 0, query: '' },
      { page: 1, query: '' },
      { page: 0, query: 'first' },
      { page: 0, query: 'second' },
    ])
    expect(firstSignal?.aborted).toBe(true)
  })
})

interface GrantInput {
  userId: string
  amount: bigint
  note: string
  grantId: string
}

interface Handlers {
  listUsers?: (request: SearchInput, signal: AbortSignal) => unknown
  grantStardust?: (request: GrantInput) => unknown
}

interface SearchInput {
  page: number
  query: string
}

function renderSection(handlers: Handlers = {}, showError = vi.fn()) {
  const transport = createRouterTransport(({ service }) => {
    service(AdminService, {
      listUsers: (request, context) =>
        (handlers.listUsers?.({ page: request.page, query: request.query }, context.signal) ??
          userList('initial')) as never,
      listTwinkleGrants: () => ({ grants: [], page: 0, hasMore: false }),
      grantStardust: async (request) => {
        await handlers.grantStardust?.({
          userId: request.userId,
          amount: request.amount,
          note: request.note,
          grantId: request.grantId,
        })
        return { balanceTotal: request.amount }
      },
      grantAdmin: () => ({}),
      revokeAdmin: () => ({}),
    })
  })
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
  queryClients.add(queryClient)
  render(
    <ErrorToastContext.Provider value={showError}>
      <TransportProvider transport={transport}>
        <QueryClientProvider client={queryClient}>
          <UsersSection />
        </QueryClientProvider>
      </TransportProvider>
    </ErrorToastContext.Provider>,
  )
}

function userList(label: string, hasMore = false) {
  return {
    users: [
      {
        userId: 'user-1',
        email: `${label}@example.test`,
        signupAt: '2026-08-16T00:00:00Z',
        isAdmin: false,
        isSeedAdmin: false,
        small: 0n,
        general: 0n,
        total: 0n,
        diaryCount: 0n,
        episodicMemoryCount: 0n,
      },
    ],
    page: 0,
    hasMore,
  }
}
