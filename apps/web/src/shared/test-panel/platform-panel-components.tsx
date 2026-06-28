import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQueryClient } from '@tanstack/react-query'

import { createPlatformClient, type PingResponse } from '@cosimosi/api-client'
import { inspectClientCache, setClientCacheData } from '@cosimosi/client-cache'
import { VALUES } from '@cosimosi/config'
import { Badge, Button, Skeleton, Switch, TextField } from '@cosimosi/ui'

import { useAuthFacade, useSessionSnapshot } from '../auth/index.ts'
import { m, setActiveLocale, supportedLocales, useActiveLocale, type Locale } from '../i18n/index.ts'

type PingStatus = 'idle' | 'loading' | 'success' | 'error'

interface PingState {
  status: PingStatus
  response?: PingResponse
  error?: string
}

const TEST_CACHE_KEY = ['test-harness', 'cache-probe'] as const

export function TransportPingPanel() {
  const transport = useTransport()
  const client = useMemo(() => createPlatformClient(transport), [transport])
  const [ping, setPing] = useState<PingState>({ status: 'idle' })

  const runPing = useCallback(async () => {
    setPing({ status: 'loading' })
    try {
      const response = await client.ping({})
      setPing({ status: 'success', response })
    } catch (error) {
      setPing({ status: 'error', error: errorMessage(error) })
    }
  }, [client])

  useEffect(() => {
    void runPing()
  }, [runPing])

  return (
    <PanelStack>
      <StatusBadge status={ping.status} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void runPing()} loading={ping.status === 'loading'}>
          {m.test_harness_transport_ping_action()}
        </Button>
      </div>
      {ping.response ? (
        <KeyValueList
          rows={[
            [m.test_harness_message(), ping.response.message],
            [m.test_harness_request_id(), ping.response.requestId || m.test_harness_not_available()],
            [m.test_harness_server_time(), formatTimestamp(ping.response.serverTime)],
          ]}
        />
      ) : null}
      {ping.error ? <DiagnosticBlock title={m.test_harness_error()} value={ping.error} /> : null}
    </PanelStack>
  )
}

export function AuthSessionPanel() {
  const auth = useAuthFacade()
  const session = useSessionSnapshot()
  const [tokenState, setTokenState] = useState<'idle' | 'loading' | 'present' | 'absent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const inspectToken = useCallback(async () => {
    setTokenState('loading')
    setError(null)
    try {
      const token = await auth.getAccessToken()
      setTokenState(token ? 'present' : 'absent')
    } catch (tokenError) {
      setTokenState('absent')
      setError(errorMessage(tokenError))
    }
  }, [auth])

  useEffect(() => {
    void inspectToken()
  }, [inspectToken, session.status, session.userId])

  return (
    <PanelStack>
      <KeyValueList
        rows={[
          [m.test_harness_auth_status(), session.status],
          [m.test_harness_auth_user_id(), session.userId ?? m.test_harness_no_user()],
          [m.test_harness_auth_expires_at(), session.expiresAt ? new Date(session.expiresAt).toISOString() : m.test_harness_not_available()],
          [m.test_harness_auth_token(), tokenLabel(tokenState)],
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void inspectToken()} loading={tokenState === 'loading'} variant="secondary">
          {m.test_harness_auth_inspect_token()}
        </Button>
        <Button
          onClick={() => void auth.refresh().catch((refreshError: unknown) => setError(errorMessage(refreshError)))}
          disabled={session.status !== 'authenticated' && session.status !== 'refreshing'}
          variant="secondary"
        >
          {m.test_harness_auth_refresh_session()}
        </Button>
      </div>
      {error ? <DiagnosticBlock title={m.test_harness_error()} value={error} /> : null}
    </PanelStack>
  )
}

export function QueryCachePanel() {
  const queryClient = useQueryClient()
  const [revision, setRevision] = useState(0)
  const entries = inspectClientCache(queryClient)

  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  const seedFakeQuery = useCallback(() => {
    setClientCacheData(queryClient, TEST_CACHE_KEY, {
      source: 'test-harness',
      revision,
      updatedAt: new Date().toISOString(),
    })
    refresh()
  }, [queryClient, refresh, revision])

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries()
    refresh()
  }, [queryClient, refresh])

  const clear = useCallback(() => {
    queryClient.clear()
    refresh()
  }, [queryClient, refresh])

  return (
    <PanelStack>
      <KeyValueList rows={[[m.test_harness_query_entry_count(), String(entries.length)]]} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={seedFakeQuery}>{m.test_harness_query_seed_fake()}</Button>
        <Button onClick={invalidate} variant="secondary">
          {m.test_harness_query_invalidate()}
        </Button>
        <Button onClick={clear} variant="secondary">
          {m.test_harness_query_clear()}
        </Button>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-text-muted">{m.test_harness_query_empty()}</p>
      ) : (
        <div className="grid gap-2">
          {entries.map((entry) => (
            <div key={entry.queryHash} className="rounded-md border border-border bg-surface-subtle p-3 text-sm">
              <KeyValueList
                rows={[
                  [m.test_harness_query_hash(), entry.queryHash],
                  [m.test_harness_query_status(), entry.status],
                ]}
              />
            </div>
          ))}
        </div>
      )}
    </PanelStack>
  )
}

