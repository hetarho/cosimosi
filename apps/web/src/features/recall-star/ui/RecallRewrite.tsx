import { Button, TextField } from '@cosimosi/ui'
import type { RecallPassagePart } from '@cosimosi/universe'
import { m } from '../../../shared/i18n/index.ts'

export function RecallRewrite({
  parts,
  answers,
  onAnswer,
  canConfirm,
  inputLocked,
  onConfirm,
  busy,
}: {
  parts: readonly RecallPassagePart[] | null
  answers: Readonly<Record<number, string>>
  onAnswer: (index: number, value: string) => void
  canConfirm: boolean
  inputLocked: boolean
  onConfirm: () => void
  busy: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-text-muted">{m.recall_rewrite_prompt()}</p>
      {parts === null ? (
        <p className="text-sm text-text-muted">{m.common_loading()}</p>
      ) : (
        <div className="text-sm leading-loose whitespace-pre-wrap text-text">
          {parts.map((part) =>
            part.lost ? (
              <div key={part.index} className="mx-1 inline-block w-48 max-w-full align-middle">
                <TextField
                  label={m.recall_blank_label({ position: part.blankNumber })}
                  placeholder={m.recall_rewrite_placeholder()}
                  value={answers[part.index] ?? ''}
                  onChange={(event) => onAnswer(part.index, event.target.value)}
                  disabled={busy || inputLocked}
                  autoComplete="off"
                />
              </div>
            ) : (
              <span key={part.index}>{part.text}</span>
            ),
          )}
        </div>
      )}
      {parts && !parts.some((part) => part.lost) ? (
        <p className="text-sm text-text-muted">{m.recall_no_missing_words()}</p>
      ) : null}
      <div className="flex justify-end">
        <Button color="primary" disabled={busy || !canConfirm} onClick={onConfirm}>
          {busy ? m.recall_reconsolidating() : m.recall_confirm()}
        </Button>
      </div>
    </div>
  )
}
