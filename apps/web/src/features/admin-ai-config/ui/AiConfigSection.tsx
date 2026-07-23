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
import { Badge, Button, TextField } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// Native select styled to match the design-system field surface (there is no Select primitive).
const SELECT_CLASS =
  'field-surface h-10 rounded-lg px-3 text-base text-text disabled:opacity-50 disabled:pointer-events-none'

// Provider API keys are managed once per provider (not per capability). Each capability then selects
// among the keyed providers. The key input is WRITE-ONLY — only "set/unset" + a masked hint shows.
export function ProviderKeysSection() {
  const transport = useTransport()
  const query = useQuery(createListProviderKeysQueryOptions(transport))

  if (query.isPending) {
    return <p className="text-sm text-text-muted">{m.admin_loading()}</p>
  }
  if (query.isError) {
    return <p className="text-sm text-danger">{m.admin_load_error()}</p>
  }
  const providers = query.data?.providers ?? []
  if (providers.length === 0) {
    return <p className="text-sm text-text-muted">{m.admin_provider_empty()}</p>
  }
  return (
    <div className="flex flex-col gap-4">
      {providers.map((provider) => (
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

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text">{provider.provider}</span>
          {provider.supportsLlm ? (
            <Badge variant={provider.implementedLlm ? 'primary' : 'neutral'}>
              {m.admin_ai_capability_llm()}
              {provider.implementedLlm ? '' : ` · ${m.admin_provider_unimplemented()}`}
            </Badge>
          ) : null}
          {provider.supportsEmbedding ? (
            <Badge variant={provider.implementedEmbedding ? 'primary' : 'neutral'}>
              {m.admin_ai_capability_embedding()}
              {provider.implementedEmbedding ? '' : ` · ${m.admin_provider_unimplemented()}`}
            </Badge>
          ) : null}
        </div>
        <Badge variant={provider.keySet ? 'success' : 'neutral'}>
          {provider.keySet ? `${m.admin_ai_key_set()} ${provider.keyHint}` : m.admin_ai_key_unset()}
        </Badge>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <TextField
            label={m.admin_ai_key()}
            type="password"
            autoComplete="off"
            placeholder={m.admin_provider_key_placeholder()}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </div>
        <div className="w-56">
          <TextField
            label={m.admin_ai_base_url()}
            placeholder={m.admin_base_url_placeholder()}
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </div>
        <Button
          color="primary"
          size="sm"
          loading={busy}
          disabled={apiKey.trim() === ''}
          onClick={() =>
            run(() => client.setProviderKey({ provider: provider.provider, apiKey, baseUrl }))
          }
        >
          {m.admin_ai_save()}
        </Button>
        <Button
          variant="outlined"
          color="danger"
          size="sm"
          disabled={busy || (!provider.keySet && apiKey === '' && baseUrl === provider.baseUrl)}
          onClick={() => {
            // Reset: if a key is stored, remove it (encrypted row deleted); otherwise just clear the
            // untyped inputs. Either way the row returns to "no key".
            if (provider.keySet) {
              run(() => client.clearProviderKey({ provider: provider.provider }))
            } else {
              setApiKey('')
              setBaseUrl(provider.baseUrl)
            }
          }}
        >
          {m.admin_provider_clear()}
        </Button>
      </div>
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </div>
  )
}

// Each capability selects a provider among those with a key that support + implement it, plus a
// model. No key here — keys live in the provider-keys tab.
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

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text">{label}</span>
        <Badge variant="neutral">
          {m.admin_ai_source()}: {selection?.source ?? 'unset'}
        </Badge>
      </div>
      {providers.length === 0 ? (
        <span className="text-sm text-text-muted">{m.admin_model_none_available()}</span>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <select
            aria-label={label}
            className={SELECT_CLASS}
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
          <div className="min-w-48 flex-1">
            <TextField
              label={m.admin_ai_model()}
              placeholder={m.admin_model_placeholder()}
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
          </div>
          <Button
            color="primary"
            size="sm"
            loading={busy}
            disabled={provider === ''}
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
          {saved ? <span className="text-sm text-text-muted">{m.admin_ai_saved()}</span> : null}
        </div>
      )}
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </div>
  )
}
