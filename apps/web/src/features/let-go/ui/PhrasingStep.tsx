import { Button, TextArea } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/let-go ui step 1 ([X6][X7]): say the words. A restrained free-text input framed as
// symbolic release from the first screen, with the honest note that this blurs a trace — it is not
// treatment. The typed phrase lives in the draft store (the widget owns it); this only presents.
export function PhrasingStep({
  value,
  onChange,
  onSuggest,
  onCancel,
  busy,
  error,
}: {
  value: string
  onChange: (value: string) => void
  onSuggest: () => void
  onCancel: () => void
  busy: boolean
  error: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-text">{m.deletion_letgo_phrasing_prompt()}</p>
      <p className="text-sm text-text-muted">{m.deletion_letgo_phrasing_note()}</p>
      <TextArea
        label={m.deletion_letgo_phrasing_label()}
        placeholder={m.deletion_letgo_phrasing_placeholder()}
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <p className="text-sm text-danger">{m.deletion_letgo_suggest_error()}</p>}
      <div className="flex justify-end gap-2">
        <Button color="neutral" size="sm" onClick={onCancel}>
          {m.deletion_cancel()}
        </Button>
        <Button
          color="primary"
          size="sm"
          onClick={onSuggest}
          disabled={busy || value.trim() === ''}
        >
          {busy ? m.deletion_letgo_suggesting() : m.deletion_letgo_suggest_action()}
        </Button>
      </div>
    </div>
  )
}
