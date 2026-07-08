import { useCallback, useEffect } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { createGetUniverseQueryKey, createGetUniverseQueryOptions } from '@cosimosi/api-client'
import { Button, Dialog } from '@cosimosi/ui'
import {
  advanceAnnouncementFromLaunch,
  insertLaunchedMemories,
  isPastDated,
  requestLaunchStars,
  writingFlowMachine,
  type WritingFlowStatus,
} from '@cosimosi/universe'

import { ProposedMemoryList, requestSplitDiary } from '../../../features/split-diary/index.ts'
import { ReviseControls, requestReviseSplit } from '../../../features/revise-split/index.ts'
import { LaunchButton, useLaunchedNeuronsStore } from '../../../features/launch-stars/index.ts'
import { useAdvanceAnnouncementStore } from '../../../features/accelerate-time/index.ts'
import { WriteDiaryFields, useDiaryDraftStore } from '../../../features/write-diary/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { useMachine } from '../../../shared/model/index.ts'
import { useProposalStore } from '../model/proposal-store.ts'

// The diary date defaults to *today in the user's own timezone* ([W5]). `toISOString()` would emit
// the UTC date, which is a day behind for KST users in the local 00:00–09:00 window — build the ISO
// date from local calendar components instead.
const todayIso = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function errorMessage(kind: string | null): string | null {
  if (kind === 'split') return m.writing_flow_error_split()
  if (kind === 'revise') return m.writing_flow_error_revise()
  if (kind === 'launch') return m.writing_flow_error_launch()
  return null
}

