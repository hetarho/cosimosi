import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { AICapability, createGetAIUsageQueryOptions } from '@cosimosi/api-client'

import { m } from '../../../shared/i18n/index.ts'

// The AI usage dashboard: today's per-capability billable call counts against the daily cap. The
// underlying meter is in-process/in-memory (a stated limitation), reflected in the footnote.
export function UsageSection() {
  const transport = useTransport()
  const query = useQuery(createGetAIUsageQueryOptions(transport))

  if (query.isPending) {
    return <p className="text-sm text-text-muted">{m.admin_loading()}</p>
  }
  const data = query.data
  const label = (capability: AICapability) =>
    capability === AICapability.AI_CAPABILITY_LLM ? m.admin_usage_llm() : m.admin_usage_embedding()

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(data?.capabilities ?? []).map((usage) => (
          <div
            key={usage.capability}
            className="flex flex-col gap-1 rounded-xl border border-border p-4"
          >
            <span className="text-xs text-text-muted">{label(usage.capability)}</span>
            <span className="text-2xl font-semibold text-text">
              {String(usage.callsToday)}
              <span className="text-sm font-normal text-text-muted">
                {' / '}
                {String(usage.dailyCap)} {m.admin_usage_cap()}
              </span>
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-text-muted">
        {m.admin_usage_window()}: {data?.windowUtcDay ?? ''}
        {data?.processLocal ? ` · ${m.admin_usage_process_local()}` : ''}
      </p>
    </div>
  )
}
