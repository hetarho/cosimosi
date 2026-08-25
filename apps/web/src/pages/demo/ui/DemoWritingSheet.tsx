import { moodColor, type Mood } from '@cosimosi/emotion'
import { Badge, Button, Dialog, TextArea, TextField } from '@cosimosi/ui'

import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { m, moodLabel } from '../../../shared/i18n/index.ts'
import type { DemoAnchor } from '../model/anchors.ts'
import { isDemoAnchorInteractive, type DemoRunPhase } from '../model/run-machine.ts'

/** One proposed memory of the drawn diary, shaped the way the product's review list shows one. */
export interface DemoProposedMemory {
  readonly id: string
  readonly name: string
  readonly mood: string
  readonly sourceText: string
  readonly neurons: readonly { readonly name: string }[]
}

export interface DemoWritingSheetProps {
  readonly open: boolean
  readonly phase: DemoRunPhase
  readonly body: string
  readonly diaryDate: string
  readonly splitRevealed: boolean
  readonly memories: readonly DemoProposedMemory[]
  /** Beat 1 only: reading the diary is that beat's own act. */
  readonly showReadAffordance: boolean
  readonly onDiaryRead: () => void
  readonly onRevealSplit: () => void
  readonly onLaunch: () => void
  readonly onClose: () => void
}

// pages/demo ui: the write flow, in the PRODUCT's shapes — the same Dialog, the same field labels,
// the same 별 쪼개기 → proposal rows → 별 띄우기 walk the signed-in writing sheet performs. It is a
// deliberate read-only twin rather than a reuse of `widgets/writing-flow`: that widget is fused to
// the transport (useTransport, the split/revise/launch RPCs, the GetUniverse cache), and the demo's
// isolation closure exists precisely so none of that is expressible here — while an `isDemo` prop
// on the shipped widget is the flag [I13] forbids. What the twin drops is exactly the writable
// surface: the fields are read-only (a drawn diary is what was written), and there is no revise,
// no back-to-writing and no error arm, because nothing here can fail. A launch closes the dialog
// before the memory goes up, so the birth always plays on an unobstructed sky.
//
// The same two rules as the rail. Anchors: `SequenceAnchor` wraps one element at this composition
// site, ids from the closed union. Gating: pressability derives from the run machine alone; the
// dialog can only be dismissed when the write control could reopen it, so a tutorial beat staged
// inside the sheet cannot be stranded by its close button.
export function DemoWritingSheet({
  open,
  phase,
  body,
  diaryDate,
  splitRevealed,
  memories,
  showReadAffordance,
  onDiaryRead,
  onRevealSplit,
  onLaunch,
  onClose,
}: DemoWritingSheetProps) {
  const canDismiss = isDemoAnchorInteractive(phase, 'write-action')

  return (
    <Dialog
      open={open}
      onClose={canDismiss ? onClose : () => undefined}
      title={m.writing_flow_title()}
      closeLabel={m.writing_flow_close()}
    >
      <div className="flex flex-col gap-5">
        {!splitRevealed ? (
          <>
            <SequenceAnchor id="diary-card">
              <div className="flex flex-col gap-4">
                <TextArea
                  label={m.writing_flow_body_label()}
                  value={body}
                  rows={8}
                  readOnly
                  onChange={() => undefined}
                />
                <TextField
                  type="date"
                  label={m.writing_flow_date_label()}
                  value={diaryDate}
                  readOnly
                  onChange={() => undefined}
                />
                {/* Beat 1's own affordance, and its own anchor: the card around it is the region the
                    beat lights up to be read, while THIS is the press the beat waits for — so the
                    ring belongs here rather than around a paragraph. */}
                {showReadAffordance && (
                  <div className="flex justify-end">
                    <SequenceAnchor id={'diary-read-action' satisfies DemoAnchor}>
                      <Button
                        color="neutral"
                        onClick={onDiaryRead}
                        disabled={!isDemoAnchorInteractive(phase, 'diary-read-action')}
                      >
                        {m.demo_diary_read_action()}
                      </Button>
                    </SequenceAnchor>
                  </div>
                )}
              </div>
            </SequenceAnchor>
            {/* The committing action sits last on the right, as in the product (§4). */}
            <div className="flex justify-end">
              <SequenceAnchor id="split-action">
                <Button
                  color="primary"
                  onClick={onRevealSplit}
                  disabled={!isDemoAnchorInteractive(phase, 'split-action')}
                >
                  {m.writing_flow_split_action()}
                </Button>
              </SequenceAnchor>
            </div>
          </>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {memories.map((memory) => (
                <li
                  key={memory.id}
                  className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-base font-semibold text-text">
                      {memory.name}
                    </p>
                    <Badge variant="neutral">
                      <span
                        aria-hidden
                        className="badge-dot"
                        style={{ backgroundColor: moodColor(memory.mood as Mood) }}
                      />
                      {moodLabel(memory.mood)}
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 whitespace-pre-wrap text-text-muted">
                    {memory.sourceText}
                  </p>
                  {memory.neurons.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold tracking-wide text-text-subtle uppercase">
                        {m.writing_flow_neuron_label()}
                      </span>
                      {memory.neurons.map((neuron) => (
                        <Badge key={neuron.name} variant="neutral">
                          {neuron.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
              <SequenceAnchor id="launch-action">
                <Button
                  color="primary"
                  onClick={onLaunch}
                  disabled={!isDemoAnchorInteractive(phase, 'launch-action')}
                >
                  {m.writing_flow_launch_action()}
                </Button>
              </SequenceAnchor>
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}
