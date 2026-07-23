import { useMemo, useState } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import {
  createAdminClient,
  createListTwinkleGrantsQueryOptions,
  createListUsersQueryOptions,
  type AdminUser,
} from '@cosimosi/api-client'
import { Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// The user list (metadata only, [I2]): search + paginate accounts, grant stardust (별가루 증정), and
// promote/revoke admins inline; the grant history below is the accountability record. No memory
// content is ever shown — only identity, balance, and non-content counts.
export function UsersSection() {
  const transport = useTransport()
  const client = useMemo(() => createAdminClient(transport), [transport])
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState(false)

  const usersQuery = useQuery(createListUsersQueryOptions(transport, { page, query }))
  const grantsQuery = useQuery(createListTwinkleGrantsQueryOptions(transport, { page: 0 }))

  const refresh = () => {
    void usersQuery.refetch()
    void grantsQuery.refetch()
  }

  const runAction = (action: () => Promise<unknown>) => {
    setPending(true)
    action()
      .then(refresh)
      .catch(() => undefined)
      .finally(() => setPending(false))
  }

  const users = usersQuery.data?.users ?? []
  return (
    <div className="flex flex-col gap-4">
      <input
        className="rounded border border-border bg-background px-2 py-1 text-sm text-text"
        placeholder={m.admin_users_search()}
        value={query}
        onChange={(event) => {
          setPage(0)
          setQuery(event.target.value)
        }}
      />
      {users.length === 0 ? (
        <p className="text-sm text-text-muted">{m.admin_users_empty()}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {users.map((user) => (
            <UserRow
              key={user.userId}
              user={user}
              disabled={pending}
              onAction={runAction}
              client={client}
            />
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Button
          color="neutral"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          {m.admin_users_prev()}
        </Button>
        <Button
          color="neutral"
          size="sm"
          disabled={!usersQuery.data?.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          {m.admin_users_next()}
        </Button>
      </div>

      <section className="mt-4 flex flex-col gap-2">
        <h3 className="text-sm font-medium text-text">{m.admin_grants_history()}</h3>
        {(grantsQuery.data?.grants ?? []).length === 0 ? (
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
  onAction: (action: () => Promise<unknown>) => void
  client: ReturnType<typeof createAdminClient>
}) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const grant = () => {
    const value = Number.parseInt(amount, 10)
    if (!Number.isFinite(value) || value <= 0) return
    // A fresh grant id per click makes a retried grant idempotent end to end.
    const grantId = crypto.randomUUID()
    onAction(() =>
      client.grantStardust({ userId: user.userId, amount: BigInt(value), note, grantId }),
    )
    setAmount('')
    setNote('')
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="text-text">{user.email || user.userId}</span>
        <span className="text-xs text-text-muted">
          {m.admin_users_balance()} {String(user.total)} · {m.admin_users_stars()}{' '}
          {String(user.episodicMemoryCount)} · {m.admin_users_diaries()} {String(user.diaryCount)}
          {user.isAdmin
            ? ` · ${m.admin_users_is_admin()}${user.isSeedAdmin ? ` (${m.admin_users_seed()})` : ''}`
            : ''}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="w-24 rounded border border-border bg-background px-2 py-1 text-sm text-text"
          type="number"
          min={1}
          placeholder={m.admin_users_grant_amount()}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <input
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm text-text"
          placeholder={m.admin_users_grant_note()}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <Button color="neutral" size="sm" disabled={disabled} onClick={grant}>
          {m.admin_users_grant_submit()}
        </Button>
        {user.isSeedAdmin ? null : user.isAdmin ? (
          <Button
            color="neutral"
            size="sm"
            disabled={disabled}
            onClick={() => onAction(() => client.revokeAdmin({ userId: user.userId }))}
          >
            {m.admin_users_revoke()}
          </Button>
        ) : (
          <Button
            color="neutral"
            size="sm"
            disabled={disabled}
            onClick={() => onAction(() => client.grantAdmin({ userId: user.userId }))}
          >
            {m.admin_users_promote()}
          </Button>
        )}
      </div>
    </li>
  )
}
