import type { EpisodicMemory } from '@cosimosi/memory'
import { Button, Card } from '@cosimosi/ui'
import { currentDecayText } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'

export interface DemoEntryReaderProps {
  readonly memory: EpisodicMemory
  readonly diaryBody: string
  readonly universeTime: string
  readonly onClose: () => void
}

// pages/demo ui: a launched star's entry, opened — the demo-local look-alike of the product's
// detail reading (`DetailPanel` and its provenance/gist reads stay never-mounted). It makes
// forgetting READABLE, not just visible at a distance: the memory's current words render as the
// production `currentDecayText` resolves them at the demo clock — eroded when time has passed,
// whole again after a recall — while the diary body below stays verbatim, because a diary is what
// was written and a memory is a representation of it ([I2]).
export function DemoEntryReader({
  memory,
  diaryBody,
  universeTime,
  onClose,
}: DemoEntryReaderProps) {
  return (
    <div className="pointer-events-auto absolute inset-y-0 right-0 flex w-full max-w-md flex-col justify-center p-4">
      <Card>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-text">{memory.name}</p>
          <Button color="neutral" size="sm" onClick={onClose}>
            {m.demo_entry_close_action()}
          </Button>
        </div>

        <p className="mt-3 text-xs text-text-muted">{m.demo_entry_current_label()}</p>
        <p className="mt-1 whitespace-pre-line text-sm text-text">
          {currentDecayText(memory, universeTime)}
        </p>

        <p className="mt-4 text-xs text-text-muted">{m.demo_entry_body_label()}</p>
        <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-line text-sm text-text-subtle">
          {diaryBody}
        </p>
      </Card>
    </div>
  )
}
