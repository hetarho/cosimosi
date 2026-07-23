import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetJobHealthQueryOptions } from '@cosimosi/api-client'

import { m } from '../../../shared/i18n/index.ts'

// The background-job queue health dashboard: aggregate row counts by status plus the dead-lettered
// (retry-exhausted) count. Read-only operational visibility over the AI worker pipeline.
export function JobsSection() {
  const transport = useTransport()
  const query = useQuery(createGetJobHealthQueryOptions(transport))

  if (query.isPending) {
    return <p className="text-sm text-text-muted">{m.admin_loading()}</p>
  }
  const data = query.data
  const stats: Array<[string, bigint]> = [
    [m.admin_jobs_pending(), data?.pending ?? 0n],
    [m.admin_jobs_running(), data?.running ?? 0n],
    [m.admin_jobs_done(), data?.done ?? 0n],
    [m.admin_jobs_failed(), data?.failed ?? 0n],
    [m.admin_jobs_dead(), data?.deadLettered ?? 0n],
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1 rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted">{label}</span>
          <span className="text-2xl font-semibold text-text">{String(value)}</span>
        </div>
      ))}
    </div>
  )
}
