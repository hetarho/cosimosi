import { useMemo, useState } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import {
  AICapability,
  createAdminClient,
  createGetAIConfigQueryOptions,
  createListProviderKeysQueryOptions,
  type ProviderKey,
} from '@cosimosi/api-client'
import { Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// Provider API keys are managed once per provider (not per capability). Each capability then
// selects among the providers that have a key. The key input is WRITE-ONLY — only "set/unset" + a
// masked hint is shown.
export function ProviderKeysSection() {
  const transport = useTransport()
  const query = useQuery(createListProviderKeysQueryOptions(transport))

  if (query.isPending) {
    return <p className="text-sm text-text-muted">{m.admin_loading()}</p>
  }
  return (
    <div className="flex flex-col gap-3">
      {(query.data?.providers ?? []).map((provider) => (
        <ProviderKeyRow
          key={provider.provider}
          provider={provider}
          onChanged={() => {
            void query.refetch()
          }}
        />
      ))}
    </div>
  )
}

function ProviderKeyRow({ provider, onChanged }: { provider: ProviderKey; onChanged: () => void }) {
  const transport = useTransport()
  const client = useMemo(() => createAdminClient(transport), [transport])
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    action()
      .then(() => {
        setApiKey('')
        onChanged()
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setBusy(false))
  }

  const caps: string[] = []
  if (provider.supportsLlm) {
    caps.push(
      `${m.admin_ai_capability_llm()}${provider.implementedLlm ? '' : ` (${m.admin_provider_unimplemented()})`}`,
    )
  }
  if (provider.supportsEmbedding) {
    caps.push(
      `${m.admin_ai_capability_embedding()}${provider.implementedEmbedding ? '' : ` (${m.admin_provider_unimplemented()})`}`,
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-text">{provider.provider}</span>
        <span className="text-xs text-text-muted">
          {caps.join(' · ')} ·{' '}
          {provider.keySet ? `${m.admin_ai_key_set()} ${provider.keyHint}` : m.admin_ai_key_unset()}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm text-text"
          type="password"
          autoComplete="off"
          placeholder={m.admin_provider_key_placeholder()}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
        <input
          className="w-48 rounded border border-border bg-background px-2 py-1 text-sm text-text"
          placeholder={m.admin_ai_base_url()}
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
        />
        <Button
          color="neutral"
          size="sm"
          disabled={busy || apiKey.trim() === ''}
          onClick={() =>
            run(() => client.setProviderKey({ provider: provider.provider, apiKey, baseUrl }))
          }
        >
          {m.admin_ai_save()}
        </Button>
        {provider.keySet ? (
          <Button
            color="neutral"
            size="sm"
            disabled={busy}
            onClick={() => run(() => client.clearProviderKey({ provider: provider.provider }))}
          >
            {m.admin_provider_clear()}
          </Button>
        ) : null}
      </div>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  )
}

// Each capability selects a provider among those with a key that support + implement it, plus a
// model. No key here — keys live in the provider section above.
export function ModelSelectSection() {
  const transport = useTransport()
  const keysQuery = useQuery(createListProviderKeysQueryOptions(transport))
  const configQuery = useQuery(createGetAIConfigQueryOptions(transport))

  if (keysQuery.isPending || configQuery.isPending) {
    return <p className="text-sm text-text-muted">{m.admin_loading()}</p>
  }
  const providers = keysQuery.data?.providers ?? []
  const selections = configQuery.data?.selections ?? []
  const selectionFor = (capability: AICapability) =>
    selections.find((selection) => selection.capability === capability)

  return (
    <div className="flex flex-col gap-4">
      <CapabilityRow
        capability={AICapability.AI_CAPABILITY_LLM}
        label={m.admin_ai_capability_llm()}
        providers={providers.filter((p) => p.keySet && p.supportsLlm && p.implementedLlm)}
        selection={selectionFor(AICapability.AI_CAPABILITY_LLM)}
        onChanged={() => void configQuery.refetch()}
      />
      <CapabilityRow
        capability={AICapability.AI_CAPABILITY_EMBEDDING}
        label={m.admin_ai_capability_embedding()}
        providers={providers.filter(
          (p) => p.keySet && p.supportsEmbedding && p.implementedEmbedding,
        )}
        selection={selectionFor(AICapability.AI_CAPABILITY_EMBEDDING)}
        onChanged={() => void configQuery.refetch()}
      />
    </div>
  )
}

function CapabilityRow({
  capability,
  label,
  providers,
  selection,
  onChanged,
}: {
  capability: AICapability
  label: string
  providers: ProviderKey[]
  selection?: { provider: string; model: string; source: string }
  onChanged: () => void
}) {
  const transport = useTransport()
  const client = useMemo(() => createAdminClient(transport), [transport])
  const [provider, setProvider] = useState(selection?.provider ?? '')
  const [model, setModel] = useState(selection?.model ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (providers.length === 0) {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-border p-3">
        <span className="text-sm font-medium text-text">{label}</span>
        <span className="text-xs text-text-muted">{m.admin_model_none_available()}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-text">{label}</span>
        <span className="text-xs text-text-muted">
          {m.admin_ai_source()}: {selection?.source ?? 'unset'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded border border-border bg-background px-2 py-1 text-sm text-text"
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
        >
          <option value="">{m.admin_model_provider_placeholder()}</option>
          {providers.map((p) => (
            <option key={p.provider} value={p.provider}>
              {p.provider}
            </option>
          ))}
        </select>
        <input
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm text-text"
          placeholder={m.admin_ai_model()}
          value={model}
          onChange={(event) => setModel(event.target.value)}
        />
        <Button
          color="neutral"
          size="sm"
          disabled={busy || provider === ''}
          onClick={() => {
            setBusy(true)
            setSaved(false)
            setError(null)
            client
              .setAIConfig({ capability, provider, model })
              .then(() => {
                setSaved(true)
                onChanged()
              })
              .catch((cause: unknown) =>
                setError(cause instanceof Error ? cause.message : String(cause)),
              )
              .finally(() => setBusy(false))
          }}
        >
          {m.admin_ai_save()}
        </Button>
        {saved ? <span className="text-xs text-text-muted">{m.admin_ai_saved()}</span> : null}
        {error ? <span className="text-xs text-danger">{error}</span> : null}
      </div>
    </div>
  )
}
