import { useEffect, useMemo, useRef, useState } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import {
  createAdminClient,
  createListTwinkleGrantsQueryOptions,
  createListUsersQueryOptions,
  type AdminUser,
} from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { Badge, Button, TextField } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import { useErrorToast } from '../../../shared/model/index.ts'

// The user list (metadata only, [I2]): search + paginate accounts, grant stardust (별가루 증정), and
// promote/revoke admins inline; the grant history below is the accountability record. No memory
// content is ever shown — only identity, balance, and non-content counts.
export function UsersSection() {
  const transport = useTransport()
  const client = useMemo(() => createAdminClient(transport), [transport])
  const [search, setSearch] = useState({ page: 0, query: '' })
  const [queryDraft, setQueryDraft] = useState('')
  const [pending, setPending] = useState(false)
  const searchCommitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const searchSettling = queryDraft !== search.query

  useEffect(() => () => clearTimeout(searchCommitTimer.current), [])

  const updateQueryDraft = (next: string) => {
    setQueryDraft(next)
    clearTimeout(searchCommitTimer.current)
    if (next === search.query) return
    searchCommitTimer.current = setTimeout(() => {
      // Commit both fields together: resetting the page while the old query is still active would
      // issue an extra page-zero RPC for that stale prefix before the debounce boundary.
      setSearch({ page: 0, query: next })
    }, VALUES.admin.searchDebounceMs)
  }

  // The settled query is part of the Connect Query key. Connect Query consumes TanStack Query's
  // AbortSignal, so changing the key cancels the superseded RPC; no previous result is carried into
  // the new key, and older rows cannot render as if they matched the newer prefix.
  const usersQuery = useQuery(createListUsersQueryOptions(transport, search))
  const grantsQuery = useQuery(createListTwinkleGrantsQueryOptions(transport, { page: 0 }))

  const refresh = () => {
    void usersQuery.refetch()
    void grantsQuery.refetch()
  }

  const showError = useErrorToast()
  const runAction = (action: () => Promise<unknown>): Promise<boolean> => {
    setPending(true)
    return action()
      .then(() => {
        refresh()
        return true
      })
      .catch((error: unknown) => {
        showError(error)
        return false
      })
      .finally(() => setPending(false))
  }

  // A failed list read must not render as "no users" — same rule as the jobs/usage boards.
  if (usersQuery.isError) {
    return <p className="text-sm text-danger">{m.admin_load_error()}</p>
  }
  const users = usersQuery.data?.users ?? []
  return (
    <div className="flex flex-col gap-4">
      <TextField
        label={m.admin_users_search()}
        placeholder={m.admin_users_search_placeholder()}
        value={queryDraft}
        onChange={(event) => updateQueryDraft(event.target.value)}
      />
      {users.length === 0 ? (
        <p className="text-sm text-text-muted">{m.admin_users_empty()}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((user) => (
            <UserRow
              key={user.userId}
              user={user}
              disabled={pending || searchSettling}
              onAction={runAction}
              client={client}
            />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button
          variant="outlined"
          color="neutral"
          size="sm"
          disabled={searchSettling || search.page === 0}
          onClick={() =>
            setSearch((current) => ({ ...current, page: Math.max(0, current.page - 1) }))
          }
        >
          {m.admin_users_prev()}
        </Button>
        <Button
          variant="outlined"
          color="neutral"
          size="sm"
          disabled={searchSettling || !usersQuery.data?.hasMore}
          onClick={() => setSearch((current) => ({ ...current, page: current.page + 1 }))}
        >
          {m.admin_users_next()}
        </Button>
      </div>

      <section className="mt-2 flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-text">{m.admin_grants_history()}</h3>
        {grantsQuery.isError ? (
          <p className="text-sm text-danger">{m.admin_load_error()}</p>
        ) : (grantsQuery.data?.grants ?? []).length === 0 ? (
          <p className="text-sm text-text-muted">{m.admin_grants_none()}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-xs text-text-muted">
            {(grantsQuery.data?.grants ?? []).map((grant) => (
              <li key={grant.id}>
                {grant.createdAt} · {grant.targetUser} · +{String(grant.amount)} · {grant.note}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function UserRow({
  user,
  disabled,
  onAction,
  client,
}: {
  user: AdminUser
  disabled: boolean
  onAction: (action: () => Promise<unknown>) => Promise<boolean>
  client: ReturnType<typeof createAdminClient>
}) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [amountError, setAmountError] = useState('')

  const grant = async () => {
    const normalized = amount.trim()
    const value = Number(normalized)
    if (
      !/^\d+$/.test(normalized) ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > VALUES.twinkle.adminGrantMax
    ) {
      setAmountError(
        m.admin_users_grant_amount_invalid({ max: String(VALUES.twinkle.adminGrantMax) }),
      )
      return
    }
    setAmountError('')
    // One id per submit: transport-level retries of this call dedup server-side (the id is the
    // grant's idempotency key). A second click is deliberately a new grant, not a retry.
    const grantId = crypto.randomUUID()
    const succeeded = await onAction(() =>
      client.grantStardust({ userId: user.userId, amount: BigInt(value), note, grantId }),
    )
    if (!succeeded) return
    setAmount('')
    setNote('')
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-text">{user.email || user.userId}</span>
        <div className="flex flex-wrap items-center gap-2">
          {user.isAdmin ? (
            <Badge variant="primary">
              {m.admin_users_is_admin()}
              {user.isSeedAdmin ? ` · ${m.admin_users_seed()}` : ''}
            </Badge>
          ) : null}
          <Badge variant="neutral">
            {m.admin_users_balance()} {String(user.total)}
          </Badge>
          <Badge variant="neutral">
            {m.admin_users_stars()} {String(user.episodicMemoryCount)}
          </Badge>
          <Badge variant="neutral">
            {m.admin_users_diaries()} {String(user.diaryCount)}
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-28">
          <TextField
            label={m.admin_users_grant_amount()}
            type="number"
            min={1}
            max={VALUES.twinkle.adminGrantMax}
            step={1}
            value={amount}
            error={amountError}
            disabled={disabled}
            onChange={(event) => {
              setAmount(event.target.value)
              setAmountError('')
            }}
          />
        </div>
        <div className="min-w-40 flex-1">
          <TextField
            label={m.admin_users_grant_note()}
            value={note}
            disabled={disabled}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <Button color="primary" size="sm" disabled={disabled} onClick={() => void grant()}>
          {m.admin_users_grant_submit()}
        </Button>
        {user.isSeedAdmin ? null : user.isAdmin ? (
          <Button
            variant="outlined"
            color="danger"
            size="sm"
            disabled={disabled}
            onClick={() => void onAction(() => client.revokeAdmin({ userId: user.userId }))}
          >
            {m.admin_users_revoke()}
          </Button>
        ) : (
          <Button
            variant="outlined"
            color="neutral"
            size="sm"
            disabled={disabled}
            onClick={() => void onAction(() => client.grantAdmin({ userId: user.userId }))}
          >
            {m.admin_users_promote()}
          </Button>
        )}
      </div>
    </div>
  )
}
