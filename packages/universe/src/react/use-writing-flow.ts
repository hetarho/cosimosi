import { useCallback, useEffect, useRef } from 'react'
import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createGetUniverseQueryKey, createGetUniverseQueryOptions } from '@cosimosi/api-client'
import { requestSplitDiary, requestReviseSplit } from '@cosimosi/memory'
import { useMachine } from '@cosimosi/state-machine/react'
import { advanceAnnouncementFromLaunch } from '../advance-interval.ts'
import { useAdvanceAnnouncementStore } from '../advance-announcement-store.ts'
import { insertLaunchedMemories, isPastDated, requestLaunchStars } from '../launch-stars.ts'
import { writingFlowMachine, type WritingFlowStatus } from '../writing-flow.machine.ts'
import { useDiaryDraftStore } from '../diary-draft-store.ts'
import { useProposalStore } from '../proposal-store.ts'
import { useLaunchedNeuronsStore } from '../launched-neurons-store.ts'
import { useCompletionScope } from './use-completion-scope.ts'

const todayIso = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function useWritingFlowController({
  onError: showError,
}: {
  onError(error: unknown): void
}) {
  const [snapshot, send, actor] = useMachine(writingFlowMachine)
  const status = snapshot.value as WritingFlowStatus

  const capture = useCompletionScope()
  const generation = useRef(0)
  const captureIntent = useCallback(() => {
    const current = capture()
    const intent = generation.current
    return () => current() && intent === generation.current
  }, [capture])
  const transport = useTransport()
  const queryClient = useQueryClient()
  // Shares the canvas's GetUniverse cache (same key → no extra fetch); only universe time is read,
  // to *predict* a past-dated launch and warn before the button is pressed. This is a pre-launch
  // prediction, not the authority — the server returns the real outcome on `pastDated`. A
  // loading/errored read leaves it null → treated as not-past.
  const universeQuery = useQuery(createGetUniverseQueryOptions(transport))
  const universeTime =
    universeQuery.data && universeQuery.data.universeTime !== ''
      ? universeQuery.data.universeTime
      : null

  const body = useDiaryDraftStore((state) => state.body)
  const diaryDate = useDiaryDraftStore((state) => state.diaryDate)
  const resetDraft = useDiaryDraftStore((state) => state.reset)

  const proposal = useProposalStore((state) => state.memories)
  const setFromResponse = useProposalStore((state) => state.setFromResponse)
  const rename = useProposalStore((state) => state.rename)
  const setMood = useProposalStore((state) => state.setMood)
  const setSourceText = useProposalStore((state) => state.setSourceText)
  const merge = useProposalStore((state) => state.merge)
  const splitMemory = useProposalStore((state) => state.split)
  const resetProposal = useProposalStore((state) => state.reset)

  const announce = useLaunchedNeuronsStore((state) => state.announce)
  const announceAdvance = useAdvanceAnnouncementStore((state) => state.announce)

  const open = useCallback(() => {
    generation.current += 1
    resetDraft(todayIso())
    resetProposal()
    send({ type: 'OPEN' })
  }, [resetDraft, resetProposal, send])

  const close = useCallback(() => {
    generation.current += 1
    send({ type: 'CLOSE' })
    resetProposal()
  }, [resetProposal, send])

  const runSplit = useCallback(() => {
    if (actor.getSnapshot().value !== 'writing') return
    const isCurrent = captureIntent()
    send({ type: 'SPLIT' })
    requestSplitDiary(transport, { body, diaryDate })
      .then((response) => {
        if (!isCurrent()) return
        setFromResponse(response)
        send({ type: 'SPLIT_OK' })
      })
      .catch((caught) => {
        if (!isCurrent()) return
        showError(caught)
        send({ type: 'SPLIT_ERR', error: 'split' })
      })
  }, [transport, body, diaryDate, setFromResponse, showError, send, actor, captureIntent])

  const runRevise = useCallback(
    (instruction: string) => {
      if (actor.getSnapshot().value !== 'reviewing') return
      const isCurrent = captureIntent()
      send({ type: 'REVISE' })
      requestReviseSplit(transport, { body, diaryDate, previous: proposal, instruction })
        .then((response) => {
          if (!isCurrent()) return
          setFromResponse(response)
          send({ type: 'REVISE_OK' })
        })
        .catch((caught) => {
          if (!isCurrent()) return
          showError(caught)
          send({ type: 'REVISE_ERR', error: 'revise' })
        })
    },
    [transport, body, diaryDate, proposal, setFromResponse, showError, send, actor, captureIntent],
  )

  const runLaunch = useCallback(() => {
    if (actor.getSnapshot().value !== 'reviewing') return
    const isCurrent = captureIntent()
    send({ type: 'LAUNCH' })
    const memories = proposal
    requestLaunchStars(transport, { body, diaryDate, memories })
      .then((response) => {
        if (!isCurrent()) return
        // The server's monotonic guard is authoritative: a past-dated launch saves the diary
        // but creates no memory, so no star appears ([T1][I10]). Gate the optimistic insert on
        // its `pastDated` flag rather than inferring it from an empty id list.
        if (!response.pastDated) {
          insertLaunchedMemories(memories, response.memoryIds, diaryDate, response.diaryId)
          // The reveal rides the clock ([T2] case 1: accelerate → then the star appears): a
          // clock-advancing launch hands the interval + awaken ids to the acceleration seam and
          // the overlay releases them when the transition completes. Presentation only — the
          // insert above and the invalidate below stay immediate. No advance (same-day launch)
          // keeps the immediate awaken.
          const advance = advanceAnnouncementFromLaunch(response)
          if (advance) announceAdvance(advance)
          else announce(response.newNeuronIds)
        }
        queryClient
          .invalidateQueries({ queryKey: createGetUniverseQueryKey(transport) })
          .catch(() => undefined)
        send({ type: 'LAUNCH_OK' })
      })
      .catch((caught) => {
        if (!isCurrent()) return
        showError(caught)
        send({ type: 'LAUNCH_ERR', error: 'launch' })
      })
  }, [
    transport,
    body,
    diaryDate,
    proposal,
    announce,
    announceAdvance,
    queryClient,
    showError,
    send,
    actor,
    captureIntent,
  ])

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
  return {
    status,
    errorKind: snapshot.context.error,
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
    back: () => send({ type: 'BACK' }),
    pastDated: isPastDated(diaryDate, universeTime),
  }
}
