import { Button, TextArea } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/recall-star ui ([R1]): the summon-and-rewrite surface. An invitation to remember (not a
// form) above a session-only rewrite field, then the confirm that fires the single Recall. The
// faded current text prompt is composed above this by the widget (the same free read the panel
// shows); the original Diary is never shown ([I8]). No per-keystroke calls, no draft persistence.
export function RecallRewrite({
  value,
  onChange,
  onConfirm,
  busy,
}: {
  value: string
  onChange: (value: string) => void
  onConfirm: () => void
  busy: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-text-muted">{m.recall_rewrite_prompt()}</p>
      <TextArea
        label={m.recall_rewrite_label()}
        placeholder={m.recall_rewrite_placeholder()}
        value={value}
        rows={5}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="flex justify-end">
        <Button color="primary" disabled={busy || value.trim() === ''} onClick={onConfirm}>
          {busy ? m.recall_reconsolidating() : m.recall_confirm()}
        </Button>
      </div>
    </div>
  )
}
