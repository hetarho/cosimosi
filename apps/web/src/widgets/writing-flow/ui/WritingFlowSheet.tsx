import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

import { reportSequenceSignal, type OnboardingAnchor } from '@cosimosi/onboarding'
import type { SequenceRect } from '@cosimosi/sequence'
import { useSequenceAnchorRegistration } from '@cosimosi/sequence/react'
import { Alert, Button, Dialog, Skeleton } from '@cosimosi/ui'
import type { WritingFlowStatus } from '@cosimosi/universe'
import { useWritingFlowController } from '@cosimosi/universe/react/flows'

import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { ProposedMemoryList } from '../../../entities/episodic-memory/index.ts'
import { ReviseControls } from '../../../features/revise-split/index.ts'
import { LaunchButton } from '../../../features/launch-stars/index.ts'
import { WriteDiaryFields } from '../../../features/write-diary/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { awaitArrival, measuredBox, type MeasuredBox } from '../../../shared/lib/measure-arrival.ts'
import { useErrorToast } from '@cosimosi/errors/react'

function errorMessage(kind: string | null): string | null {
  if (kind === 'split') return m.writing_flow_error_split()
  if (kind === 'revise') return m.writing_flow_error_revise()
  if (kind === 'launch') return m.writing_flow_error_launch()
  return null
}

// A pending phase is a wait with a shape (design-language §9 loading): the note says what is
// happening and the placeholders stand where the proposal will land, so the sheet does not collapse
// to a single line and snap back. `aria-busy` + a polite live region announce it without moving
// focus; the skeletons are decorative and stay out of the accessibility tree.
function PendingPhase({ label, placeholders = 0 }: { label: string; placeholders?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      <p className="text-sm leading-6 text-text-muted">{label}</p>
      {placeholders > 0 ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: placeholders }, (_, index) => (
            <Skeleton key={index} height={72} rounded="lg" />
          ))}
        </div>
      ) : null}
    </div>
  )
}

