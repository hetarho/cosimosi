import { useMemo, useState } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import {
  AICapability,
  createAdminClient,
  createGetAIConfigQueryOptions,
  createListProviderKeysQueryOptions,
  createListProviderModelsQueryOptions,
  type ProviderKey,
} from '@cosimosi/api-client'
import { Badge, Button, Select, TextField } from '@cosimosi/ui'

import { useErrorToast } from '@cosimosi/errors/react'
import { m } from '../../../shared/i18n/index.ts'
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
  const showError = useErrorToast()
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)

  const run = (action: () => Promise<unknown>) => {
    setBusy(true)
    action()
      .then(() => {
        setApiKey('')
        onChanged()
      })
      .catch(showError)
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
        <Button
          color="primary"
          size="sm"
          loading={busy}
          disabled={apiKey.trim() === ''}
          onClick={() => run(() => client.setProviderKey({ provider: provider.provider, apiKey }))}
        >
          {m.admin_ai_save()}
        </Button>
        <Button
          variant="outlined"
          color="danger"
          size="sm"
          disabled={busy || (!provider.keySet && apiKey === '')}
          onClick={() => {
            // Reset: if a key is stored, remove it (encrypted row deleted); otherwise just clear the
            // untyped input. Either way the row returns to "no key".
            if (provider.keySet) {
              run(() => client.clearProviderKey({ provider: provider.provider }))
            } else {
              setApiKey('')
            }
          }}
        >
          {m.admin_provider_clear()}
        </Button>
      </div>
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
  if (keysQuery.isError || configQuery.isError) {
    return <p className="text-sm text-danger">{m.admin_load_error()}</p>
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

// The model select's sentinel for "type the id yourself" — never a real vendor model id.
const CUSTOM_MODEL_OPTION = '__custom__'

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
  const showError = useErrorToast()
  const [provider, setProvider] = useState(selection?.provider ?? '')
  const [model, setModel] = useState(selection?.model ?? '')
  const [customEntry, setCustomEntry] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  // The vendor's live model list for the selected provider — advisory input help only. A failed
  // fetch degrades to manual entry below (no retries: the operator should not wait through
  // backoff to type an id); saving stays possible either way.
  const modelsQuery = useQuery({
    ...createListProviderModelsQueryOptions(transport, { provider, capability }),
    enabled: provider !== '',
    retry: false,
  })
  const listedModels = modelsQuery.data?.models ?? []
  const listingFailed = provider !== '' && modelsQuery.isError
  const manualEntry = customEntry || listingFailed
  // The saved/current id may predate the list or be a brand-new vendor model — keep it
  // selectable rather than silently dropping it.
  const unlisted = model !== '' && !listedModels.some((entry) => entry.id === model)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text">{label}</span>
        <Badge variant="neutral">
          {m.admin_ai_source()}: {sourceLabel(selection?.source)}
        </Badge>
      </div>
      {providers.length === 0 ? (
        <span className="text-sm text-text-muted">{m.admin_model_none_available()}</span>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Select
              ariaLabel={label}
              items={[
                { value: '', label: m.admin_model_provider_placeholder() },
                ...providers.map((p) => ({ value: p.provider, label: p.provider })),
              ]}
              value={provider}
              onValueChange={(next) => {
                setProvider(next)
                setCustomEntry(false)
                // A model id belongs to its provider — carrying one across a provider switch
                // (invisibly, while the new list loads) could save a stale cross-vendor pair.
                // Returning to the saved provider restores the saved model; anywhere else
                // starts from the adapter default.
                setModel(next === selection?.provider ? selection.model : '')
              }}
            />
            <div className="min-w-48 flex-1">
              {manualEntry ? (
                <TextField
                  label={m.admin_ai_model()}
                  placeholder={m.admin_model_placeholder()}
                  // Why this control replaced the list, said beside it and programmatically associated
                  // — the field is not invalid, the list is simply missing.
                  description={listingFailed ? m.admin_model_list_failed() : undefined}
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                />
              ) : (
                <Select
                  label={m.admin_ai_model()}
                  items={
                    modelsQuery.isLoading
                      ? [{ value: '', label: m.admin_model_loading() }]
                      : [
                          { value: '', label: m.admin_model_default_option() },
                          ...(unlisted
                            ? [
                                {
                                  value: model,
                                  label: `${model} ${m.admin_model_unlisted_suffix()}`,
                                },
                              ]
                            : []),
                          ...listedModels.map((entry) => ({
                            value: entry.id,
                            label:
                              entry.displayName !== '' && entry.displayName !== entry.id
                                ? `${entry.id} — ${entry.displayName}`
                                : entry.id,
                          })),
                          { value: CUSTOM_MODEL_OPTION, label: m.admin_model_custom_option() },
                        ]
                  }
                  value={modelsQuery.isLoading ? '' : model}
                  disabled={provider === '' || modelsQuery.isLoading}
                  onValueChange={(next) => {
                    if (next === CUSTOM_MODEL_OPTION) {
                      setCustomEntry(true)
                      return
                    }
                    setModel(next)
                  }}
                />
              )}
            </div>
            <Button
              color="primary"
              size="sm"
              loading={busy}
              disabled={provider === ''}
              onClick={() => {
                setBusy(true)
                setSaved(false)
                client
                  .setAIConfig({ capability, provider, model })
                  .then(() => {
                    setSaved(true)
                    onChanged()
                  })
                  .catch(showError)
                  .finally(() => setBusy(false))
              }}
            >
              {m.admin_ai_save()}
            </Button>
            {saved ? <span className="text-sm text-text-muted">{m.admin_ai_saved()}</span> : null}
          </div>
          {customEntry && !listingFailed ? (
            <button
              type="button"
              className="self-start text-sm text-text-muted underline underline-offset-2"
              onClick={() => setCustomEntry(false)}
            >
              {m.admin_model_pick_from_list()}
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}

// The server's source enum ('db' | 'env' | 'unset') rendered through the i18n seam; anything
// unexpected reads as unset rather than leaking a raw enum value.
function sourceLabel(source: string | undefined): string {
  switch (source) {
    case 'db':
      return m.admin_ai_source_db()
    case 'env':
      return m.admin_ai_source_env()
    default:
      return m.admin_ai_source_unset()
  }
}
