import { useEffect, type Dispatch, type SetStateAction } from 'react'

import type { DemoBeatId } from '@cosimosi/demo'

export type DemoPhaseKey = DemoBeatId | 'freePlay'

/**
 * The tutorial's recall panel is scenario staging, not the beat's work. Until the visitor starts the
 * recall walk, dismissing that staged panel selects the same target again; other beats and an active
 * recall surface leave selection alone.
 *
 * `stagingWanted` is the two conditions the page holds that this rule cannot see. The scene must not
 * be mid-reveal — the month jump that hands this beat over dims the whole universe as its own
 * presentation, and a panel raised over it covers the very thing the beat is about, so waiting turns
 * the arrival into an order: the canvas settles, then the panel and the caption come up together. And
 * the beat's own work must still be outstanding, so the staging cannot put the dismissed panel back
 * on the way out and leave a spent surface standing over the beats that follow.
 */
export function tutorialRecallPanelSelection(
  phaseKey: DemoPhaseKey,
  selectedMemoryId: string | null,
  recallMemoryId: string | null,
  tutorialRecallMemoryId: string,
  stagingWanted: boolean,
): string | null {
  if (phaseKey !== 'recall' || recallMemoryId || !stagingWanted) return selectedMemoryId
  return selectedMemoryId ?? tutorialRecallMemoryId
}

/** Owns the re-arm effect so the dismiss→selection lifecycle can be exercised without the page's
 * renderer, sequence engine, and fixture scene. */
export function useTutorialRecallPanelSelection(
  phaseKey: DemoPhaseKey,
  selectedMemoryId: string | null,
  recallMemoryId: string | null,
  tutorialRecallMemoryId: string,
  stagingWanted: boolean,
  setSelectedMemoryId: Dispatch<SetStateAction<string | null>>,
): void {
  useEffect(() => {
    const next = tutorialRecallPanelSelection(
      phaseKey,
      selectedMemoryId,
      recallMemoryId,
      tutorialRecallMemoryId,
      stagingWanted,
    )
    if (next !== selectedMemoryId) setSelectedMemoryId(next)
  }, [
    phaseKey,
    recallMemoryId,
    selectedMemoryId,
    setSelectedMemoryId,
    stagingWanted,
    tutorialRecallMemoryId,
  ])
}