// The draft step's anchor. ONB-17 rings the body, the date and 별 쪼개기 together, but the Dialog lays
// them out apart: the fields in its body, the split action in its footer slot. `SequenceAnchor`
// measures one element, so this registers through the same seam with a measure that unions the draft
// column and the split row, each read once its arrival settles. It mounts only with the draft, so
// its registration is what re-measures a step that began before the sheet arrived.
function DraftAnchor({
  split,
  children,
}: {
  split: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  // The registration reads the handle through a ref, so a fresh closure per render churns nothing.
  const measure = async (): Promise<SequenceRect | null> => {
    const parts = [ref.current?.firstElementChild, split.current].filter(
      (node): node is Element => node != null,
    )
    await Promise.all(parts.map(awaitArrival))
    return unionBox(
      parts
        .filter((node) => node.isConnected)
        .map(measuredBox)
        .filter((box): box is MeasuredBox => box !== null),
    )
  }

  useSequenceAnchorRegistration('writing-draft' satisfies OnboardingAnchor, measure)

  return (
    <div ref={ref} data-sequence-anchor="writing-draft" style={{ display: 'contents' }}>
      {children}
    </div>
  )
}

function unionBox(boxes: readonly MeasuredBox[]): SequenceRect | null {
  if (boxes.length === 0) return null
  const left = Math.min(...boxes.map((box) => box.x))
  const top = Math.min(...boxes.map((box) => box.y))
  const right = Math.max(...boxes.map((box) => box.x + box.width))
  const bottom = Math.max(...boxes.map((box) => box.y + box.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

// widgets/writing-flow: the "일기 쓰기" affordance + the modal that composes the four features by
// machine phase (§3.1/§3.2). The flow machine owns the phase; the draft (features/write-diary) and
// the proposal (this widget's store) hold the data. It mounts OVER the running universe canvas —
// it never imports `three`/a visual entity (§3.4); the launch's visual consequence is the read
// model's projection (the optimistic star + the awaken it announces). Editing is session-only: the
// widget edits the pre-launch proposal, never a GetUniverse memory ([W4]).
//
// It is also one of the composition sites an onboarding tour points at. That costs it three anchor
// wrappers and one effect that reports the phase changes it was already making, and nothing else: the
// sheet's behaviour is identical with or without a run, because the report takes one id and returns
// nothing — there is no way from here to learn that a tour exists or to branch on one. A widget is a
// composition site, not a product slice, so `features/write-diary`, `features/launch-stars` and the
// proposed-memory list stay untouched beneath the wrappers ([I13]).
export function WritingFlowSheet() {
  const {
    status,
    errorKind,
    body,
    proposal,
    open,
    close,
    runSplit,
    runRevise,
    runLaunch,
    editThen,
    rename,
    setMood,
    setSourceText,
    merge,
    splitMemory,
    busy,
    back,
    pastDated,
  } = useWritingFlowController({ onError: useErrorToast() })
  const error = errorMessage(errorKind)
  const splitRow = useRef<HTMLDivElement | null>(null)
  // What an onboarding tour hears: the sheet's real phase changes, never its intentions. Reporting from
  // the promise arms would have advanced a run on a split whose RPC resolved after the sheet was closed
  // — the machine ignores `SPLIT_OK` in `idle`, so the flow would have stayed put while the tour walked
  // on to a proposal that is not on screen. A phase the machine actually entered cannot lie that way.
  //
  // The launch report fires for a past-dated launch too: the diary was saved, and the tour's next
  // captions are worded to hold whether or not a memory was created. The [T1] notice is this flow's.
  const reportedStatus = useRef<WritingFlowStatus>(status)
  useEffect(() => {
    const previous = reportedStatus.current
    reportedStatus.current = status
    if (previous === 'idle' && status === 'writing') reportSequenceSignal('writing-flow-opened')
    else if (previous === 'splitting' && status === 'reviewing')
      reportSequenceSignal('split-succeeded')
    else if (previous === 'launching' && status === 'done') reportSequenceSignal('launch-succeeded')
  }, [status])

  return (
    <>
      {/* The one action the home screen is for, so it is the biggest control on it — but outlined
          rather than filled: a border and its glow ring hold the emphasis without putting an opaque
          slab over the universe the screen exists to show (design-language §2.3). */}
      <Button
        variant="outlined"
        color="primary"
        size="lg"
        className="pointer-events-auto"
        onClick={open}
      >
        {m.universe_home_write()}
      </Button>
      <Dialog
        open={status !== 'idle' && status !== 'done'}
        onClose={close}
        title={m.writing_flow_title()}
        closeLabel={m.writing_flow_close()}
        footer={
          status === 'writing' ? (
            <div ref={splitRow} className="flex justify-end">
              <Button color="primary" disabled={body.trim().length === 0} onClick={runSplit}>
                {m.writing_flow_split_action()}
              </Button>
            </div>
          ) : status === 'reviewing' ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button variant="text" color="neutral" disabled={busy} onClick={back}>
                {m.writing_flow_back_action()}
              </Button>
              <SequenceAnchor id={'writing-confirm' satisfies OnboardingAnchor}>
                <LaunchButton pastDated={pastDated} busy={busy} onLaunch={runLaunch} />
              </SequenceAnchor>
            </div>
          ) : undefined
        }
      >
        {/* Panel rhythm: gap-5 between the phase blocks, tighter steps inside each (§4). */}
        <div className="flex flex-col gap-5">
          {/* The toast reports the failure once; the inline alert is the record that stays until
              the user acts on it (§9). */}
          {error ? <Alert variant="danger">{error}</Alert> : null}

          {status === 'writing' ? (
            // The anchor wraps ONE element, because the wrapper renders `display: contents` and
            // measures its first child — a fragment would put the ring around the body field alone.
            // The inner column repeats the panel's own gap, so the rhythm is unchanged (§4).
            <DraftAnchor split={splitRow}>
              <div className="flex flex-col gap-5">
                <WriteDiaryFields />
                {body.trim().length === 0 ? (
                  <p className="text-sm leading-6 text-text-subtle">
                    {m.writing_flow_empty_body_hint()}
                  </p>
                ) : null}
              </div>
            </DraftAnchor>
          ) : null}

          {status === 'splitting' ? (
            <PendingPhase label={m.writing_flow_splitting()} placeholders={2} />
          ) : null}

          {status === 'reviewing' ? (
            <>
              <p className="text-sm leading-6 text-text-muted">{m.writing_flow_review_hint()}</p>
              <SequenceAnchor id={'writing-proposal' satisfies OnboardingAnchor}>
                <ReviseControls
                  memories={proposal}
                  busy={busy}
                  onRename={(index, name) => editThen(() => rename(index, name))}
                  onSetMood={(index, mood) => editThen(() => setMood(index, mood))}
                  onSetSourceText={(index, sourceText) =>
                    editThen(() => setSourceText(index, sourceText))
                  }
                  onMerge={(index) => editThen(() => merge(index))}
                  onSplit={(index) => editThen(() => splitMemory(index))}
                  onRevise={runRevise}
                />
              </SequenceAnchor>
            </>
          ) : null}

          {status === 'revising' ? (
            <PendingPhase label={m.writing_flow_revising()} placeholders={2} />
          ) : null}

          {status === 'launching' ? (
            <>
              <ProposedMemoryList memories={proposal} />
              <PendingPhase label={m.writing_flow_launching()} />
            </>
          ) : null}
        </div>
      </Dialog>
    </>
  )
}
