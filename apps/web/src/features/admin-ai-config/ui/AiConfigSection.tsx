import { useMemo, useState } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import {
  AICapability,
  createAdminClient,
  createGetAIConfigQueryOptions,
  type AICapabilityConfig,
} from '@cosimosi/api-client'
import { Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// The AI provider config section (the admin console): edit provider/model/base-URL/key per capability, live
// (DB override over the the AI-provider abstraction env default). The key input is WRITE-ONLY — the current key is
// shown only as "set/unset" + a masked hint; a blank key on save keeps the stored one.
export function AiConfigSection() {
  const transport = useTransport()
  const query = useQuery(createGetAIConfigQueryOptions(transport))

  if (query.isPending) {
    return <p className="text-sm text-text-muted">{m.admin_loading()}</p>
  }
  const capabilities = query.data?.capabilities ?? []
  return (
    <div className="flex flex-col gap-6">
      {capabilities.map((config) => (
        <CapabilityForm
          key={config.capability}
          config={config}
          onSaved={() => {
            void query.refetch()
          }}
        />
      ))}
    </div>
  )
}

function CapabilityForm({ config, onSaved }: { config: AICapabilityConfig; onSaved: () => void }) {
  const transport = useTransport()
  const client = useMemo(() => createAdminClient(transport), [transport])
  const [provider, setProvider] = useState(config.provider)
  const [model, setModel] = useState(config.model)
  const [baseUrl, setBaseUrl] = useState(config.baseUrl)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label =
    config.capability === AICapability.AI_CAPABILITY_LLM
      ? m.admin_ai_capability_llm()
      : m.admin_ai_capability_embedding()

  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-border p-4"
      onSubmit={(event) => {
        event.preventDefault()
        setSaving(true)
        setSaved(false)
        setError(null)
        client
          .setAIConfig({
            capability: config.capability,
            provider,
            model,
            baseUrl,
            // A blank key keeps the stored one — send it only when the operator typed a new value.
            ...(apiKey.trim() === '' ? {} : { apiKey }),
          })
          .then(() => {
            setSaved(true)
            setApiKey('')
            onSaved()
          })
          .catch((cause: unknown) =>
            setError(cause instanceof Error ? cause.message : String(cause)),
          )
          .finally(() => setSaving(false))
      }}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-text">{label}</h3>
        <span className="text-xs text-text-muted">
          {m.admin_ai_source()}: {config.source} ·{' '}
          {config.keySet ? `${m.admin_ai_key_set()} ${config.keyHint}` : m.admin_ai_key_unset()}
        </span>
      </div>
      <Field label={m.admin_ai_provider()} value={provider} onChange={setProvider} />
      <Field label={m.admin_ai_model()} value={model} onChange={setModel} />
      <Field label={m.admin_ai_base_url()} value={baseUrl} onChange={setBaseUrl} />
      <Field
        label={m.admin_ai_key()}
        value={apiKey}
        onChange={setApiKey}
        type="password"
        placeholder={m.admin_ai_key_placeholder()}
      />
      <div className="flex items-center gap-3">
        <Button color="neutral" size="sm" disabled={saving}>
          {m.admin_ai_save()}
        </Button>
        {saved ? <span className="text-xs text-text-muted">{m.admin_ai_saved()}</span> : null}
        {error ? <span className="text-xs text-danger">{error}</span> : null}
      </div>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-text-muted">{label}</span>
      <input
        className="rounded border border-border bg-background px-2 py-1 text-text"
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
