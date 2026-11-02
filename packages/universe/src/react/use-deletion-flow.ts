import { useCallback, useEffect, useMemo } from 'react'
import { VALUES } from '@cosimosi/config'
import { useMachine } from '@cosimosi/state-machine/react'
import { deletionFlowMachine, type DeletionFlowPhase } from '../deletion-flow.machine.ts'
import { useDeletionTargetStore } from '../deletion-target-store.ts'
import { useDiaryStore } from '../diary-store.ts'
import { useEpisodicMemoryStore } from '../episodic-memory-store.ts'
import { useDeletionDraftStore } from '../deletion-draft-store.ts'
import { useCompletionScope } from './use-completion-scope.ts'
import { useReleaseMemory } from './use-release.ts'
import { useLetGo, useSuggestLetGo } from './use-let-go.ts'

// The deletion flow's three server calls. Tests inject them; hosts use the package's RPC hooks.
export interface DeletionFlowRequests {
  release: ReturnType<typeof useReleaseMemory>
  suggest: ReturnType<typeof useSuggestLetGo>
  letGo: ReturnType<typeof useLetGo>
}

export function useDeletionFlowController({
  active = true,
  onError: showError,
  invalidateAchievements,
  requests,
}: {
  active?: boolean
  onError(error: unknown): void
  invalidateAchievements(): void
  requests?: DeletionFlowRequests
}) {
  const capture = useCompletionScope()
  const target = useDeletionTargetStore((state) => state.target)
  const clearTarget = useDeletionTargetStore((state) => state.clear)

  const [snapshot, send] = useMachine(deletionFlowMachine)
  const phase = snapshot.value as DeletionFlowPhase
  const { diaryId, episodicMemoryId } = snapshot.context
  // The loading states are un-closable — the flow leaves them only via its own DONE/ERROR, so a
  // stale async completion can never land on a newly-opened branch.
  const isLoading = phase === 'deleting' || phase === 'suggesting' || phase === 'sealing'

  const rpcRelease = useReleaseMemory()
  const rpcSuggest = useSuggestLetGo()
  const rpcLetGo = useLetGo()
  const release = requests?.release ?? rpcRelease
  const suggest = requests?.suggest ?? rpcSuggest
  const letGo = requests?.letGo ?? rpcLetGo

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

  const error = snapshot.context.error

  // Open on a non-null target (the recall-flow precedent): reset the draft, then branch by mode.
  // `active` is the host's focus gate — only the focused route consumes the shared target.
  useEffect(() => {
    if (active && target && phase === 'idle') {
      resetDraft()

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
    const isCurrent = capture()

    send({ type: 'CONFIRM' })
    try {
      await release(diaryId)
      if (!isCurrent()) return
      // A let-go records progress but moves no Twinkle, so this widget invalidated nothing before —
      // the one progress-recording surface with no balance to refresh.
      invalidateAchievements()
      send({ type: 'DONE' })
    } catch (caught) {
      if (!isCurrent()) return
      showError(caught)

      send({ type: 'ERROR' })
    }
  }, [diaryId, release, showError, send, invalidateAchievements, capture])

  const runSuggest = useCallback(async () => {
    if (!episodicMemoryId) return
    const isCurrent = capture()

    send({ type: 'SUGGEST' })
    try {
      const response = await suggest(episodicMemoryId, phrase)
      if (!isCurrent()) return
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
      if (!isCurrent()) return
      showError(caught)

      send({ type: 'ERROR' })
    }
  }, [episodicMemoryId, phrase, suggest, setSuggestion, showError, send, capture])

  const runSeal = useCallback(async () => {
    if (!episodicMemoryId) return
    const isCurrent = capture()

    send({ type: 'SEAL' })
    try {
      await letGo(episodicMemoryId, selectedNeuronIds)
      if (!isCurrent()) return
      send({ type: 'DONE' })
    } catch (caught) {
      if (!isCurrent()) return
      showError(caught)

      send({ type: 'ERROR' })
    }
  }, [episodicMemoryId, selectedNeuronIds, letGo, showError, send, capture])

  const back = useCallback(() => {
    send({ type: 'BACK' })
  }, [send])

  return {
    phase,
    affectedNames,
    retentionDays,
    close,
    confirmDelete,
    phrase,
    setPhrase,
    runSuggest,
    candidates,
    selectedNeuronIds,
    toggle,
    heavyDetected,
    runSeal,
    back,
    error,
  }
}
