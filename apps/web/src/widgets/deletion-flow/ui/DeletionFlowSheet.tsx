import { useCallback, useEffect, useMemo, useState } from 'react'

import { useInvalidateAchievements } from '@cosimosi/achievement/react'
import { Dialog } from '@cosimosi/ui'
import { VALUES } from '@cosimosi/config'
import {
  deletionFlowMachine,
  useDeletionTargetStore,
  useDiaryStore,
  useEpisodicMemoryStore,
  type DeletionFlowPhase,
} from '@cosimosi/universe'

import { DeleteConfirm, useReleaseMemory } from '../../../features/delete-memory/index.ts'
import {
  ApproveStep,
  PhrasingStep,
  useLetGo,
  useSuggestLetGo,
} from '../../../features/let-go/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { useErrorToast, useMachine } from '../../../shared/model/index.ts'
import { useDeletionDraftStore } from '@cosimosi/universe'

// widgets/deletion-flow ([X1][X4]): the modal host over the running canvas. The canvas stays mounted
// while this widget composes the three features. It owns the flow machine + draft store and sequences
// each
// branch: full delete (confirm → Release → optimistic remove) and letting-go (say the words →
// SuggestLetGo → approve → LetGo → optimistic seal). It imports only the domain mirrors (§3.4) —
// never `three` or a visual entity — and opens on the shared deletion-target store, which lets it be
// mounted on both the universe and the diary-reader routes.
export function DeletionFlowSheet({ active = true }: { active?: boolean }) {
  const showError = useErrorToast()
  const invalidateAchievements = useInvalidateAchievements()
  const target = useDeletionTargetStore((state) => state.target)
  const clearTarget = useDeletionTargetStore((state) => state.clear)

  const [snapshot, send] = useMachine(deletionFlowMachine)
  const phase = snapshot.value as DeletionFlowPhase
  const { diaryId, episodicMemoryId } = snapshot.context
  // The loading states are un-closable — the flow leaves them only via its own DONE/ERROR, so a
  // stale async completion can never land on a newly-opened branch.
  const isLoading = phase === 'deleting' || phase === 'suggesting' || phase === 'sealing'

  const release = useReleaseMemory()
  const suggest = useSuggestLetGo()
  const letGo = useLetGo()

  const phrase = useDeletionDraftStore((state) => state.phrase)
  const candidates = useDeletionDraftStore((state) => state.candidates)
  const selectedNeuronIds = useDeletionDraftStore((state) => state.selectedNeuronIds)
  const heavyDetected = useDeletionDraftStore((state) => state.heavyDetected)
  const setPhrase = useDeletionDraftStore((state) => state.setPhrase)
  const setSuggestion = useDeletionDraftStore((state) => state.setSuggestion)
  const toggle = useDeletionDraftStore((state) => state.toggle)
  const resetDraft = useDeletionDraftStore((state) => state.reset)

  const diariesById = useDiaryStore((state) => state.byId)
  const memoriesById = useEpisodicMemoryStore((state) => state.byId)
  // Which stars this delete takes — the one thing the confirm exists to show, so it must never come
  // up empty for want of a source. The archive mirror answers wherever the reader has shown the
  // diary (its paged list, and the calendar's day read, which contributes without owning it); the
  // universe route mounts no archive at all, and there the live memory mirror answers instead —
  // every star in the sky names the diary it came from. Both hold only memories that are still live,
  // so the two answers agree.
  const affectedNames = useMemo(() => {
    if (!diaryId) return []
    const fromArchive = diariesById[diaryId]?.memories
    if (fromArchive) return fromArchive.map((member) => member.name)
    return Object.values(memoriesById)
      .filter((memory) => memory.diaryId === diaryId)
      .map((memory) => memory.name)
  }, [diaryId, diariesById, memoriesById])
  const retentionDays = VALUES.release.softDeleteRetentionDays

  const [error, setError] = useState(false)

  // Open on a non-null target (the recall-flow precedent): reset the draft, then branch by mode.
  // `active` is the host's focus gate — only the focused route consumes the shared target.
  useEffect(() => {
    if (active && target && phase === 'idle') {
      resetDraft()
      setError(false)
      if (target.mode === 'delete') send({ type: 'OPEN_DELETE', diaryId: target.diaryId })
      else send({ type: 'OPEN_LETGO', episodicMemoryId: target.episodicMemoryId })
    }
  }, [active, target, phase, send, resetDraft])

  const close = useCallback(() => {
    // Un-closable while a call is in flight (the close button + backdrop dismiss are inert then).
    if (isLoading) return
    send({ type: 'CANCEL' })
    clearTarget()
    resetDraft()
    setError(false)
  }, [isLoading, send, clearTarget, resetDraft])

  // The act completed — the star vanished (delete) or persists thinned (let-go). Close the sheet;
  // there is no undo affordance after done ([X5]).
  useEffect(() => {
    if (phase === 'done') {
      send({ type: 'RESET' })
      clearTarget()
      resetDraft()
    }
  }, [phase, send, clearTarget, resetDraft])

  const confirmDelete = useCallback(async () => {
    if (!diaryId) return
    setError(false)
    send({ type: 'CONFIRM' })
    try {
      await release(diaryId)
      // A let-go records progress but moves no Twinkle, so this widget invalidated nothing before —
      // the one progress-recording surface with no balance to refresh.
      invalidateAchievements()
      send({ type: 'DONE' })
    } catch (caught) {
      showError(caught)
      setError(true)
      send({ type: 'ERROR' })
    }
  }, [diaryId, release, showError, send, invalidateAchievements])

  const runSuggest = useCallback(async () => {
    if (!episodicMemoryId) return
    setError(false)
    send({ type: 'SUGGEST' })
    try {
      const response = await suggest(episodicMemoryId, phrase)
      setSuggestion(
        response.candidates.map((candidate) => ({
          neuronId: candidate.neuronId,
          name: candidate.name,
          reason: candidate.reason,
        })),
        response.heavyState?.detected ?? false,
      )
      send({ type: 'DONE' })
    } catch (caught) {
      showError(caught)
      setError(true)
      send({ type: 'ERROR' })
    }
  }, [episodicMemoryId, phrase, suggest, setSuggestion, showError, send])

  const runSeal = useCallback(async () => {
    if (!episodicMemoryId) return
    setError(false)
    send({ type: 'SEAL' })
    try {
      await letGo(episodicMemoryId, selectedNeuronIds)
      send({ type: 'DONE' })
    } catch (caught) {
      showError(caught)
      setError(true)
      send({ type: 'ERROR' })
    }
  }, [episodicMemoryId, selectedNeuronIds, letGo, showError, send])

  const back = useCallback(() => {
    setError(false)
    send({ type: 'BACK' })
  }, [send])

  if (phase === 'idle' || phase === 'done') return null

  const isDeleteBranch = phase === 'confirmingDelete' || phase === 'deleting'
  const title = isDeleteBranch ? m.deletion_delete_title() : m.deletion_letgo_title()

  return (
    <Dialog open onClose={close} title={title} closeLabel={m.deletion_cancel()}>
      {isDeleteBranch && (
        <DeleteConfirm
          affectedNames={affectedNames}
          retentionDays={retentionDays}
          busy={phase === 'deleting'}
          error={error}
          onConfirm={confirmDelete}
          onCancel={close}
        />
      )}
      {(phase === 'phrasing' || phase === 'suggesting') && (
        <PhrasingStep
          value={phrase}
          onChange={setPhrase}
          onSuggest={runSuggest}
          onCancel={close}
          busy={phase === 'suggesting'}
          error={error && phase === 'phrasing'}
        />
      )}
      {(phase === 'approving' || phase === 'sealing') && (
        <ApproveStep
          candidates={candidates}
          selectedIds={selectedNeuronIds}
          onToggle={toggle}
          heavyDetected={heavyDetected}
          onSeal={runSeal}
          onBack={back}
          busy={phase === 'sealing'}
          error={error && phase === 'approving'}
        />
      )}
    </Dialog>
  )
}
