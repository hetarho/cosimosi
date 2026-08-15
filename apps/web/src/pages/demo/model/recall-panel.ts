import { useEffect, type Dispatch, type SetStateAction } from 'react'

import type { DemoBeatId } from '@cosimosi/demo'

export type DemoPhaseKey = DemoBeatId | 'freePlay'

/**
 * The tutorial's recall panel is scenario staging, not the beat's work. Until the visitor starts
 * the recall walk, dismissing that staged panel selects the same target again; other beats and an
 * active recall surface leave selection alone.
 */
export function tutorialRecallPanelSelection(
  phaseKey: DemoPhaseKey,
  selectedMemoryId: string | null,
  recallMemoryId: string | null,
  tutorialRecallMemoryId: string,
): string | null {
  if (phaseKey !== 'recall' || recallMemoryId) return selectedMemoryId
  return selectedMemoryId ?? tutorialRecallMemoryId
}

/** Owns the re-arm effect so the dismiss→selection lifecycle can be exercised without the page's
 * renderer, sequence engine, and fixture scene. */
export function useTutorialRecallPanelSelection(
  phaseKey: DemoPhaseKey,
  selectedMemoryId: string | null,
  recallMemoryId: string | null,
  tutorialRecallMemoryId: string,
  setSelectedMemoryId: Dispatch<SetStateAction<string | null>>,
): void {
  useEffect(() => {
    const next = tutorialRecallPanelSelection(
      phaseKey,
      selectedMemoryId,
      recallMemoryId,
      tutorialRecallMemoryId,
    )
    if (next !== selectedMemoryId) setSelectedMemoryId(next)
  }, [phaseKey, recallMemoryId, selectedMemoryId, setSelectedMemoryId, tutorialRecallMemoryId])
}
