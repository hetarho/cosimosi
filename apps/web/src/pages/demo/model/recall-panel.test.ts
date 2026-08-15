// @vitest-environment jsdom

import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

import { tutorialRecallPanelSelection, useTutorialRecallPanelSelection } from './recall-panel.ts'

describe('tutorialRecallPanelSelection', () => {
  it('reselects the staged target when its panel is dismissed before recall starts', () => {
    expect(tutorialRecallPanelSelection('recall', null, null, 'target-memory')).toBe(
      'target-memory',
    )
  })

  it('re-arms through the same effect the page uses after a dismiss', async () => {
    const { result } = renderHook(() => {
      const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>('target-memory')
      useTutorialRecallPanelSelection(
        'recall',
        selectedMemoryId,
        null,
        'target-memory',
        setSelectedMemoryId,
      )
      return { selectedMemoryId, dismiss: () => setSelectedMemoryId(null) }
    })

    act(() => result.current.dismiss())
    await waitFor(() => expect(result.current.selectedMemoryId).toBe('target-memory'))
  })

  it('does not fight an active recall walk or open a panel outside the recall beat', () => {
    expect(
      tutorialRecallPanelSelection('recall', null, 'target-memory', 'target-memory'),
    ).toBeNull()
    expect(tutorialRecallPanelSelection('gist_rise', null, null, 'target-memory')).toBeNull()
    expect(tutorialRecallPanelSelection('freePlay', null, null, 'target-memory')).toBeNull()
  })
})
