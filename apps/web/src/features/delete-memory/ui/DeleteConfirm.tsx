import { Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/delete-memory ui ([X1][X2][W6]): the single plainly-worded confirm — no type-to-confirm
// friction gate (the 30-day restore already makes the act safely reversible, so heavy friction
// would read as punitive). It states that ALL stars born from the diary are removed, previews them,
// notes the shared meaning that is kept, and carries both reassurances (restore window + export)
// with honest post-window wording before the removal, which is the user's explicit act ([I1]).
export function DeleteConfirm({
  affectedNames,
  retentionDays,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  affectedNames: readonly string[]
  retentionDays: number
  busy: boolean
  error: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-text">{m.deletion_delete_lead()}</p>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-text-muted">
          {m.deletion_delete_affected_label()}
        </span>
        {affectedNames.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {affectedNames.map((name, index) => (
              <li
                key={`${name}-${index}`}
                className="inline-flex rounded-full border border-border px-2.5 py-1 text-xs text-text"
              >
                {name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">{m.deletion_delete_affected_empty()}</p>
        )}
      </div>

      <p className="text-sm text-text-muted">{m.deletion_delete_kept_shared()}</p>

      <div className="flex flex-col gap-1 rounded-md border border-border bg-surface/60 p-3">
        <p className="text-sm text-text">
          {m.deletion_delete_restore_reassurance({ days: retentionDays })}
        </p>
        <p className="text-sm text-text-muted">{m.deletion_delete_export_reassurance()}</p>
        <p className="text-sm text-text-muted">{m.deletion_delete_permanent_after_window()}</p>
      </div>

      {error && <p className="text-sm text-danger">{m.deletion_delete_error()}</p>}

      <div className="flex justify-end gap-2">
        <Button color="neutral" size="sm" onClick={onCancel}>
          {m.deletion_cancel()}
        </Button>
        <Button color="danger" size="sm" onClick={onConfirm} disabled={busy}>
          {busy ? m.deletion_deleting() : m.deletion_delete_confirm()}
        </Button>
      </div>
    </div>
  )
}
