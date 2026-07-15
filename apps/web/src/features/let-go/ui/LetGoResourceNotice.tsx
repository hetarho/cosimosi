import { m } from '../../../shared/i18n/index.ts'

// features/let-go ui — the professional-resource notice ([X7]). The backend owns the heavy-state
// detection; this only renders the notice when it is set. Gentle, non-blocking, advisory (it gates
// nothing), and never phrases the app as a substitute for care; the resource content is region-
// aware i18n (a Korean-locale default set).
export function LetGoResourceNotice() {
  return (
    <aside className="flex flex-col gap-1 rounded-md border border-border bg-surface/80 p-3">
      <p className="text-sm font-medium text-text">{m.deletion_letgo_resource_title()}</p>
      <p className="text-sm text-text-muted">{m.deletion_letgo_resource_body()}</p>
      <p className="text-sm text-text">{m.deletion_letgo_resource_contact()}</p>
    </aside>
  )
}
