import { Button, Checkbox } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import { LetGoResourceNotice } from './LetGoResourceNotice.tsx'

// A this-memory-only semantic candidate the AI proposed. `reason` is server-authored text shown
// verbatim (not localizable copy).
export interface LetGoCandidate {
  readonly neuronId: string
  readonly name: string
  readonly reason: string
}

// features/let-go ui step 3 ([X4][X6][X7]): review + select-to-seal. The AI suggested the
// candidates; the diarist toggles which to seal (the user decides). The kept-facts statement is
// persistent, the professional-resource notice renders BEFORE the seal action when heavy-state is
// set (advisory, never gating), and the permanence + export reassurance sit at the seal step (no
// undo offered, the diary itself is not deleted).
export function ApproveStep({
  candidates,
  selectedIds,
  onToggle,
  heavyDetected,
  onSeal,
  onBack,
  busy,
  error,
}: {
  candidates: readonly LetGoCandidate[]
  selectedIds: readonly string[]
  onToggle: (neuronId: string) => void
  heavyDetected: boolean
  onSeal: () => void
  onBack: () => void
  busy: boolean
  error: boolean
}) {
  const selected = new Set(selectedIds)
  return (
    <div className="flex flex-col gap-4">
      {heavyDetected && <LetGoResourceNotice />}

      <p className="text-sm leading-relaxed text-text">{m.deletion_letgo_approve_lead()}</p>

      {candidates.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {candidates.map((candidate) => (
            <li key={candidate.neuronId} className="flex flex-col gap-1">
              <Checkbox
                label={candidate.name}
                checked={selected.has(candidate.neuronId)}
                onCheckedChange={() => onToggle(candidate.neuronId)}
              />
              <p className="pl-6 text-xs text-text-muted">{candidate.reason}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">{m.deletion_letgo_approve_empty()}</p>
      )}

      <p className="text-sm text-text-muted">{m.deletion_letgo_kept_facts()}</p>

      <div className="flex flex-col gap-1 rounded-md border border-border bg-surface/60 p-3">
        <p className="text-sm text-text">{m.deletion_letgo_permanence()}</p>
        <p className="text-sm text-text-muted">{m.deletion_letgo_export_reassurance()}</p>
      </div>

      {error && <p className="text-sm text-danger">{m.deletion_letgo_seal_error()}</p>}

      <div className="flex justify-end gap-2">
        <Button color="neutral" size="sm" onClick={onBack}>
          {m.deletion_letgo_back()}
        </Button>
        <Button
          color="danger"
          size="sm"
          onClick={onSeal}
          disabled={busy || selectedIds.length === 0}
        >
          {busy ? m.deletion_letgo_sealing() : m.deletion_letgo_seal_action()}
        </Button>
      </div>
    </div>
  )
}
