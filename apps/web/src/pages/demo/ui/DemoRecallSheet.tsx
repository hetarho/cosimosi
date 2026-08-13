import type { EpisodicMemory } from '@cosimosi/memory'
import { Button, Dialog, ObscuredText, TextArea } from '@cosimosi/ui'
import { currentDecaySpans } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'

export interface DemoRecallSheetProps {
  readonly open: boolean
  readonly memory: EpisodicMemory | null
  /** The read-time "now" the faded words are resolved at — the demo clock. */
  readonly universeTime: string
  /** The reading this memory comes back as, prepared by the fixture ([Z5]); `null` when the set
   *  authored none, which is the honest "it came back unchanged" case. */
  readonly reconsolidatedText: string | null
  /** Set once the recall has been applied — the surface switches to what came back. */
  readonly done: boolean
  readonly onConfirm: () => void
  readonly onClose: () => void
}

// pages/demo ui: 회고하기, in the product's own shapes — the read-only twin of `widgets/recall-flow`
// ([R1]). The shipped flow is the paid one: a cost quote, a sync-consent modal, an operation-id'd
// call and a fenced in-flight state, none of which is reachable from here and none of which [Z2] /
// [Z8] would let render if it were. What the twin keeps is the walk: the faded words as they are
// now, the invitation to write them back, the confirm, then what the memory reads as afterwards.
//
// The rewrite field is READ-ONLY and already filled, the way the writing sheet's fields are: the
// demo's re-readings are precomputed ([Z5]), so the honest presentation is a prepared sentence the
// visitor sends back rather than a box whose contents would be quietly discarded. No cost line, no
// consent step, no spinner — nothing here can fail, and there is no price to show.
export function DemoRecallSheet({
  open,
  memory,
  universeTime,
  reconsolidatedText,
  done,
  onConfirm,
  onClose,
}: DemoRecallSheetProps) {
  if (!open || !memory) return null

  // A memory the set authored no re-reading for comes back as it went in — so the sentence the
  // visitor sends back IS the current one, and the result says "clearer again, unchanged".
  const rewrite = reconsolidatedText ?? memory.currentText

  return (
    <Dialog open onClose={onClose} title={m.recall_flow_title()} closeLabel={m.common_dismiss()}>
      <div className="flex flex-col gap-4">
        {done ? (
          <>
            {reconsolidatedText ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-text-muted">{m.recall_result_reconsolidated()}</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-text">
                  {reconsolidatedText}
                </p>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-text-muted">
                {m.recall_result_reinforced()}
              </p>
            )}
            <div className="flex justify-end">
              <Button color="neutral" onClick={onClose}>
                {m.common_dismiss()}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* The same free read the panel shows: what the words are now, smeared where the
                forgetting took them. The original diary is never shown here ([I8]). */}
            <ObscuredText
              className="whitespace-pre-line"
              spans={currentDecaySpans(memory, universeTime).map((span) => ({
                text: span.text,
                obscured: span.lost,
              }))}
            />
            <p className="text-sm leading-relaxed text-text-muted">{m.recall_rewrite_prompt()}</p>
            <TextArea
              label={m.recall_rewrite_label()}
              value={rewrite}
              rows={5}
              readOnly
              onChange={() => undefined}
            />
            <p className="text-sm text-text-subtle">{m.demo_recall_prepared_note()}</p>
            <div className="flex justify-end">
              <Button color="primary" onClick={onConfirm}>
                {m.recall_confirm()}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}