// widgets/writing-flow: the "일기 쓰기" affordance + the modal that composes the four features by
// machine phase (§3.1/§3.2). The flow machine owns the phase; the draft (features/write-diary) and
// the proposal (this widget's store) hold the data. It mounts OVER the running universe canvas —
// it never imports `three`/a visual entity (§3.4); the launch's visual consequence is the read
// model's projection (the optimistic star + the awaken it announces). Editing is session-only: the
// widget edits the pre-launch proposal, never a GetUniverse memory ([W4]).
export function WritingFlowSheet() {
  const [snapshot, send] = useMachine(writingFlowMachine)
  const status = snapshot.value as WritingFlowStatus
  const error = errorMessage(snapshot.context.error)

  const transport = useTransport()
  const queryClient = useQueryClient()
  // Shares the canvas's GetUniverse cache (same key → no extra fetch); only universe time is read,
  // to *predict* a past-dated launch and warn before the button is pressed. This is a pre-launch
  // prediction, not the authority — the server returns the real outcome on `pastDated`. A
  // loading/errored read leaves it null → treated as not-past.
  const universeQuery = useQuery(createGetUniverseQueryOptions(transport))
  const universeTime =
    universeQuery.data && universeQuery.data.universeTime !== '' ? universeQuery.data.universeTime : null

  const body = useDiaryDraftStore((state) => state.body)
  const diaryDate = useDiaryDraftStore((state) => state.diaryDate)
  const resetDraft = useDiaryDraftStore((state) => state.reset)

  const proposal = useProposalStore((state) => state.memories)
  const setFromResponse = useProposalStore((state) => state.setFromResponse)
  const rename = useProposalStore((state) => state.rename)
  const setMood = useProposalStore((state) => state.setMood)
  const merge = useProposalStore((state) => state.merge)
  const splitMemory = useProposalStore((state) => state.split)
  const resetProposal = useProposalStore((state) => state.reset)

  const announce = useLaunchedNeuronsStore((state) => state.announce)
  const announceAdvance = useAdvanceAnnouncementStore((state) => state.announce)

  const open = useCallback(() => {
    resetDraft(todayIso())
    resetProposal()
    send({ type: 'OPEN' })
  }, [resetDraft, resetProposal, send])

  const close = useCallback(() => {
    send({ type: 'CLOSE' })
    resetProposal()
  }, [resetProposal, send])

  const runSplit = useCallback(() => {
    send({ type: 'SPLIT' })
    requestSplitDiary(transport, { body, diaryDate })
      .then((response) => {
        setFromResponse(response)
        send({ type: 'SPLIT_OK' })
      })
      .catch(() => send({ type: 'SPLIT_ERR', error: 'split' }))
  }, [transport, body, diaryDate, setFromResponse, send])

  const runRevise = useCallback(
    (instruction: string) => {
      send({ type: 'REVISE' })
      requestReviseSplit(transport, { body, diaryDate, previous: proposal, instruction })
        .then((response) => {
          setFromResponse(response)
          send({ type: 'REVISE_OK' })
        })
        .catch(() => send({ type: 'REVISE_ERR', error: 'revise' }))
    },
    [transport, body, diaryDate, proposal, setFromResponse, send],
  )

  const runLaunch = useCallback(() => {
    send({ type: 'LAUNCH' })
    const memories = proposal
    requestLaunchStars(transport, { body, diaryDate, memories })
      .then((response) => {
        // The server's monotonic guard is authoritative: a past-dated launch saves the diary
        // but creates no memory, so no star appears ([T1][I10]). Gate the optimistic insert on
        // its `pastDated` flag rather than inferring it from an empty id list.
        if (!response.pastDated) {
          insertLaunchedMemories(memories, response.memoryIds, diaryDate)
          // The reveal rides the clock ([T2] case 1: accelerate → then the star appears): a
          // clock-advancing launch hands the interval + awaken ids to the acceleration seam and
          // the overlay releases them when the transition completes. Presentation only — the
          // insert above and the invalidate below stay immediate. No advance (same-day launch)
          // keeps the immediate awaken.
          const advance = advanceAnnouncementFromLaunch(response)
          if (advance) announceAdvance(advance)
          else announce(response.newNeuronIds)
        }
        queryClient.invalidateQueries({ queryKey: createGetUniverseQueryKey(transport) }).catch(() => undefined)
        send({ type: 'LAUNCH_OK' })
      })
      .catch(() => send({ type: 'LAUNCH_ERR', error: 'launch' }))
  }, [transport, body, diaryDate, proposal, announce, announceAdvance, queryClient, send])

  const editThen = useCallback(
    (apply: () => void) => {
      apply()
      send({ type: 'EDIT' })
    },
    [send],
  )

  // On done, reconcile: close the sheet and clear the session draft/proposal. The optimistic star
  // already lives in the episodic-memory store; the GetUniverse refetch fills its real detail.
  useEffect(() => {
    if (status !== 'done') return
    resetProposal()
    resetDraft(todayIso())
    send({ type: 'RESET' })
  }, [status, resetProposal, resetDraft, send])

  const busy = status === 'splitting' || status === 'revising' || status === 'launching'

  return (
    <>
      <Button color="primary" className="pointer-events-auto" onClick={open}>
        {m.universe_home_write()}
      </Button>
      <Dialog
        open={status !== 'idle' && status !== 'done'}
        onClose={close}
        title={m.writing_flow_title()}
        closeLabel={m.writing_flow_close()}
      >
        <div className="flex flex-col gap-4">
          {error ? <p className="text-sm text-danger">{error}</p> : null}

          {status === 'writing' ? (
            <>
              <WriteDiaryFields />
              {body.trim().length === 0 ? <p className="text-sm text-text-subtle">{m.writing_flow_empty_body_hint()}</p> : null}
              <Button color="primary" className="self-start" disabled={body.trim().length === 0} onClick={runSplit}>
                {m.writing_flow_split_action()}
              </Button>
            </>
          ) : null}

          {status === 'splitting' ? <p className="text-sm text-text-muted">{m.writing_flow_splitting()}</p> : null}

          {status === 'reviewing' ? (
            <>
              <p className="text-sm text-text-muted">{m.writing_flow_review_hint()}</p>
              <ReviseControls
                memories={proposal}
                busy={busy}
                onRename={(index, name) => editThen(() => rename(index, name))}
                onSetMood={(index, mood) => editThen(() => setMood(index, mood))}
                onMerge={(index) => editThen(() => merge(index))}
                onSplit={(index) => editThen(() => splitMemory(index))}
                onRevise={runRevise}
              />
              <div className="flex items-center justify-between gap-3">
                <Button color="neutral" disabled={busy} onClick={() => send({ type: 'BACK' })}>
                  {m.writing_flow_back_action()}
                </Button>
                <LaunchButton pastDated={isPastDated(diaryDate, universeTime)} busy={busy} onLaunch={runLaunch} />
              </div>
            </>
          ) : null}

          {status === 'revising' ? <p className="text-sm text-text-muted">{m.writing_flow_revising()}</p> : null}

          {status === 'launching' ? (
            <>
              <ProposedMemoryList memories={proposal} />
              <p className="text-sm text-text-muted">{m.writing_flow_launching()}</p>
            </>
          ) : null}
        </div>
      </Dialog>
    </>
  )
}