export function ValuesPanel() {
  return (
    <PanelStack>
      <Badge variant="primary">{m.test_harness_values_client_cache_group()}</Badge>
      <KeyValueList
        rows={[
          [m.test_harness_values_default_stale(), formatMs(VALUES.clientCache.defaultStaleMs)],
          [m.test_harness_values_default_gc(), formatMs(VALUES.clientCache.defaultGcMs)],
          [m.test_harness_values_retry_count(), String(VALUES.clientCache.defaultRetryCount)],
          [m.test_harness_values_rollback_window(), formatMs(VALUES.clientCache.optimisticRollbackMs)],
        ]}
      />
    </PanelStack>
  )
}

export function I18nPanel() {
  const activeLocale = useActiveLocale()

  return (
    <PanelStack>
      <KeyValueList rows={[[m.test_harness_i18n_active_locale(), activeLocale]]} />
      <div className="flex flex-wrap gap-2">
        {supportedLocales.map((locale) => (
          <Button key={locale} onClick={() => setActiveLocale(locale)} variant={activeLocale === locale ? 'primary' : 'secondary'}>
            {localeLabel(locale)}
          </Button>
        ))}
      </div>
    </PanelStack>
  )
}

export function DesignSystemPanel() {
  const [enabled, setEnabled] = useState(false)

  return (
    <PanelStack>
      <div className="flex flex-wrap items-center gap-3">
        <Button>{m.test_harness_design_system_button_primary()}</Button>
        <Button variant="secondary">{m.test_harness_design_system_button_secondary()}</Button>
        <Badge variant="success">{m.test_harness_design_system_badge_success()}</Badge>
        <Badge variant="warning">{m.test_harness_design_system_badge_warning()}</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={m.test_harness_design_system_text_field_label()}
          placeholder={m.test_harness_design_system_text_field_placeholder()}
        />
        <div className="flex items-center rounded-md border border-border bg-surface-subtle p-4">
          <Switch label={m.test_harness_design_system_switch_label()} checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>
      <div className="grid gap-2" aria-label={m.test_harness_design_system_skeleton_label()}>
        <Skeleton width={240} height={16} />
        <Skeleton width={160} height={16} />
      </div>
    </PanelStack>
  )
}

function PanelStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>
}

function StatusBadge({ status }: { status: PingStatus }) {
  const variant = status === 'success' ? 'success' : status === 'error' ? 'danger' : status === 'loading' ? 'warning' : 'neutral'
  const label =
    status === 'success'
      ? m.test_harness_status_success()
      : status === 'error'
        ? m.test_harness_status_error()
        : status === 'loading'
          ? m.test_harness_status_loading()
          : m.test_harness_status_idle()
  return <Badge variant={variant}>{label}</Badge>
}

function KeyValueList({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl className="grid gap-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 rounded-md border border-border bg-surface-subtle p-3 sm:grid-cols-[12rem_1fr]">
          <dt className="font-medium text-text-muted">{label}</dt>
          <dd className="break-words text-text">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function DiagnosticBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-subtle p-3 text-sm">
      <p className="mb-2 font-medium text-text-muted">{title}</p>
      <pre className="overflow-auto whitespace-pre-wrap text-xs text-text">{value}</pre>
    </div>
  )
}

function tokenLabel(status: 'idle' | 'loading' | 'present' | 'absent'): string {
  if (status === 'present') return m.test_harness_auth_token_present()
  if (status === 'loading') return m.test_harness_status_loading()
  if (status === 'idle') return m.test_harness_status_idle()
  return m.test_harness_auth_token_absent()
}

function formatTimestamp(timestamp: PingResponse['serverTime']): string {
  if (!timestamp) return m.test_harness_not_available()
  return new Date(Number(timestamp.seconds) * 1000 + Math.floor(timestamp.nanos / 1_000_000)).toISOString()
}

function formatMs(value: number): string {
  return `${value} ${m.test_harness_unit_ms()}`
}

function localeLabel(locale: Locale): string {
  return locale.toUpperCase()
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return m.test_harness_unknown_error()
}
