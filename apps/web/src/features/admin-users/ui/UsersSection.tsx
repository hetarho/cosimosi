import { useMemo, useState } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import {
  createAdminClient,
  createListTwinkleGrantsQueryOptions,
  createListUsersQueryOptions,
  type AdminUser,
} from '@cosimosi/api-client'
import { Badge, Button, TextField } from '@cosimosi/ui'

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
      <TextField
        label={m.admin_users_search()}
        placeholder={m.admin_users_search_placeholder()}
        value={query}
        onChange={(event) => {
          setPage(0)
          setQuery(event.target.value)
        }}
      />
      {users.length === 0 ? (
        <p className="text-sm text-text-muted">{m.admin_users_empty()}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((user) => (
            <UserRow
              key={user.userId}
              user={user}
              disabled={pending}
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
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          {m.admin_users_prev()}
        </Button>
        <Button
          variant="outlined"
          color="neutral"
          size="sm"
          disabled={!usersQuery.data?.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          {m.admin_users_next()}
        </Button>
      </div>

      <section className="mt-2 flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-text">{m.admin_grants_history()}</h3>
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
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <div className="min-w-40 flex-1">
          <TextField
            label={m.admin_users_grant_note()}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <Button color="primary" size="sm" disabled={disabled} onClick={grant}>
          {m.admin_users_grant_submit()}
        </Button>
        {user.isSeedAdmin ? null : user.isAdmin ? (
          <Button
            variant="outlined"
            color="danger"
            size="sm"
            disabled={disabled}
            onClick={() => onAction(() => client.revokeAdmin({ userId: user.userId }))}
          >
            {m.admin_users_revoke()}
          </Button>
        ) : (
          <Button
            variant="outlined"
            color="neutral"
            size="sm"
            disabled={disabled}
            onClick={() => onAction(() => client.grantAdmin({ userId: user.userId }))}
          >
            {m.admin_users_promote()}
          </Button>
        )}
      </div>
    </div>
  )
}
