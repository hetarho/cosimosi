import { useEffect, useRef } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { reportSequenceSignal, type OnboardingAnchor } from '@cosimosi/onboarding'
import { Alert, Button, Dialog, Skeleton, tokens } from '@cosimosi/ui'
import type { WritingFlowStatus } from '@cosimosi/universe'
import { useWritingFlowController } from '@cosimosi/universe/react/flows'

import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { ProposedMemoryList } from '../../../features/split-diary/index.ts'
import { ReviseControls } from '../../../features/revise-split/index.ts'
import { LaunchButton } from '../../../features/launch-stars/index.ts'
import { WriteDiaryFields } from '../../../features/write-diary/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { useErrorToast } from '@cosimosi/errors/react'

function errorMessage(kind: string | null): string | null {
  if (kind === 'split') return m.writing_flow_error_split()
  if (kind === 'revise') return m.writing_flow_error_revise()
  if (kind === 'launch') return m.writing_flow_error_launch()
  return null
}

// A pending phase is a wait with a shape (design-language §9 loading), matching the web sheet: the
// note says what is happening and the placeholders stand where the proposal will land, so the sheet
// does not collapse to a single line and snap back.
function PendingPhase({ label, placeholders = 0 }: { label: string; placeholders?: number }) {
  return (
    <View style={styles.pending} accessibilityLiveRegion="polite">
      <Text style={styles.muted}>{label}</Text>
      {placeholders > 0
        ? Array.from({ length: placeholders }, (_, index) => (
            <Skeleton key={index} width="100%" height={72} rounded="lg" />
          ))
        : null}
    </View>
  )
}

// widgets/writing-flow (RN fork): the "일기 쓰기" affordance + a Modal that composes the four
// features by machine phase (§3.1/§3.2). Shares model/api with web verbatim; only this host + the
// input primitives fork (§3.5). It mounts over the running universe canvas and imports no `three`
// (§3.4) — the launch's visual consequence is the read model's projection.
//
// It is also one of the composition sites an onboarding tour points at. That costs it three anchor
// wrappers and one effect that reports the phase changes it was already making, and nothing else: the
// sheet's behaviour is identical with or without a run, because the report takes one id and returns
// nothing — there is no way from here to learn that a tour exists or to branch on one. A widget is a
// composition site, not a product slice, so `features/write-diary`, `features/split-diary` and
// `features/launch-stars` stay untouched beneath the wrappers ([I13]).
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
      <Button variant="outlined" color="primary" size="lg" onPress={open}>
        {m.universe_home_write()}
      </Button>
      <Dialog
        open={status !== 'idle' && status !== 'done'}
        onClose={close}
        title={m.writing_flow_title()}
        closeLabel={m.writing_flow_close()}
        footer={
          status === 'reviewing' ? (
            <View style={styles.footer}>
              <Button variant="text" color="neutral" disabled={busy} onPress={back}>
                {m.writing_flow_back_action()}
              </Button>
              <SequenceAnchor id={'writing-confirm' satisfies OnboardingAnchor}>
                <LaunchButton pastDated={pastDated} busy={busy} onLaunch={runLaunch} />
              </SequenceAnchor>
            </View>
          ) : undefined
        }
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* The toast reports the failure once; the inline alert is the record that stays until
              the user acts on it (§9). */}
          {error ? <Alert variant="danger">{error}</Alert> : null}

          {status === 'writing' ? (
            // The anchor wraps ONE view rather than the three loose children it used to have, so the
            // measured rect is the whole draft panel. The inner column repeats the scroll container's
            // own gap, so the rhythm is unchanged (§4).
            <SequenceAnchor id={'writing-draft' satisfies OnboardingAnchor}>
              <View style={styles.draft}>
                <WriteDiaryFields />
                {body.trim().length === 0 ? (
                  <Text style={styles.hint}>{m.writing_flow_empty_body_hint()}</Text>
                ) : null}
                {/* The committing action sits last, on the right (§4). */}
                <View style={styles.actionRow}>
                  <Button color="primary" disabled={body.trim().length === 0} onPress={runSplit}>
                    {m.writing_flow_split_action()}
                  </Button>
                </View>
              </View>
            </SequenceAnchor>
          ) : null}

          {status === 'splitting' ? (
            <PendingPhase label={m.writing_flow_splitting()} placeholders={2} />
          ) : null}

          {status === 'reviewing' ? (
            <>
              <Text style={styles.muted}>{m.writing_flow_review_hint()}</Text>
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
        </ScrollView>
      </Dialog>
    </>
  )
}

const styles = StyleSheet.create({
  // Panel rhythm: a step of 5 between the phase blocks, tighter steps inside each (§4).
  content: { gap: tokens.spacing[5] },
  draft: { gap: tokens.spacing[5] },
  hint: { color: tokens.color['text-subtle'], fontSize: tokens.fontSize.sm, lineHeight: 24 },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm, lineHeight: 24 },
  pending: { gap: tokens.spacing[3] },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacing[3],
  },
})
