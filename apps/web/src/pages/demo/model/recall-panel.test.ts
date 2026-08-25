// @vitest-environment jsdom

import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

import { tutorialRecallPanelSelection, useTutorialRecallPanelSelection } from './recall-panel.ts'

describe('tutorialRecallPanelSelection', () => {
  it('reselects the staged target when its panel is dismissed before recall starts', () => {
    expect(tutorialRecallPanelSelection('recall', null, null, 'target-memory', true)).toBe(
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
        true,
        setSelectedMemoryId,
      )
      return { selectedMemoryId, dismiss: () => setSelectedMemoryId(null) }
    })

    act(() => result.current.dismiss())
    await waitFor(() => expect(result.current.selectedMemoryId).toBe('target-memory'))
  })

  it('does not fight an active recall walk or open a panel outside the recall beat', () => {
    expect(
      tutorialRecallPanelSelection('recall', null, 'target-memory', 'target-memory', true),
    ).toBeNull()
    expect(tutorialRecallPanelSelection('gist_rise', null, null, 'target-memory', true)).toBeNull()
    expect(tutorialRecallPanelSelection('freePlay', null, null, 'target-memory', true)).toBeNull()
  })

  it('stages nothing while the staging is unwanted, whatever the reason', () => {
    // A scene mid-reveal (the month jump dimming the whole universe) and a beat whose work is already
    // done are the same answer here: there is nothing left to put in front of the visitor.
    expect(tutorialRecallPanelSelection('recall', null, null, 'target-memory', false)).toBeNull()
  })

  it('leaves an already-open panel alone rather than closing it', async () => {
    // The rule opens a panel; it never takes one away. A visitor who opened the target themselves
    // keeps it through a reveal.
    expect(
      tutorialRecallPanelSelection('recall', 'target-memory', null, 'target-memory', false),
    ).toBe('target-memory')
    const { result } = renderHook(() => {
      const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>('target-memory')
      useTutorialRecallPanelSelection(
        'recall',
        selectedMemoryId,
        null,
        'target-memory',
        false,
        setSelectedMemoryId,
      )
      return { selectedMemoryId }
    })
    await waitFor(() => expect(result.current.selectedMemoryId).toBe('target-memory'))
  })
})
