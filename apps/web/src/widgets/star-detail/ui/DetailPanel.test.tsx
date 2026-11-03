// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, type ReactNode } from 'react'
import { createActor } from 'xstate'

import { createEmotion } from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'
import { useEpisodicMemoryStore } from '@cosimosi/universe'
import { universeNavigationMachine } from '@cosimosi/universe/scene'

import { defaultLocale, m, setActiveLocale } from '../../../shared/i18n/index.ts'

// The preview's renderer cannot run in jsdom; the stub counts its mounts, which is what decides
// whether a phase change built a second WebGPU device, and reports whether it is asked to render.
const preview = vi.hoisted(() => ({ mounts: 0 }))
vi.mock('@cosimosi/universe-render', async () => {
  const { createContext, useContext } = await import('react')
  const Active = createContext(true)
  return {
    StarPreviewActivity: ({ active, children }: { active: boolean; children: ReactNode }) => (
      <Active.Provider value={active}>{children}</Active.Provider>
    ),
    StarPreview: () => {
      const active = useContext(Active)
      useEffect(() => {
        preview.mounts++
      }, [])
      return <div data-testid="star-preview" data-active={String(active)} />
    },
  }
})
vi.mock('@cosimosi/store/react', () => ({ useWornOrnaments: () => ({}) }))
vi.mock('@cosimosi/memory/react', () => ({
  useProvenanceQuery: () => ({ entries: [], status: 'ready', retry: () => undefined }),
}))

const { DetailPanel } = await import('./DetailPanel.tsx')

const memory = {
  id: 'm1',
  diaryId: 'd1',
  name: 'Market run',
  emotion: createEmotion('JOY'),
  baseStrength: 0.5,
  recallCount: 0,
  createdUniverseTime: '2026-06-20',
  lastRecalledUniverseTime: null,
  seed: 123n,
  activations: [],
  decayStages: [],
  forgettingOffsetDays: 0,
  currentText: 'a memory',
  semanticStage: 0,
} as EpisodicMemory

beforeEach(() => {
  setActiveLocale(defaultLocale)
  preview.mounts = 0
  useEpisodicMemoryStore.getState().clear()
  useEpisodicMemoryStore.getState().reconcile([memory])
})

afterEach(() => {
  cleanup()
  useEpisodicMemoryStore.getState().clear()
})

function renderPanel(onRecallRequested = vi.fn()) {
  const navigation = createActor(universeNavigationMachine).start()
  render(
    <DetailPanel
      navigationActorRef={navigation}
      onRecallRequested={onRecallRequested}
      onOpenDiary={vi.fn()}
      onDeleteSourceDiary={vi.fn()}
      onLetGo={vi.fn()}
    />,
  )
  act(() => navigation.send({ type: 'SELECT', nodeId: memory.id }))
  return { onRecallRequested }
}

const shownPreview = () => screen.getByTestId('star-preview').getAttribute('data-active')

describe('DetailPanel star preview', () => {
  it('keeps one preview across meta → provenance → meta, parked while hidden', async () => {
    const user = userEvent.setup()
    renderPanel()
    expect(shownPreview()).toBe('true')
    expect(preview.mounts).toBe(1)

    await user.click(screen.getByRole('button', { name: m.star_detail_actions_label() }))
    await user.click(screen.getByText(m.star_detail_provenance()))
    expect(shownPreview()).toBe('false')

    await user.click(screen.getByRole('button', { name: m.star_detail_back() }))
    expect(shownPreview()).toBe('true')
    expect(preview.mounts).toBe(1)
  })

  it('keeps the preview through a recall request and the refreshed memory it brings back', async () => {
    const user = userEvent.setup()
    const { onRecallRequested } = renderPanel()

    await user.click(screen.getByRole('button', { name: m.star_detail_recall() }))
    expect(onRecallRequested).toHaveBeenCalledWith(memory.id)
    act(() => {
      useEpisodicMemoryStore.getState().reconcile([{ ...memory, recallCount: 1 }])
    })

    expect(shownPreview()).toBe('true')
    expect(preview.mounts).toBe(1)
  })
})
